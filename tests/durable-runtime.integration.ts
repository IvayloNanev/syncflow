/* eslint-disable @typescript-eslint/no-explicit-any -- synthetic PostgREST wire fixtures */
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {start,getRun} from 'workflow/api';
import {HookConflictError} from 'workflow/errors';
import {durableAI} from '../workflows/ai';
import {openRequestStore} from '../requests/store.js';
import {intakeFieldGroups} from '../agents/intake/providers/tool-schema.js';
import {createFollowUpMockProvider} from '../agents/follow-up/providers/mock.js';
import {loadBriefing} from '../server/briefing-store.js';
import {durableStorage} from '../server/durable-storage.js';
import {reviewFingerprint} from '../agents/internal/lifecycle.js';
const workspaceId='10000000-0000-4000-8000-000000000001',actorId='20000000-0000-4000-8000-000000000001';
let row:any,briefing:any,assessments:any[],claims:Set<string>,calls:Record<string,number>,failCommit:boolean,revoked:boolean,failProvider:boolean;
const rest='https://durable-test.invalid';
const tool=(name:string,input:unknown)=>Response.json({stop_reason:'tool_use',content:[{type:'tool_use',name,input}]});
beforeEach(()=>{
 row=null;briefing=null;assessments=[];claims=new Set();calls={};failCommit=false;revoked=false;failProvider=false;
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL',rest);vi.stubEnv('SUPABASE_SECRET_KEY','test-secret');vi.stubEnv('ANTHROPIC_API_KEY','synthetic-test');vi.stubEnv('ANTHROPIC_MODEL','test-model');
 vi.stubGlobal('fetch',async(input:any,init:any={})=>{
  const url=new URL(typeof input==='string'?input:input.url||String(input));const body=init.body?JSON.parse(init.body):null;
  if(url.href==='https://api.anthropic.com/v1/messages'){
   const name=body.tools[0].name;calls[name]=(calls[name]||0)+1;if(failProvider)throw Error('Synthetic response loss after delivery');const payload=JSON.parse(body.messages[0].content);
   if(name==='submit_intake')return tool(name,{schema_version:'1.0',run_id:payload.context.run_id,base_record_version:payload.context.base_record_version,proposed_changes:Object.fromEntries(Object.keys(intakeFieldGroups).map(k=>[k,[]])),ambiguities:[]});
   if(name==='submit_follow_up')return tool(name,await createFollowUpMockProvider().generate({...payload,signal:AbortSignal.timeout(10000)}));
   if(name==='submit_priority_report')return tool(name,{items:payload.cases.map((c:any)=>({request_id:c.id,reason:'Review the missing details.',action:c.eligible_actions[0].action,blocker:'The request needs clarification.',next_action:'Review and copy the saved response.',citations:[{message_id:c.messages[0].message_id,exact_quote:'Synthetic inquiry'}]}))});
   if(name==='submit_review_triage')return tool(name,{items:payload.cases.map((c:any)=>({request_id:c.id,lane:'manager',reason:'The coordinator requested a management decision.',next_action:'Ask the manager how to proceed.',escalation_trigger:c.triage.escalation[0],citations:[{message_id:c.internal_review_request.id,exact_quote:c.internal_review_request.reason}]}))});
   throw Error('Unexpected model tool '+name);
  }
  if(url.origin!==rest)throw Error('Unexpected external request '+url.origin);
  const path=url.pathname.split('/').at(-1);
  if(url.pathname.includes('/rpc/')){
   if(path==='syncflow_acquire_analysis')return Response.json(true);
   if(path==='syncflow_reserve_durable_ai_attempt'){if(claims.has(body.p_key))return Response.json({allowed:false,duplicate:true});claims.add(body.p_key);return Response.json({allowed:true});}
   if(path==='syncflow_commit_request'){
    calls.commit=(calls.commit||0)+1;
    if(failCommit){failCommit=false;return Response.json({message:'Synthetic storage interruption'},{status:503});}
    if(body.p_expected!==row.version)return Response.json({message:'STORAGE_CONFLICT'},{status:409});
    row={...row,state:body.p_state,dashboard:body.p_dashboard,version:row.version+1};return Response.json(row.version);
   }
   if(path==='syncflow_save_internal_assessment'){assessments.push({request_id:body.p_request,fingerprint:body.p_fingerprint,result:body.p_result});return Response.json(null);}
   throw Error('Unexpected RPC '+path);
  }
  if(path==='syncflow_members')return Response.json(revoked?null:{role:'member'});
  if(path==='syncflow_analysis_leases')return new Response(null,{status:204});
  if(path==='syncflow_briefings'){if(init.method==='POST'){briefing=body;return new Response(null,{status:201});}return Response.json(briefing);}
  if(path==='syncflow_internal_assessments')return Response.json(assessments);
  if(path==='syncflow_internal_queue')return init.method==='POST'?new Response(null,{status:201}):Response.json([]);
  if(path==='syncflow_requests'){
   const select=url.searchParams.get('select');
   if(url.searchParams.has('id'))return Response.json(row?{state:row.state,version:row.version,dashboard:row.dashboard}:null);
   return Response.json(row?[select==='id,version'?{id:row.id,version:row.version}:{id:row.id,dashboard:row.dashboard}]:[]);
  }
  throw Error('Unexpected storage route '+path);
 });
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
function fixture(){
 const store=openRequestStore(':memory:',{ownerId:workspaceId});
 try{const request=store.create({actor_id:actorId,email:'Synthetic inquiry. Please review this music request.',timezone:'UTC',idempotency_key:'create'}).request;
 const run=store.beginAnalysis({actor_id:actorId,request_id:request.id,expected_revision:0,idempotency_key:'analysis',execution_mode:'durable'}).analysis;
 row={id:request.id,version:1,state:store.exportState(),dashboard:{id:request.id,revision:0,status:'Needs analysis'}};
 return {kind:'coordinator' as const,workspaceId,actorId,leaseToken:run.run_id,analysisRunId:run.run_id,requestId:request.id};
 }finally{store.close();}
}
it('compiled Coordinator checkpoints paid steps across a failed save, with duplicate start protection',async()=>{
 const scope=fixture();failCommit=true;
 const options={experimental_hook:{token:'test:'+scope.analysisRunId,experimental_minRetention:'7 days' as const}};
 const run=await start(durableAI,[scope],options);
 await expect(start(durableAI,[scope],options)).rejects.toSatisfy(HookConflictError.is);
 // A fresh observer attaches after the initial request returned.
 const result=await getRun<any>(run.runId).returnValue;
 expect(result.body.analysis_status).toBe('completed');
 expect(calls.submit_intake).toBe(1);expect(calls.submit_follow_up).toBe(1);expect(calls.commit).toBe(2);
});
it('all three compiled agent paths save results without any live service',async()=>{
 const scope=fixture();const initial=await start(durableAI,[scope]);expect(((await initial.returnValue).body as any).analysis_status).toBe('completed');
 const daily=await start(durableAI,[{kind:'daily_brief',workspaceId,actorId,leaseToken:crypto.randomUUID()}]);
 expect((await daily.returnValue).status).toBe(200);expect(calls.submit_priority_report).toBe(1);expect(briefing.report.items).toHaveLength(1);
 const store=openRequestStore(':memory:',{ownerId:workspaceId,initialState:row.state});
 try{store.requestInternalReview({actor_id:actorId,request_id:row.id,expected_revision:0,analysis_run_id:scope.analysisRunId,reason:'Management must decide whether to proceed.',question:'Should this request proceed?',idempotency_key:'review'});row.state=store.exportState();row.version++;}finally{store.close();}
 const loaded=await loadBriefing(durableStorage(),workspaceId,actorId,{includeCorrespondence:true});
 const internal=await start(durableAI,[{kind:'internal_review',workspaceId,actorId,leaseToken:crypto.randomUUID(),requestId:row.id,fingerprint:reviewFingerprint(loaded.cases[0])}]);
 expect((await internal.returnValue).status).toBe(200);expect(calls.submit_review_triage).toBe(1);expect(assessments).toHaveLength(1);
});
it('a revoked member cannot call the provider from queued work',async()=>{
 const scope=fixture();revoked=true;
 const run=await start(durableAI,[scope]);await expect(run.returnValue).rejects.toThrow();expect(claims.size).toBe(0);expect(calls.submit_intake).toBeUndefined();
});

it('an uncertain provider response fails without automatic paid retry; a new explicit attempt can recover',async()=>{
 const scope=fixture();failProvider=true;
 const failed=await start(durableAI,[scope]);expect(((await failed.returnValue).body as any).analysis_status).toBe('failed');
 expect(calls.submit_intake).toBe(1);expect(calls.submit_follow_up).toBeUndefined();
 failProvider=false;
 const store=openRequestStore(':memory:',{ownerId:workspaceId,initialState:row.state});
 let next;
 try{next=store.beginAnalysis({actor_id:actorId,request_id:row.id,expected_revision:0,idempotency_key:'explicit-retry',execution_mode:'durable'}).analysis;row.state=store.exportState();row.version++;}finally{store.close();}
 const retry=await start(durableAI,[{...scope,analysisRunId:next.run_id,leaseToken:next.run_id}]);
 expect(((await retry.returnValue).body as any).analysis_status).toBe('completed');expect(calls.submit_intake).toBe(2);expect(calls.submit_follow_up).toBe(1);
});
