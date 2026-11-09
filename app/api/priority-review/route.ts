import {randomUUID} from 'node:crypto';
import {workspaceSession,storageClient} from '../../../lib/supabase/server';
import {requestOrigin} from '../../../server/request-origin.js';
import {loadBriefing,saveBriefing} from '../../../server/briefing-store.js';
import {superviseCases} from '../../../agents/priority/supervisor.js';
import {reviewPriorities} from '../../../agents/priority/review.js';
import {draftPriorityReport} from '../../../agents/priority/ai-review.js';
export const runtime='nodejs';
export const maxDuration=60;
const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
export async function POST(req:Request){
 const origin=requestOrigin(req);if(!origin||req.headers.get('origin')!==origin)return json(403,{error:'Use the dashboard to run a review.'});
 let reservation:{client:ReturnType<typeof storageClient>;workspace:string;token:string}|null=null;
 try{
  const session=await workspaceSession();if(!session)return json(401,{error:'Sign in to review cases.'});if(!session.workspaceId)return json(403,{error:'Workspace access required.'});
  const client=storageClient(),workspace=session.workspaceId;
  const token=randomUUID();const {data:acquired,error:leaseError}=await client.rpc('syncflow_acquire_analysis',{p_workspace:workspace,p_actor:session.user.id,p_token:token});
  if(leaseError||!acquired)return json(429,{error:'A workspace analysis is running. Try again when it finishes.'});
  reservation={client,workspace,token};
  const snapshot=async()=>{const {data,error}=await client.from('syncflow_requests').select('id,version').eq('workspace_id',workspace).order('id');if(error)throw new Error('STORE_FAILED');return JSON.stringify(data);};
  const before=await snapshot();
  const {cases,supervision}=await loadBriefing(client,workspace,session.user.id);
  const open=cases.filter(c=>!['Internal review complete','Case completed'].includes(c.workflow.status));
  const review=reviewPriorities(cases.map(c=>({...c.summary,status:c.workflow.status})));
  if(open.length>50)return json(422,{error:'AI review supports up to 50 open cases. Completed cases remain available below.'});
  if(before!==await snapshot())return json(409,{error:'A case changed during review. Run the review again.'});
  const report=open.length?await draftPriorityReport({review,cases:open,signal:AbortSignal.any([req.signal,AbortSignal.timeout(45000)])}):null;
  if(before!==await snapshot())return json(409,{error:'A case changed during review. Run the review again.'});
  // Recheck access before returning private case text after a long model call.
  const current=await workspaceSession();if(current?.workspaceId!==workspace||current?.user.id!==session.user.id)return json(403,{error:'Workspace access changed. Refresh the dashboard.'});
  const saved=await saveBriefing(client,workspace,session.user.id,report,supervision.snapshots);
  return json(200,{report,review,supervision:superviseCases(cases,saved)});
 }catch(error){const code=error instanceof Error?error.message:'';console.error('Priority review failed', /^AI_[A-Z_]+$/.test(code)?code:error instanceof Error?error.name:'UNKNOWN');return json(code==='AI_CONTEXT_TOO_LARGE'?422:503,{error:code==='AI_NOT_CONFIGURED'?'AI review is not configured. You can still review client files below.':code==='AI_CONTEXT_TOO_LARGE'?'The saved histories are too large for one review. No partial review was generated.':'AI review could not finish. Try again or review client files below.'});}
 finally{if(reservation)await reservation.client.from('syncflow_analysis_leases').delete().eq('workspace_id',reservation.workspace).eq('token',reservation.token);}
}

export async function GET(){
 try{
  const session=await workspaceSession();
  if(!session)return json(401,{error:'Sign in to view the briefing.'});
  if(!session.workspaceId)return json(403,{error:'Workspace access required.'});
  const {supervision}=await loadBriefing(storageClient(),session.workspaceId,session.user.id);
  const current=await workspaceSession();
  if(current?.workspaceId!==session.workspaceId||current?.user.id!==session.user.id)return json(403,{error:'Workspace access changed. Refresh the page.'});
  return json(200,{supervision});
 }catch{return json(503,{error:'The briefing could not refresh. Previously displayed information may be out of date.'});}
}
