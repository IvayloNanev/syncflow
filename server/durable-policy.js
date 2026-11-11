// Only persisted domain run IDs identify Coordinator work. Legacy inline runs
// must never be silently resubmitted after a disconnect.
export const coordinatorRunToken=(workspace,run)=>`syncflow:coordinator:${workspace}:${run}`;
export function isDurableAnalysis(run){return run?.execution_mode==='durable';}
export function mayResumeCoordinator(request,analysis,latest,canRun){
 return !request.deleted_at&&analysis.status==='running'&&analysis.base_revision===request.revision&&latest?.run_id===analysis.run_id&&canRun;
}

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function validateAIScope(scope){
 if(!scope||!['coordinator','daily_brief','internal_review'].includes(scope.kind)||!['workspaceId','actorId','leaseToken'].every(k=>uuid.test(scope[k]||'')))throw Error('INVALID_AI_SCOPE');
 if(scope.attemptKey!==undefined&&!uuid.test(scope.attemptKey))throw Error('INVALID_AI_SCOPE');
 if(scope.kind!=='daily_brief'&&!uuid.test(scope.requestId||''))throw Error('INVALID_AI_SCOPE');
 if(scope.kind==='coordinator'&&!uuid.test(scope.analysisRunId||''))throw Error('INVALID_AI_SCOPE');
 if(scope.kind==='internal_review'&&(typeof scope.fingerprint!=='string'||! /^[a-f0-9]{64}$/.test(scope.fingerprint)))throw Error('INVALID_AI_SCOPE');
 return scope;
}
