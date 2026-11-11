import {prepareCoordinator,intakeCoordinator,completeCoordinator,commitCoordinator,prepareBriefing,generateBriefing,commitBriefing,prepareInternal,generateInternal,commitInternal,failDurable,releaseDurable} from '../server/durable-steps.js';
export type AIScope={kind:'coordinator'|'daily_brief'|'internal_review';workspaceId:string;actorId:string;leaseToken:string;attemptKey?:string;requestId?:string;analysisRunId?:string;fingerprint?:string};
export async function durableAI(scope:AIScope){
 'use workflow';
 console.log('AI workflow started',scope.kind);
 try{
  if(scope.kind==='coordinator'){
   const context=await prepareCoordinator(scope);const intake=await intakeCoordinator(scope,context);
   const result=await completeCoordinator(scope,context,intake);return await commitCoordinator(scope,result);
  }
  if(scope.kind==='daily_brief'){
   const snapshot=await prepareBriefing(scope);const report=await generateBriefing(scope,snapshot);return await commitBriefing(scope,snapshot,report);
  }
  const snapshot=await prepareInternal(scope);const report=await generateInternal(scope,snapshot);return await commitInternal(scope,snapshot,report);
 }catch(error){return await failDurable(scope,error instanceof Error?error.message:'AI_RUN_FAILED');}
 finally{try{await releaseDurable(scope);}catch{console.warn('AI reservation cleanup deferred to lease expiry');}}
}
