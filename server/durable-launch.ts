import {start,getRun} from 'workflow/api';
import {HookConflictError,WorkflowStartError} from 'workflow/errors';
import {durableAI,type AIScope} from '../workflows/ai';
import {signRunAccess} from './ai-run-token.js';
import {coordinatorRunToken,validateAIScope} from './durable-policy.js';
export function durableToken(scope:AIScope){return scope.kind==='coordinator'?coordinatorRunToken(scope.workspaceId,scope.analysisRunId):`syncflow:${scope.kind}:${scope.workspaceId}:${scope.actorId}:${scope.attemptKey||scope.leaseToken}:${scope.requestId||''}:${scope.fingerprint||''}`;}
export async function enqueueAI(scope:AIScope){
 validateAIScope(scope);
 let runId:string|undefined;
 try{runId=(await start(durableAI,[scope],{experimental_hook:{token:durableToken(scope),experimental_minRetention:'7 days'}})).runId;}
 catch(error){if(HookConflictError.is(error))runId=error.conflictingRunId;else if(WorkflowStartError.is(error))runId=error.runId;else throw error;}
 if(!runId)throw Error('AI_RUN_NOT_QUEUED');
 return {run_token:signRunAccess({runId,workspaceId:scope.workspaceId}),execution_mode:'durable',analysis_status:'running'};
}
export {getRun};
