import {randomUUID} from 'node:crypto';
import {workspaceSession,storageClient} from '../../../lib/supabase/server';
import {requestOrigin} from '../../../server/request-origin.js';
import {loadBriefing} from '../../../server/briefing-store.js';
import {triageReviews} from '../../../agents/internal/triage.js';
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
  const {cases}=await loadBriefing(client,workspace,session.user.id);
  const open=cases.filter(c=>c.workflow.status!=='Internal review complete');
  if(open.length>50)return json(422,{error:'AI review supports up to 50 open cases. Completed cases remain available below.'});
  if(before!==await snapshot())return json(409,{error:'A case changed during review. Run the review again.'});
  const report=await triageReviews({cases:open,signal:AbortSignal.any([req.signal,AbortSignal.timeout(45000)])});
  if(before!==await snapshot())return json(409,{error:'A case changed during review. Run the review again.'});
  // Recheck access before returning private case text after a long model call.
  const current=await workspaceSession();if(current?.workspaceId!==workspace||current?.user.id!==session.user.id)return json(403,{error:'Workspace access changed. Refresh the dashboard.'});
  return json(200,{report,version:before});
 }catch(error){const code=error instanceof Error?error.message:'';console.error('Priority review failed', /^AI_[A-Z_]+$/.test(code)?code:error instanceof Error?error.name:'UNKNOWN');return json(code==='AI_CONTEXT_TOO_LARGE'?422:503,{error:code==='AI_NOT_CONFIGURED'?'AI review is not configured. You can still review client files below.':code==='AI_CONTEXT_TOO_LARGE'?'The saved histories are too large for one review. No partial review was generated.':'AI review could not finish. Try again or review client files below.'});}
 finally{if(reservation)await reservation.client.from('syncflow_analysis_leases').delete().eq('workspace_id',reservation.workspace).eq('token',reservation.token);}
}

export async function GET(){
 try{
  const session=await workspaceSession();if(!session?.workspaceId)return json(403,{error:'Workspace access required.'});
  const {data,error}=await storageClient().from('syncflow_requests').select('id,version').eq('workspace_id',session.workspaceId).order('id');
  if(error)throw Error('STORE_FAILED');
  return json(200,{version:JSON.stringify(data)});
 }catch{return json(503,{error:'Could not check current case versions.'});}
}
