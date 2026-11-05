import { reviewRecording } from '../catalog/review.js';
import { runWorkflow } from '../agents/workflow/run-workflow.js';

/** Trusted local caller only. Run outside the transaction; activation compares saved revision atomically. */
export async function analyzeSavedRequest(store, command, providers) {
  const attempted=store.beginAnalysis(command);
  const started=(await store.flush?.()) ?? attempted;
  const catalog_review = reviewRecording(store.get(command.actor_id, command.request_id).recording_id);
  if(started.replayed)return {replayed:true,analysis:started.analysis,catalog_review};
  const {analysis}=started;
  let result;
  try {
    result=await runWorkflow(analysis.context,{...providers,
      getCurrentVersion:async()=>store.currentRevision ? store.currentRevision() : store.get(command.actor_id,command.request_id).revision});
  } catch { result={ok:false,failed_stage:'intake'}; }
  await store.refresh?.();
  return {replayed:false,catalog_review,analysis:store.finishAnalysis({actor_id:command.actor_id,request_id:command.request_id,run_id:analysis.run_id,result})};
}
