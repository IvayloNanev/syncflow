// Opt-in real model acceptance. Disposable workspace only; no emails or external sends.
import 'dotenv/config';
import {config} from 'dotenv';
import {createClient} from '@supabase/supabase-js';
import {createServerClient} from '@supabase/ssr';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
config({path:'.env.local',quiet:true});
if(process.env.SYNCFLOW_LIVE_TEST!=='1'||process.env.SYNCFLOW_LIVE_MODEL_TEST!=='1')throw new Error('Both live-test flags are required. This test incurs model API usage.');
const origin=process.env.SYNCFLOW_TEST_APP_URL;
if(!origin||new URL(origin).origin!==origin)throw new Error('Set an exact test app origin.');
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const must=r=>{if(r.error)throw new Error(`Fixture operation failed (${r.error.code||'provider'})`);return r.data;};
const workspace=randomUUID(),jar=new Map();let user,created=false;
const post=async input=>{const response=await fetch(`${origin}/api/requests`,{method:'POST',headers:{origin,'content-type':'application/json',cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')},body:JSON.stringify(input),signal:AbortSignal.timeout(100000)});const body=await response.json();assert.equal(response.ok,true,`API ${response.status}: ${body.error?.code||'unexpected response'}`);return body;};
try{
 const email=`syncflow-live-${randomUUID()}@example.invalid`,password=`Check-${randomUUID()}-aA7!`;
 user=must(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;
 must(await admin.from('syncflow_workspaces').insert({id:workspace,name:`Disposable live workflow ${workspace}`}));created=true;
 must(await admin.from('syncflow_members').insert({workspace_id:workspace,user_id:user.id,role:'member'}));
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
 must(await client.auth.signInWithPassword({email,password}));
 const made=await post({action:'create',email:'Hi, I am Alex Demo at Fictional Creative. We would like Northern Lights by Maya Rivers, instrumental version, for a Canadian advertising campaign for six months. Our budget is CAD $5,000. Please let us know what other information you need. This is fictional acceptance-test data.',timezone:'America/Toronto',recording_id:'TRACK-0002',idempotency_key:randomUUID()});
 const id=made.request.id,key=randomUUID();
 await post({action:'analyze',request_id:id,expected_revision:0,idempotency_key:key});
 const current=await post({action:'get',request_id:id});
 const analysis=current.analyses.find(a=>a.run_id===current.active_analysis?.run_id);
 const failure=current.analyses.at(-1)?.failure;
 assert.equal(current.active_analysis?.status,'completed',`Live analysis did not complete: ${failure?.error?.code||failure?.failed_stage||'no active result'}`);
 assert.ok(current.request.agent_fields.length>0,'Live intake extracts facts');
 assert.ok(analysis?.draft,'Clarification draft is persisted');
 assert.equal(current.workflow.brief_approved,false,'Analysis cannot approve the brief');
 const replay=await post({action:'analyze',request_id:id,expected_revision:0,idempotency_key:key});
 assert.equal(replay.replayed,true,'Retry reopens the same run without a second model call');
 assert.equal(replay.analyses.length,current.analyses.length);
 const replied=await post({action:'reply',request_id:id,expected_revision:0,text:'Additional fictional reply: the project is a digital campaign for a fictional outdoor clothing brand.',idempotency_key:randomUUID()});
 assert.equal(replied.request.revision,1);assert.equal(replied.request.messages.length,2);
 assert.equal(replied.workflow.brief_approved,false);assert.equal(replied.workflow.status,'Needs analysis');
 console.log('PASS: live model intake, checklist, persisted follow-up draft, reopen, retry without duplicate generation, reply history and stale-result invalidation. No emails sent.');
}finally{
 if(created){must(await admin.from('syncflow_analysis_leases').delete().eq('workspace_id',workspace));must(await admin.from('syncflow_requests').delete().eq('workspace_id',workspace));must(await admin.from('syncflow_members').delete().eq('workspace_id',workspace));must(await admin.from('syncflow_workspaces').delete().eq('id',workspace));}
 if(user)must(await admin.auth.admin.deleteUser(user.id));
 console.log('Disposable live workflow fixtures removed.');
}
