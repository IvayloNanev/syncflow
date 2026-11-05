import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openRequestStore } from '../requests/store.js';
import { createSavedRequestsHandler } from '../server/saved-requests.js';
import { createFollowUpMockProvider } from '../agents/follow-up/providers/mock.js';
const request = (input, origin = 'http://127.0.0.1:3000') => new Request('http://localhost:3000/api/requests', {
  method:'POST', headers:{host:'127.0.0.1:3000',origin,'content-type':'application/json'},body:JSON.stringify(input),
});
function setup(t, override = {}) {
  const dir=mkdtempSync(join(tmpdir(),'syncflow-browser-store-')); const path=join(dir,'requests.sqlite');
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  let calls=0;
  const providers=()=>({intakeProvider:{id:'test',mode:'mock',generate:async({context})=>{
    calls++;return {schema_version:'1.0',run_id:context.run_id,base_record_version:context.base_record_version,proposed_changes:[],ambiguities:[]};
  }},followUpProvider:createFollowUpMockProvider()});
  const options={enabled:()=>true,openStore:()=>openRequestStore(path),providers,...override};
  const post=createSavedRequestsHandler(options);
  const call=async body=>{const response=await post(request(body));return {status:response.status,...await response.json()};};
  return {post,call,path,options,calls:()=>calls};
}
const create={action:'create',email:'Contact: Fictional Example. TRACK-0002 for an ad in Canada.',timezone:'UTC',recording_id:'TRACK-0002',idempotency_key:'create-1'};
test('create/retry/list/reopen survive a new handler with recording and original message intact',async t=>{
  const {call,options,calls}=setup(t);
  const created=await call(create);assert.equal(created.status,201);assert.equal(created.request.revision,0);
  const retried=await call(create);assert.equal(retried.status,200);assert.equal(retried.replayed,true);assert.equal(retried.request.id,created.request.id);
  assert.equal((await call({action:'list'})).requests.length,1);
  const reopened=await createSavedRequestsHandler(options)(request({action:'get',request_id:created.request.id}));
  const detail=await reopened.json();assert.equal(detail.request.messages[0].text,create.email);assert.equal(detail.request.recording_id,'TRACK-0002');
  assert.deepEqual(detail.request.confirmed_fields,[]);assert.equal(detail.active_analysis,null);assert.equal(calls(),0);
  assert.equal((await call({...create,recording_id:'TRACK-0003'})).status,409);
});
test('save analysis, reopen, append reply, invalidate then analyze new revision with both messages',async t=>{
  const {call,calls}=setup(t);const {request:r}=await call(create);
  const run={action:'analyze',request_id:r.id,expected_revision:0,idempotency_key:'analysis-1'};
  const analyzed=await call(run);assert.equal(analyzed.analysis_status,'completed');assert.ok(analyzed.active_analysis.result.ok);
  assert.equal(analyzed.active_analysis.result.saved,false); // workflow envelope remains proposal-only; persistence is outer metadata
  assert.deepEqual(analyzed.request.confirmed_fields,[]);assert.equal(calls(),1);
  assert.equal((await call(run)).replayed,true);assert.equal(calls(),1);
  assert.equal((await call({action:'get',request_id:r.id})).active_analysis.run_id,analyzed.active_analysis.run_id);
  const command={action:'reply',request_id:r.id,expected_revision:0,idempotency_key:'reply-1',text:'Budget is CAD 5000.'};
  const reply=await call(command);assert.equal(reply.request.revision,1);assert.equal(reply.request.messages.length,2);
  assert.equal(reply.active_analysis,null);assert.equal(reply.analyses[0].status,'stale');
  assert.equal(reply.analyses[0].message_count,1);
  assert.deepEqual(reply.analyses[0].draft,analyzed.active_analysis.result.stages.follow_up.output);
  assert.equal('context' in reply.analyses[0],false); // historical draft projection does not expose agent context
  const history=await call({action:'get',request_id:r.id});
  assert.deepEqual(history.analyses[0].draft,reply.analyses[0].draft);
  assert.equal((await call(command)).request.messages.length,2);
  assert.equal((await call({...command,idempotency_key:'reply-2'})).status,409);
  assert.equal((await call({...run,idempotency_key:'old-revision'})).status,409);
  const next=await call({...run,expected_revision:1,idempotency_key:'analysis-2'});
  assert.equal(next.active_analysis.base_revision,1);assert.equal(next.active_analysis.context.messages.length,2);
  assert.deepEqual(next.request.confirmed_fields,[]);assert.equal(calls(),2);
});
test('disabled, hostile origin, forged actor and malformed commands cannot touch storage or providers',async()=>{
  let opened=0;const options={enabled:()=>true,openStore:()=>{opened++;throw Error('must not open');}};
  assert.equal((await createSavedRequestsHandler({...options,enabled:()=>false})(request(create))).status,503);
  const post=createSavedRequestsHandler(options);
  assert.equal((await post(request(create,'https://evil.example'))).status,403);
  for(const input of [null,[],{action:'toString'},{...create,actor_id:'other'},{...create,confirmed_fields:[]}])assert.equal((await post(request(input))).status,400);
  assert.equal((await post(request({...create,email:'x'.repeat(110000)}))).status,413);
  assert.equal(opened,0);
});
test('unknown recording, foreign-owner request, and invalid revision are rejected before model calls',async t=>{
  const {call,path,calls}=setup(t);
  assert.equal((await call({...create,recording_id:'FAKE'})).status,400);
  const store=openRequestStore(path);const foreign=store.create({actor_id:'someone-else',email:'Other private request',timezone:'UTC',idempotency_key:'other'}).request;store.close();
  assert.equal((await call({action:'get',request_id:foreign.id})).status,404);
  assert.equal((await call({action:'list'})).requests.length,0);
  assert.equal((await call({action:'analyze',request_id:foreign.id,expected_revision:0,idempotency_key:'a'})).status,404);
  assert.equal(calls(),0);
});
test('overlapping analysis is blocked but a reply invalidates the running snapshot',async t=>{
  let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  const {call}=setup(t,{providers:()=>({intakeProvider:{id:'test',mode:'mock',generate:async({context})=>{
    enter();await gate;return {schema_version:'1.0',run_id:context.run_id,base_record_version:context.base_record_version,proposed_changes:[],ambiguities:[]};
  }},followUpProvider:createFollowUpMockProvider()})});
  const {request:r}=await call(create);const command={action:'analyze',request_id:r.id,expected_revision:0,idempotency_key:'run'};
  const running=call(command);await entered;
  assert.equal((await call({...command,idempotency_key:'second'})).status,429);
  assert.equal((await call({action:'reply',request_id:r.id,expected_revision:0,idempotency_key:'reply',text:'Corrected usage.'})).status,200);
  release();const result=await running;assert.equal(result.analysis_status,'stale');assert.equal(result.active_analysis,null);assert.equal(result.request.revision,1);
});
test('provider failure is saved safely, never leaks errors, and explicit new-key retry works',async t=>{
  let fail=true;
  const {call}=setup(t,{providers:()=>({intakeProvider:{id:'test',mode:'mock',generate:async({context})=>{
    if(fail)throw Error('secret transport details');return {schema_version:'1.0',run_id:context.run_id,base_record_version:0,proposed_changes:[],ambiguities:[]};
  }},followUpProvider:createFollowUpMockProvider()})});
  const {request:r}=await call(create);const command={action:'analyze',request_id:r.id,expected_revision:0,idempotency_key:'bad'};
  const failed=await call(command);assert.equal(failed.analysis_status,'failed');assert.ok(!JSON.stringify(failed).includes('secret transport'));
  fail=false;assert.equal((await call(command)).analysis_status,'failed');
  assert.equal((await call({...command,idempotency_key:'retry'})).analysis_status,'completed');
});
