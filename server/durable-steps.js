import {FatalError,RetryableError} from 'workflow';
import {durableStorage} from './durable-storage.js';
import {createBudgetedFetch} from './ai-usage.js';
import {openSharedStore} from '../requests/shared-store.js';
import {requestDetail} from './saved-requests.js';
import {storedRoutingCase,canRunCoordinator} from './case-routing-policy.js';
import {mayResumeCoordinator,validateAIScope} from './durable-policy.js';
import {runIntake} from '../agents/intake/run-intake.js';
import {runWorkflow} from '../agents/workflow/run-workflow.js';
import {createClaudeProvider} from '../agents/intake/providers/claude.js';
import {createFollowUpClaudeProvider} from '../agents/follow-up/providers/claude.js';
import {loadBriefing,saveBriefing} from './briefing-store.js';
import {reviewPriorities} from '../agents/priority/review.js';
import {superviseCases} from '../agents/priority/supervisor.js';
import {draftPriorityReport} from '../agents/priority/ai-review.js';
import {triageReviews,eligibleLanes} from '../agents/internal/triage.js';
import {currentAssessment,reviewFingerprint} from '../agents/internal/lifecycle.js';
import {reviewRows,admitReview,saveAssessment} from './internal-review-store.js';

async function access(scope){
 validateAIScope(scope);
 const client=durableStorage();
 const {data,error}=await client.from('syncflow_members').select('role').eq('workspace_id',scope.workspaceId).eq('user_id',scope.actorId).maybeSingle();
 if(error)throw Error('ACCESS_CHECK_UNAVAILABLE');if(!data)throw new FatalError('WORKSPACE_ACCESS_DENIED');
 return client;
}
async function lease(scope){
 const client=await access(scope);
 const {data,error}=await client.rpc('syncflow_acquire_analysis',{p_workspace:scope.workspaceId,p_actor:scope.actorId,p_token:scope.leaseToken});
 if(error)throw Error('LEASE_UNAVAILABLE');if(!data)throw new RetryableError('WORKSPACE_BUSY',{retryAfter:10000});return client;
}
async function storeFor(scope,client){return openSharedStore({client,workspaceId:scope.workspaceId,actorId:scope.actorId,id:scope.requestId});}
async function coordinatorSource(scope,client){
 const store=await storeFor(scope,client);
 try{
  const request=store.get(scope.actorId,scope.requestId),analysis=store.analysis(scope.actorId,scope.requestId,scope.analysisRunId);
  if(!mayResumeCoordinator(request,analysis,store.analyses(scope.actorId,scope.requestId).at(-1),canRunCoordinator(storedRoutingCase(store,scope.actorId,scope.requestId))))throw new FatalError('CASE_CHANGED');
  return analysis.context;
 }finally{store.dispose();}
}
const providers=(scope,client,stage)=>{
 const fetchImpl=createBudgetedFetch({client,workspaceId:scope.workspaceId,actorId:scope.actorId,feature:scope.kind,attemptPrefix:scope.leaseToken+':'+stage});
 return {intakeProvider:createClaudeProvider({fetchImpl}),followUpProvider:createFollowUpClaudeProvider({fetchImpl})};
};
export async function prepareCoordinator(scope){
 'use step';
 console.log('AI run: preparing Coordinator');
 const client=await lease(scope);return coordinatorSource(scope,client);
}
prepareCoordinator.maxRetries=30;
export async function intakeCoordinator(scope,context){
 'use step';
 console.log('AI run: Intake');
 const client=await lease(scope);await coordinatorSource(scope,client);
 return runIntake(context,{provider:providers(scope,client,'intake').intakeProvider});
}
// A lost invocation may already have reached the provider: never replay it blindly.
intakeCoordinator.maxRetries=0;
export async function completeCoordinator(scope,context,intake){
 'use step';
 console.log('AI run: Review and Follow-up');
 if(!intake.ok)return {ok:false,failed_stage:'intake',error:intake.error,stages:{intake}};
 const client=await lease(scope);await coordinatorSource(scope,client);
 const live=providers(scope,client,'followup');
 const result=await runWorkflow(context,{intakeProvider:{...live.intakeProvider,generate:async()=>intake.output},followUpProvider:live.followUpProvider,catalogueCheck:true,getCurrentVersion:async()=>{
  await coordinatorSource(scope,client);const store=await storeFor(scope,client);try{return await store.currentRevision();}finally{store.dispose();}
 }});
 // Preserve the actual, checkpointed Intake metadata rather than the replay port's timing.
 result.stages.intake=intake;
 return result;
}
completeCoordinator.maxRetries=0;
export async function commitCoordinator(scope,result){
 'use step';
 console.log('AI run: saving Coordinator');
 const client=await lease(scope),store=await storeFor(scope,client);
 try{const finished=store.finishAnalysis({actor_id:scope.actorId,request_id:scope.requestId,run_id:scope.analysisRunId,result});await store.flush();return {status:200,body:{...requestDetail(store,scope.requestId,scope.actorId),analysis_status:finished.status}};}finally{store.dispose();}
}
export async function prepareBriefing(scope){
 'use step';
 console.log('AI run: preparing Daily Brief');
 const client=await lease(scope);const {data,error}=await client.from('syncflow_requests').select('id,version').eq('workspace_id',scope.workspaceId).order('id');if(error)throw Error('BRIEFING_STORAGE_FAILED');
 const loaded=await loadBriefing(client,scope.workspaceId,scope.actorId);const open=loaded.cases.filter(c=>!['Internal review complete','Case completed'].includes(c.workflow.status));
 if(open.length>50)throw new FatalError('AI_CONTEXT_TOO_LARGE');
 return {versions:JSON.stringify(data),cases:open,review:reviewPriorities(loaded.cases.map(c=>({...c.summary,status:c.workflow.status}))),snapshots:loaded.supervision.snapshots};
}
prepareBriefing.maxRetries=30;
export async function generateBriefing(scope,snapshot){
 'use step';
 console.log('AI run: assessing Daily Brief');
 const client=await lease(scope);
 return snapshot.cases.length?draftPriorityReport({retryTransport:false,review:snapshot.review,cases:snapshot.cases,fetchImpl:createBudgetedFetch({client,workspaceId:scope.workspaceId,actorId:scope.actorId,feature:scope.kind,attemptPrefix:scope.leaseToken+':generation'}),signal:AbortSignal.timeout(45000)}):null;
}
generateBriefing.maxRetries=0;
export async function commitBriefing(scope,snapshot,report){
 'use step';
 console.log('AI run: saving Daily Brief');
 const client=await lease(scope);const {data,error}=await client.from('syncflow_requests').select('id,version').eq('workspace_id',scope.workspaceId).order('id');if(error)throw Error('BRIEFING_STORAGE_FAILED');
 if(JSON.stringify(data)!==snapshot.versions)throw new FatalError('CASE_CHANGED');
 const saved=await saveBriefing(client,scope.workspaceId,scope.actorId,report,snapshot.snapshots);
 const {cases}=await loadBriefing(client,scope.workspaceId,scope.actorId);
 return {status:200,body:{report,review:snapshot.review,supervision:superviseCases(cases,saved)}};
}
export async function prepareInternal(scope){
 'use step';
 console.log('AI run: preparing Internal Review');
 const client=await lease(scope),{cases}=await loadBriefing(client,scope.workspaceId,scope.actorId,{includeCorrespondence:true}),c=cases.find(c=>c.id===scope.requestId);
 if(!c||reviewFingerprint(c)!==scope.fingerprint||!eligibleLanes(c).allowed.includes('manager')||['Internal review complete','Case completed'].includes(c.workflow.status))throw new FatalError('CASE_CHANGED');
 await admitReview(client,scope.workspaceId,scope.actorId,c.id);
 const rows=await reviewRows(client,scope.workspaceId);return {c,cached:currentAssessment(c,rows.assessments)};
}
prepareInternal.maxRetries=30;
export async function generateInternal(scope,snapshot){
 'use step';
 console.log('AI run: assessing Internal Review');
 if(snapshot.cached)return null;
 const client=await lease(scope);return triageReviews({cases:[snapshot.c],fetchImpl:createBudgetedFetch({client,workspaceId:scope.workspaceId,actorId:scope.actorId,feature:scope.kind,attemptPrefix:scope.leaseToken+':generation'}),signal:AbortSignal.timeout(45000)});
}
generateInternal.maxRetries=0;
export async function commitInternal(scope,snapshot,report){
 'use step';
 console.log('AI run: saving Internal Review');
 const client=await lease(scope),{cases}=await loadBriefing(client,scope.workspaceId,scope.actorId,{includeCorrespondence:true}),c=cases.find(c=>c.id===scope.requestId);
 if(!c||reviewFingerprint(c)!==scope.fingerprint)throw new FatalError('CASE_CHANGED');
 if(snapshot.cached)return {status:200,body:{assessment:snapshot.cached,reused:true}};
 const recommendation=report.items.find(item=>item.request_id===c.id);if(!recommendation)throw new FatalError('AI_INVALID_OUTPUT');
 const assessment=await saveAssessment(client,scope.workspaceId,scope.actorId,c,recommendation);return {status:200,body:{assessment,reused:false}};
}
export async function failDurable(scope,code){
 'use step';
 console.log('AI run: preserving interrupted run');
 if(scope.kind==='coordinator'){
  const client=await access(scope),store=await storeFor(scope,client);
  try{let analysis=store.analysis(scope.actorId,scope.requestId,scope.analysisRunId);if(analysis.status==='running'){analysis=store.finishAnalysis({actor_id:scope.actorId,request_id:scope.requestId,run_id:scope.analysisRunId,result:{ok:false,failed_stage:'intake',error:{code:'PROVIDER_FAILED'}}});await store.flush();}return {status:200,body:{...requestDetail(store,scope.requestId,scope.actorId),analysis_status:analysis.status}};}finally{store.dispose();}
 }
 const known={AI_INVALID_EVIDENCE:[422,'The AI assessment cited evidence that could not be verified against this case. No assessment was saved. Review the case and retry assessment.'],AI_INVALID_OUTPUT:[422,'The AI assessment did not match the required response format. No assessment was saved. Please retry assessment.'],AI_UNAVAILABLE:[503,'The AI provider could not complete this assessment. Saved results are retained. Please retry when ready.'],AI_ATTEMPT_UNCERTAIN:[503,'A previous AI attempt may have reached the provider. Check saved results before explicitly retrying.'],AI_USAGE_LIMIT:[429,'Your AI usage limit has been reached. Try again after it resets.'],AI_CONTEXT_TOO_LARGE:[422,'The full saved history is too large. No partial history was accepted.'],CASE_CHANGED:[409,'The case changed during AI work. Refresh before retrying.'],WORKSPACE_ACCESS_DENIED:[403,'Workspace access changed.']}[code.split(':')[0]];
 return {status:known?.[0]||503,body:{error:known?.[1]||'The AI run could not finish. Saved results are retained. Retry explicitly; no uncertain provider call was automatically repeated.'}};
}
export async function releaseDurable(scope){
 'use step';
 console.log('AI run: releasing reservation');
 const client=durableStorage();const {error}=await client.from('syncflow_analysis_leases').delete().eq('workspace_id',scope.workspaceId).eq('token',scope.leaseToken);if(error)throw Error('LEASE_RELEASE_FAILED');
}
