import { runWorkflow } from '../agents/workflow/run-workflow.js';

/** Trusted local caller only. Run outside the transaction; activation compares saved revision atomically. */
export async function analyzeSavedRequest(store, command, providers) {
  const started=store.beginAnalysis(command);
  if(started.replayed)return {replayed:true,analysis:started.analysis};
  const {analysis}=started;
  let result;
  try {
    result=await runWorkflow(analysis.context,{...providers,
      getCurrentVersion:async()=>store.get(command.actor_id,command.request_id).revision});
  } catch { result={ok:false,failed_stage:'intake'}; }
  return {replayed:false,analysis:store.finishAnalysis({actor_id:command.actor_id,request_id:command.request_id,run_id:analysis.run_id,result})};
}
