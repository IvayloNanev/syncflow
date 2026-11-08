import {randomUUID} from 'node:crypto';
import {workspaceSession,storageClient} from '../../../lib/supabase/server';
import {requestOrigin} from '../../../server/request-origin.js';
import {openSharedStore,listSharedRequests} from '../../../requests/shared-store.js';
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
  let requests=await listSharedRequests(client,workspace),review=reviewPriorities(requests);
  if(!review.recommendation)return json(200,{report:null,review});
  if(requests.length>50)return json(422,{error:'AI review currently supports up to 50 saved cases. No partial review was generated.'});
  const token=randomUUID();const {data:acquired,error:leaseError}=await client.rpc('syncflow_acquire_analysis',{p_workspace:workspace,p_actor:session.user.id,p_token:token});
  if(leaseError||!acquired)return json(429,{error:'A workspace analysis is running. Try again when it finishes.'});
  reservation={client,workspace,token};
  const snapshot=async()=>{const {data,error}=await client.from('syncflow_requests').select('id,version').eq('workspace_id',workspace).order('id');if(error)throw new Error('STORE_FAILED');return JSON.stringify(data);};
  const before=await snapshot();
  requests=await listSharedRequests(client,workspace);review=reviewPriorities(requests);
  if(requests.length>50)return json(422,{error:'AI review currently supports up to 50 saved cases.'});
  if(!review.recommendation)return json(200,{report:null,review});
  const cases=[];
  for(const r of requests){const store=await openSharedStore({client,workspaceId:workspace,actorId:session.user.id,id:r.id});try{const saved=store.get(session.user.id,r.id);cases.push({id:r.id,summary:r,messages:saved.messages,workflow:store.workflow(session.user.id,r.id),reviewers:store.reviewers(session.user.id,r.id),handoff:store.handoff(session.user.id,r.id)});}finally{store.dispose();}}
  if(before!==await snapshot())return json(409,{error:'A case changed during review. Run the review again.'});
  const report=await draftPriorityReport({review,cases,signal:AbortSignal.any([req.signal,AbortSignal.timeout(45000)])});
  if(before!==await snapshot())return json(409,{error:'A case changed during review. Run the review again.'});
  // Recheck access before returning private case text after a long model call.
  const current=await workspaceSession();if(current?.workspaceId!==workspace||current?.user.id!==session.user.id)return json(403,{error:'Workspace access changed. Refresh the dashboard.'});
  return json(200,{report,review});
 }catch(error){const code=error instanceof Error?error.message:'';console.error('Priority review failed', /^AI_[A-Z_]+$/.test(code)?code:error instanceof Error?error.name:'UNKNOWN');return json(code==='AI_CONTEXT_TOO_LARGE'?422:503,{error:code==='AI_NOT_CONFIGURED'?'AI review is not configured. You can still review client files below.':code==='AI_CONTEXT_TOO_LARGE'?'The saved histories are too large for one review. No partial review was generated.':'AI review could not finish. Try again or review client files below.'});}
 finally{if(reservation)await reservation.client.from('syncflow_analysis_leases').delete().eq('workspace_id',reservation.workspace).eq('token',reservation.token);}
}
