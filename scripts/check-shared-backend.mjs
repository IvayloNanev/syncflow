// Opt-in integration check. Creates only uniquely named disposable test identities
// and workspaces; removes precisely those records in finally. Never lists real users.
import 'dotenv/config';
import {config} from 'dotenv';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {openSharedStore,creationId} from '../requests/shared-store.js';
import {analyzeSavedRequest} from '../requests/analyze-saved.js';
import {createFollowUpMockProvider} from '../agents/follow-up/providers/mock.js';
config({path:'.env.local',quiet:true});
if(process.env.SYNCFLOW_LIVE_TEST!=='1')throw new Error('Set SYNCFLOW_LIVE_TEST=1 to create disposable integration fixtures.');
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const admin=createClient(url,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const workspace=randomUUID(),other=randomUUID(),users=[],stores=[];let created=false;
const must=({data,error})=>{if(error)throw new Error(`Hosted test failed: ${error.code??'provider error'}`);return data;};
const app=process.env.SYNCFLOW_TEST_APP_URL;
try{
 must(await admin.from('syncflow_workspaces').insert([{id:workspace,name:`Integration check ${workspace}`},{id:other,name:`Integration check ${other}`} ]));created=true;
 for(let i=0;i<3;i++){
  const email=`syncflow-check-${randomUUID()}@example.invalid`,password=`Check-${randomUUID()}-aA7!`;
  const {user}=must(await admin.auth.admin.createUser({email,password,email_confirm:true}));users.push(user);
  const jar=new Map();const client=createServerClient(url,key,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
  must(await client.auth.signInWithPassword({email,password}));user.client=client;user.cookie=()=>[...jar].map(([name,value])=>`${name}=${value}`).join('; ');
  must(await admin.from('syncflow_members').insert({workspace_id:i===2?other:workspace,user_id:user.id,role:'member'}));
 }
 const own=must(await users[0].client.from('syncflow_members').select('user_id,workspace_id'));
 assert.equal(own.length,1);assert.equal(own[0].user_id,users[0].id);
 const exposed=await users[0].client.from('syncflow_requests').select('state');assert.ok(exposed.error,'clients cannot access internal aggregate table');
 const forged=await users[0].client.rpc('syncflow_commit_request',{p_workspace:workspace,p_actor:users[0].id,p_id:randomUUID(),p_expected:0,p_state:{schema_version:1},p_dashboard:{}});assert.ok(forged.error,'clients cannot forge validated commands');
 const id=creationId(workspace,users[0].id,'integration-create');
 const opts={client:admin,workspaceId:workspace,actorId:users[0].id,id};
 const a=await openSharedStore(opts);stores.push(a);a.create({actor_id:users[0].id,idempotency_key:'integration-create',email:'Fictional integration request for Northern Lights.',timezone:'UTC',recording_id:'TRACK-0002'});await a.flush();
 const b=await openSharedStore({...opts,actorId:users[1].id});stores.push(b);assert.equal(b.get(users[1].id,id).messages[0].added_by,users[0].id);
 b.appendReply({actor_id:users[1].id,request_id:id,expected_revision:0,text:'Fictional reply.',idempotency_key:'reply'});await b.flush();
 await a.refresh();assert.equal(a.get(users[0].id,id).revision,1);
 const providers={intakeProvider:{id:'integration-mock',mode:'mock',generate:async({context})=>({schema_version:'1.0',run_id:context.run_id,base_record_version:context.base_record_version,proposed_changes:[],ambiguities:[]})},followUpProvider:createFollowUpMockProvider()};
 const analysis=await analyzeSavedRequest(a,{actor_id:users[0].id,request_id:id,expected_revision:1,idempotency_key:'analysis'},providers);await a.flush();assert.equal(analysis.analysis.status,'completed');
 const c=await openSharedStore(opts);stores.push(c);assert.ok(c.activeAnalysis(users[0].id,id));
 const lease=randomUUID();assert.equal(must(await admin.rpc('syncflow_acquire_analysis',{p_workspace:workspace,p_actor:users[0].id,p_token:lease})),true);
 assert.equal(must(await admin.rpc('syncflow_acquire_analysis',{p_workspace:workspace,p_actor:users[1].id,p_token:randomUUID()})),false);
 const denied=await admin.rpc('syncflow_acquire_analysis',{p_workspace:workspace,p_actor:users[2].id,p_token:randomUUID()});assert.ok(denied.error);
 if(app){
  const post=async(user,input,origin=app)=>fetch(`${app}/api/requests`,{method:'POST',headers:{'content-type':'application/json',origin,...(user?{cookie:user.cookie()}:{})},body:JSON.stringify(input)});
  assert.equal((await post(null,{action:'list'})).status,401);
  assert.equal((await post(users[0],{action:'list'},'https://foreign.invalid')).status,403);
  const listed=await post(users[1],{action:'list'});assert.equal(listed.status,200);assert.ok((await listed.json()).requests.some(r=>r.id===id));
  assert.equal((await post(users[2],{action:'get',request_id:id})).status,404);
  const got=await post(users[1],{action:'get',request_id:id});assert.equal(got.status,200);assert.equal((await got.json()).active_analysis.status,'completed');
  const payload={action:'create',email:'Another fictional web request.',timezone:'UTC',idempotency_key:randomUUID()};
  const made=await post(users[0],payload);assert.equal(made.status,201);const request=(await made.json()).request;
  assert.equal((await post(users[0],payload)).status,200);
  const stale=await post(users[1],{action:'reply',request_id:request.id,expected_revision:99,text:'Stale reply',idempotency_key:randomUUID()});assert.equal(stale.status,409);
  const reply=await post(users[1],{action:'reply',request_id:request.id,expected_revision:0,text:'Teammate reply',idempotency_key:randomUUID()});assert.equal(reply.status,200);assert.equal((await reply.json()).request.messages[1].added_by,users[1].id);
  const redirect=await fetch(`${app}/coordinator`,{redirect:'manual'});assert.equal(redirect.status,307);assert.ok(redirect.headers.get('location')?.includes('/login'));
  // Complete fixture exercises real hosted storage/API gates without more model spend.
  const fixture=JSON.parse(readFileSync(new URL('../fixtures/development/complete.json',import.meta.url),'utf8').replaceAll('Artist A','Maya Rivers').replaceAll('Track X','Northern Lights'));
  const completeEmail=fixture.context.messages[0].text.replace('November 6, 2026.','November 6, 2026 at 17:00 America/Toronto.');
  const deadline=fixture.intake.proposed_changes.find(p=>p.field_key==='response_deadline');
  deadline.proposed_value={supplied_text:'November 6, 2026 at 17:00 America/Toronto',date:'2026-11-06',time:'17:00',timezone:'America/Toronto'};deadline.evidence[0].exact_quote=deadline.proposed_value.supplied_text;
  const completeCreated=await post(users[0],{action:'create',email:completeEmail,timezone:'UTC',recording_id:'TRACK-0001',idempotency_key:randomUUID()});assert.equal(completeCreated.status,201);
  const completeId=(await completeCreated.json()).request.id;
  const completeStore=await openSharedStore({...opts,id:completeId});stores.push(completeStore);
  await analyzeSavedRequest(completeStore,{actor_id:users[0].id,request_id:completeId,expected_revision:0,idempotency_key:randomUUID()},{intakeProvider:{id:'hosted-complete-mock',mode:'mock',generate:async({context})=>({...fixture.intake,run_id:context.run_id,base_record_version:context.base_record_version,proposed_changes:fixture.intake.proposed_changes.map(p=>({...p,evidence:p.evidence.map(e=>({...e,message_id:context.messages[0].message_id}))}))})},followUpProvider:createFollowUpMockProvider()});await completeStore.flush();
  const command=async(user,fields)=>{const response=await post(user,{request_id:completeId,expected_revision:0,idempotency_key:randomUUID(),...fields});assert.equal(response.status,200,`Hosted lifecycle command ${fields.action}`);return response.json();};
  // Reads use only their whitelisted fields.
  const beforeResponse=await post(users[1],{action:'get',request_id:completeId});assert.equal(beforeResponse.status,200);const before=await beforeResponse.json();
  assert.equal(before.workflow.status,'Needs coordinator review');
  const blocked=await post(users[1],{action:'complete_review',request_id:completeId,expected_revision:0,expected_review_version:0,idempotency_key:randomUUID()});assert.equal(blocked.status,409);
  const approved=await command(users[1],{action:'approve_brief',analysis_run_id:before.active_analysis.run_id});assert.equal(approved.workflow.brief_approval.approved_by,users[1].id);
  const summary=await command(users[1],{action:'save_handoff',expected_handoff_version:0,source_token:approved.handoff.source_token,text:'Fictional hosted handoff. Separate rights clearance is required.'});assert.equal(summary.handoff.latest.outdated,false);
  const assigned=await command(users[0],{action:'reviewer',expected_review_version:0,operation:'assign',name:'Fictional reviewer',role:'Director'});
  await command(users[1],{action:'reviewer',expected_review_version:1,operation:'decision',reviewer_id:assigned.reviewer_tracking.reviewers[0].id,status:'Approved',notes:'Fictional internal decision, no rights grant.'});
  const completed=await command(users[0],{action:'complete_review',expected_review_version:2});assert.equal(completed.workflow.completed,true);
  const reopenedResponse=await post(users[1],{action:'get',request_id:completeId});const reopened=await reopenedResponse.json();assert.equal(reopened.workflow.completed,true);assert.equal(reopened.brief_approval_history.length,1);
  const changed=await command(users[0],{action:'reply',text:'Fictional scope change: worldwide instead of Canada.'});assert.equal(changed.workflow.completed,false);assert.equal(changed.workflow.brief_approved,false);assert.equal(changed.handoff.latest.outdated,true);
  console.log('PASS: hosted coordinator approval, attributed teammate review, handoff persistence, completion/reopen and scope-change invalidation.');
  console.log('PASS: signed-in API create/replay/reopen/team reply, stale rejection, cross-workspace denial, anonymous denial, origin protection and page redirect.');
 }
 console.log('PASS: hosted persistence/reopen, shared audit identity, persisted analysis, membership RLS, client write denial and distributed analysis reservation.');
}finally{
 stores.forEach(s=>s.dispose());
 if(created){
  must(await admin.from('syncflow_analysis_leases').delete().in('workspace_id',[workspace,other]));
  must(await admin.from('syncflow_requests').delete().in('workspace_id',[workspace,other]));
  must(await admin.from('syncflow_members').delete().in('workspace_id',[workspace,other]));
  must(await admin.from('syncflow_workspaces').delete().in('id',[workspace,other]));
 }
 for(const user of users)must(await admin.auth.admin.deleteUser(user.id));
 console.log('Disposable hosted fixtures removed.');
}
