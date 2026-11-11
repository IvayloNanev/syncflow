import {getHookByToken,getRun} from 'workflow/api';
import {HookNotFoundError} from 'workflow/errors';
import {enqueueAI} from './durable-launch';
import {coordinatorRunToken,isDurableAnalysis} from './durable-policy.js';
import type {openSharedStore} from '../requests/shared-store.js';
export async function reconcileCoordinator(store:Awaited<ReturnType<typeof openSharedStore>>,workspaceId:string,actorId:string,requestId:string){
 const latest=store.analyses(actorId,requestId).at(-1);
 if(!latest||latest.status!=='running'||!isDurableAnalysis(latest))return;
 let runId:string;
 try{runId=(await getHookByToken(coordinatorRunToken(workspaceId,latest.run_id))).runId;}
 catch(error){
  if(!HookNotFoundError.is(error))throw error;
  // A recently persisted run can be left between its DB commit and queue dispatch.
  // The atomic start token prevents a duplicate if the first dispatch was uncertain.
  if(Date.now()-Date.parse(String(latest.created_at))<60000){await enqueueAI({kind:'coordinator',workspaceId,actorId:typeof latest.started_by==='string'?latest.started_by:actorId,requestId,analysisRunId:String(latest.run_id),leaseToken:String(latest.run_id)});return;}
  await fail();return;
 }
 const status=await getRun(runId).status;
 if(status==='failed'||status==='cancelled')await fail();
 else if(status==='completed'){await store.refresh();if(store.analysis(actorId,requestId,String(latest.run_id)).status==='running')await fail();}
 async function fail(){store.finishAnalysis({actor_id:actorId,request_id:requestId,run_id:latest!.run_id,result:{ok:false,failed_stage:'intake',error:{code:'PROVIDER_FAILED'}}});await store.flush();}
}
