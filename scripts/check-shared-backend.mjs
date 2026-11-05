// Opt-in integration check. Creates only uniquely named disposable test identities
// and workspaces; removes precisely those records in finally. Never lists real users.
import 'dotenv/config';
import {config} from 'dotenv';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
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
