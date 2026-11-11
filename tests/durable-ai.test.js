import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {signRunAccess,verifyRunAccess} from '../server/ai-run-token.js';
import {mayResumeCoordinator,validateAIScope} from '../server/durable-policy.js';
import {runAIRequest} from '../server/durable-client.js';
import {createBudgetedFetch} from '../server/ai-usage.js';
import {openRequestStore} from '../requests/store.js';
import {isAbandonedAnalysis} from '../requests/analysis-recovery-policy.js';
import {safeAnalysisFailure} from '../requests/analysis-failure.js';
const id='00000000-0000-4000-8000-000000000001';

test('poll tokens reject tampering, cross-workspace use, expired and foreign signatures',()=>{
 const token=signRunAccess({runId:'wrun_test',workspaceId:id},'test-secret',100);
 assert.equal(verifyRunAccess(token,id,'test-secret',101),'wrun_test');
 for(const [value,workspace,key,now] of [[token+'x',id,'test-secret',101],[token,'other','test-secret',101],[token,id,'other',101],[token,id,'test-secret',86400100],['bad',id,'test-secret',101]])assert.equal(verifyRunAccess(value,workspace,key,now),null);
});
test('resume is fenced by request revision, deletion, latest attempt and agent ownership',()=>{
 const request={revision:1},run={run_id:'run',base_revision:1,status:'running'};
 assert.equal(mayResumeCoordinator(request,run,run,true),true);
 for(const args of [[{...request,revision:2},run,run,true],[{...request,deleted_at:'now'},run,run,true],[request,{...run,status:'failed'},run,true],[request,run,{run_id:'new'},true],[request,run,run,false]])assert.equal(mayResumeCoordinator(...args),false);
 assert.throws(()=>validateAIScope({kind:'other'}),/INVALID_AI_SCOPE/);
 assert.throws(()=>validateAIScope({kind:'internal_review',workspaceId:id,actorId:id,leaseToken:id,requestId:id}),/INVALID_AI_SCOPE/);
});
test('browser submits once, polls a workspace-scoped token, and returns the saved result',async()=>{
 const calls=[],responses=[Response.json({run_token:'signed'},{status:202}),Response.json({status:'running'}),Response.json({status:'completed',result:{status:200,body:{saved:true}}})];
 const result=await runAIRequest('/api/requests',{method:'POST',body:'command'},{fetchImpl:async(url,init)=>{calls.push({url,init});return responses.shift();},wait:async()=>{}});
 assert.deepEqual(await result.json(),{saved:true});assert.deepEqual(calls.map(c=>c.url),['/api/requests','/api/ai-runs','/api/ai-runs']);
 assert.equal(JSON.parse(calls[1].init.body).run_token,'signed');assert.ok(calls[0].init.headers.get('x-syncflow-attempt'));
});
test('poll failure or disconnect never resubmits a paid command',async()=>{
 for(const status of ['failed','cancelled']){let calls=0;await assert.rejects(runAIRequest('/api/priority-review',{method:'POST'},{fetchImpl:async()=>++calls===1?Response.json({run_token:'signed'},{status:202}):Response.json({status}),wait:async()=>{}}),/retry explicitly/);assert.equal(calls,2);}
 const controller=new AbortController();let calls=0;
 await assert.rejects(runAIRequest('/api/requests',{signal:controller.signal},{fetchImpl:async()=>{calls++;controller.abort();return Response.json({run_token:'signed'},{status:202});},wait:async()=>{}}));assert.equal(calls,1);
 const response=await runAIRequest('/api/requests',{}, {fetchImpl:async()=>Response.json({error:'denied'},{status:403})});assert.equal(response.status,403);
});
test('durable paid attempts are claimed before send; a replay never sends again',async()=>{
 const claims=new Map(),keys=[];let sends=0;
 const client={rpc:async(name,args)=>{assert.equal(name,'syncflow_reserve_durable_ai_attempt');keys.push(args.p_key);assert.equal(args.p_digest,createHash('sha256').update(init.body).digest('hex'));if(claims.has(args.p_key))return {data:{allowed:false,duplicate:true}};claims.set(args.p_key,args);return {data:{allowed:true}};}};
 const init={method:'POST',body:JSON.stringify({max_tokens:4096})};
 const create=()=>createBudgetedFetch({client,workspaceId:id,actorId:id,feature:'coordinator',attemptPrefix:'run:intake',fetchImpl:async()=>{sends++;return Response.json({ok:true});}});
 const first=create();await first('https://api.anthropic.com/v1/messages',init);
 const replay=await create()('https://api.anthropic.com/v1/messages',init);
 assert.equal(replay.status,409);assert.equal(replay.headers.get('x-syncflow-uncertain-attempt'),'true');assert.equal(sends,1);
 await first('https://api.anthropic.com/v1/messages',init);assert.equal(sends,2);assert.deepEqual(keys,['run:intake:0','run:intake:0','run:intake:1']);
});
test('durable run metadata survives snapshots while legacy inline runs keep their recovery policy',()=>{
 const store=openRequestStore();let reopened;
 try{
  const request=store.create({actor_id:'A',email:'Synthetic inquiry',timezone:'UTC',idempotency_key:'create'}).request;
  const run=store.beginAnalysis({actor_id:'A',request_id:request.id,expected_revision:0,idempotency_key:'analysis',execution_mode:'durable'}).analysis;
  const snapshot=store.exportState();reopened=openRequestStore(':memory:',{initialState:snapshot});
  const persisted=reopened.analysis('A',request.id,run.run_id);assert.equal(persisted.execution_mode,'durable');assert.equal(persisted.started_by,'A');
  assert.equal(isAbandonedAnalysis(persisted,Date.now()+86400000),false);
  assert.equal(isAbandonedAnalysis({...persisted,execution_mode:null},Date.now()+86400000),true);
  const legacy=structuredClone(snapshot);for(const row of legacy.tables.analysis_runs){delete row.execution_mode;delete row.started_by;}
  const old=openRequestStore(':memory:',{initialState:legacy});try{assert.equal(old.analysis('A',request.id,run.run_id).execution_mode,null);}finally{old.close();}
  assert.equal(safeAnalysisFailure({error:{code:'PROVIDER_ATTEMPT_UNCERTAIN'}}).error.code,'PROVIDER_ATTEMPT_UNCERTAIN');
 }finally{store.close();reopened?.close();}
});

test('bundled prompts exactly match the reviewed versioned text',()=>{
 for(const [agent,version] of [['intake','intake-v1.3'],['follow-up','follow-up-v1']]){
 const base=new URL('../agents/'+agent+'/prompts/'+version,import.meta.url);
 assert.equal(JSON.parse(readFileSync(new URL(base.href+'.json'),'utf8')),readFileSync(new URL(base.href+'.txt'),'utf8'));
 }
});

test('uncertain attempt markers never trigger another provider call',async()=>{
 const {createClaudeProvider}=await import('../agents/intake/providers/claude.js');
 const {createFollowUpClaudeProvider}=await import('../agents/follow-up/providers/claude.js');
 const {draftPriorityReport}=await import('../agents/priority/ai-review.js');
 const {triageReviews}=await import('../agents/internal/triage.js');
 let calls=0;const fetchImpl=async()=>{calls++;return new Response(null,{status:409,headers:{'x-syncflow-uncertain-attempt':'true'}});};
 const options={apiKey:'test',model:'test',fetchImpl};
 for(const provider of [createClaudeProvider(options),createFollowUpClaudeProvider(options)])await assert.rejects(provider.generate({context:{},review:{},signal:AbortSignal.timeout(1000)}),e=>e.code==='PROVIDER_ATTEMPT_UNCERTAIN');
 await assert.rejects(draftPriorityReport({...options,cases:[{id:'one',messages:[]}],review:{},retryTransport:false}),/AI_ATTEMPT_UNCERTAIN/);
 await assert.rejects(triageReviews({...options,cases:[{id:'one',summary:{},workflow:{status:'Needs analysis'},messages:[]}]}),/AI_ATTEMPT_UNCERTAIN/);
 assert.equal(calls,4);
 calls=0;await assert.rejects(draftPriorityReport({...options,cases:[{id:'one',messages:[]}],review:{},retryTransport:false,fetchImpl:async()=>{calls++;return new Response(null,{status:503});}}),/AI_UNAVAILABLE/);assert.equal(calls,1);
});
