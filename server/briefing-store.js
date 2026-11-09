import {openSharedStore,listSharedRequests} from '../requests/shared-store.js';
import {effectiveFields} from '../requests/effective-fields.js';
import {reviewRecording} from '../catalog/review.js';
import {superviseCases} from '../agents/priority/supervisor.js';
export async function loadBriefing(client,workspaceId,actorId){
 const {data:saved,error}=await client.from('syncflow_briefings').select('report,snapshots,generated_at').eq('workspace_id',workspaceId).maybeSingle();
 if(error)throw new Error('BRIEFING_STORAGE_FAILED');
 const snapshot=async()=>{const {data,error}=await client.from('syncflow_requests').select('id,version').eq('workspace_id',workspaceId).order('id');if(error)throw new Error('STORE_FAILED');return JSON.stringify(data);};
 const before=await snapshot();
 const summaries=await listSharedRequests(client,workspaceId);
 const cases=[];
 // Bounded batches avoid opening an unbounded number of SQLite engines/connections.
 for(let from=0;from<summaries.length;from+=8){
  const batch=await Promise.allSettled(summaries.slice(from,from+8).map(async summary=>{
   const store=await openSharedStore({client,workspaceId,actorId,id:summary.id});
   try{return briefingCase(store,actorId,summary,JSON.parse(before).find(row=>row.id===summary.id)?.version);}finally{store.dispose();}
  }));
  for(const result of batch){if(result.status==='rejected')throw result.reason;cases.push(result.value);}
 }
 if(before!==await snapshot())throw new Error('BRIEFING_CHANGED');
 return {cases,saved,supervision:superviseCases(cases,saved)};
}
export async function saveBriefing(client,workspaceId,actorId,report,snapshots){
 const generated_at=report?.generated_at||new Date().toISOString();
 const {error}=await client.from('syncflow_briefings').upsert({workspace_id:workspaceId,report,snapshots,generated_at,generated_by:actorId},{onConflict:'workspace_id'});
 if(error)throw new Error('BRIEFING_STORAGE_FAILED');
 return {report,snapshots,generated_at};
}

export function briefingCase(store,actorId,summary,storageVersion){const request=store.get(actorId,summary.id),analysis=store.activeAnalysis(actorId,summary.id);return {id:request.id,revision:request.revision,storage_version:storageVersion,summary,messages:request.messages,subject:request.messages[0]?.text.match(/^Subject: (.+)$/m)?.[1],recording_id:request.recording_id,confirmed_fields:request.confirmed_fields,agent_fields:effectiveFields(request,analysis,store.decisions(actorId,summary.id)).filter(f=>f.origin==='agent'),analysis,catalogue_assessment:analysis?.result?.catalogue_assessment||analysis?.result?.stages?.review?.output?.catalogue_assessment||reviewRecording(request.recording_id),workflow:store.workflow(actorId,request.id),reviewers:store.reviewers(actorId,request.id),handoff:store.handoff(actorId,request.id)};}
