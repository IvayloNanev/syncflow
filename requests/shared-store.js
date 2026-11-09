import {createHash} from 'node:crypto';
import {openRequestStore,RequestStoreError} from './store.js';
import {effectiveFields} from './effective-fields.js';
import {dashboardRequest} from './dashboard.js';

// One PostgreSQL row per request, not a workspace-wide lock or a database-file blob.
// The existing domain engine runs in temporary memory; only validated structured
// rows are persisted. This keeps its tested evidence/revision rules identical.
const mutations=new Set(['setCompleted','setDeleted','approveBrief','create','appendReply','changeRecording','decideProposal','beginAnalysis','finishAnalysis','recordReview','completeReview','saveHandoff']);
export function creationId(workspace,actor,key) {
 const h=createHash('sha256').update(JSON.stringify([workspace,actor,key])).digest('hex');
 return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
export async function openSharedStore({client,workspaceId,actorId,id}) {
 let version=0, engine, pending=[], lastMutationResult;
 const load=async()=>{
  const {data,error}=await client.from('syncflow_requests').select('state,version').eq('workspace_id',workspaceId).eq('id',id).maybeSingle();
  if(error)throw new RequestStoreError('STORE_FAILED');
  version=data?.version??0;
  engine?.close();engine=openRequestStore(':memory:',{ownerId:workspaceId,createId:id,initialState:data?.state??null});
 };
 await load();
 const summary=()=>{
  const r=engine.get(actorId,id);
  r.agent_fields=effectiveFields(r,engine.activeAnalysis(actorId,id),engine.decisions(actorId,id)).filter(f=>f.origin==='agent');
  return {...dashboardRequest(r,engine.workflow(actorId,id),engine.reviewers(actorId,id)),id:r.id,revision:r.revision,created_at:r.created_at,updated_at:r.updated_at,message_count:r.messages.length,preview:r.messages[0].text.slice(0,100),recording_id:r.recording_id??null};
 };
 const api={
  async refresh(){if(pending.length)throw new RequestStoreError('STORE_FAILED');await load();},
  async currentRevision(){
   const {data,error}=await client.from('syncflow_requests').select('dashboard').eq('workspace_id',workspaceId).eq('id',id).single();
   if(error)throw new RequestStoreError('NOT_FOUND');return data.dashboard.revision;
  },
  async flush(){
   if(!pending.length)return;
   for(let attempt=0;attempt<3;attempt++){
    const {data,error}=await client.rpc('syncflow_commit_request',{p_workspace:workspaceId,p_actor:actorId,p_id:id,p_expected:version,p_state:engine.exportState(),p_dashboard:summary()});
    if(!error){version=data;pending=[];return lastMutationResult;}
    if(!error.message?.includes('STORAGE_CONFLICT'))throw new RequestStoreError(error.message?.includes('WORKSPACE_ACCESS_DENIED')?'ACCESS_DENIED':'STORE_FAILED');
    await load();
    // Reapply commands against the latest saved revision. Idempotent retries replay;
    // stale revisions fail rather than overwriting a teammate's work.
    for(const [method,args] of pending)lastMutationResult=engine[method](...args);
   }
   throw new RequestStoreError('REVISION_CONFLICT');
  },
  close(){/* Handler closes before the outer transaction flush; dispose owns lifetime. */},
  dispose(){engine?.close();},
 };
 return /** @type {ReturnType<typeof openRequestStore> & typeof api} */ (new Proxy(api,{get(target,key){if(key in target)return target[key];if(typeof engine[key]!=='function')return undefined;return (...args)=>{
  const actor=typeof args[0]==='string'?args[0]:args[0]?.actor_id;
  if(actor!==actorId)throw new RequestStoreError('INVALID_ACTOR');
  const result=engine[key](...args);if(mutations.has(key)){pending.push([key,structuredClone(args)]);lastMutationResult=result;}return result;
 };}}));
}
export async function listSharedRequests(client,workspaceId,includeDeleted=false){
 const results=[];
 for(let from=0;;from+=100){
  const {data,error}=await client.from('syncflow_requests').select('id,dashboard').eq('workspace_id',workspaceId).order('updated_at',{ascending:false}).order('id').range(from,from+99);
  if(error)throw new RequestStoreError('STORE_FAILED');results.push(...data.filter(r=>includeDeleted||!r.dashboard.deleted_at).map(r=>{
   const summary={...r.dashboard,id:r.id};
   // Older persisted summaries must not bypass the newly required human gate.
   if(summary.brief_policy!=='coordinator-signoff-v1'&&['Ready for internal review','Internal review pending','Ready to complete internal review','Internal review complete'].includes(summary.status))return {...summary,status:'Needs coordinator review',next_action:'Open the request, check its current analysis and approve the brief before internal review.',blocker:'Current coordinator sign-off required.'};
   return summary;
  }));if(data.length<100)return results;
 }
}
