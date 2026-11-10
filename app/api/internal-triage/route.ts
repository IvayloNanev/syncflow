import {randomUUID} from 'node:crypto';
import {workspaceSession,storageClient} from '../../../lib/supabase/server';
import {requestOrigin} from '../../../server/request-origin.js';
import {loadBriefing} from '../../../server/briefing-store.js';
import {triageReviews,eligibleLanes} from '../../../agents/internal/triage.js';
import {caseListing,currentAssessment,reviewFingerprint,reviewListVersion} from '../../../agents/internal/lifecycle.js';
import {admitReview,assessOnce,reviewRows,returnToCoordinator} from '../../../server/internal-review-store.js';
export const runtime='nodejs';
export const maxDuration=60;
const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function POST(req:Request){
 const origin=requestOrigin(req);if(!origin||req.headers.get('origin')!==origin)return json(403,{error:'Use this app to assess a case.'});
 let reservation:{client:ReturnType<typeof storageClient>;workspace:string;token:string}|null=null;
 try{
 const input=await req.json();if(!input||Object.keys(input).some(key=>key!=='request_id')||!uuid(input.request_id))return json(400,{error:'Choose one saved case.'});
 const session=await workspaceSession();if(!session?.workspaceId)return json(403,{error:'Workspace access required.'});
 const client=storageClient(),workspace=session.workspaceId,token=randomUUID();
 const {data:acquired,error}=await client.rpc('syncflow_acquire_analysis',{p_workspace:workspace,p_actor:session.user.id,p_token:token});
 if(error||!acquired)return json(429,{error:'An assessment is already running. Your case is unchanged; retry shortly.'});
 reservation={client,workspace,token};
 const {cases}=await loadBriefing(client,workspace,session.user.id),c=cases.find(c=>c.id===input.request_id);
 if(!c)return json(404,{error:'Request not found in this workspace.'});
 if(['Internal review complete','Case completed'].includes(c.workflow.status))return json(409,{error:'This case is complete. Its saved records remain available in Cases.'});
 if(!eligibleLanes(c).allowed.includes('manager'))return json(409,{error:'This case belongs to Coordinator. Open it there instead.'});
 await admitReview(client,workspace,session.user.id,c.id);
 const result=await assessOnce({client,workspace,actor:session.user.id,c,generate:async()=>triageReviews({cases:[c],signal:AbortSignal.any([req.signal,AbortSignal.timeout(45000)])})});
 const current=await workspaceSession();if(current?.workspaceId!==workspace||current?.user.id!==session.user.id)return json(403,{error:'Workspace access changed.'});
 const {cases:latest}=await loadBriefing(client,workspace,session.user.id),fresh=latest.find(item=>item.id===c.id);
 if(!fresh||!currentAssessment(fresh,[{request_id:c.id,...result.assessment,result:result.assessment}]))return json(409,{error:'This case changed during assessment. Check the updated context before reassessing.'});
 return json(200,result);
 }catch(error){const code=error instanceof Error?error.message:'';return json(code==='REVIEW_CHANGED'?409:503,{error:code==='AI_NOT_CONFIGURED'?'AI review is not configured. Saved case files remain available.':code==='REVIEW_CHANGED'?'The case changed. Reload its context before reassessing.':'Assessment could not finish. Your context and case files are preserved; please retry.'});}
 finally{if(reservation)await reservation.client.from('syncflow_analysis_leases').delete().eq('workspace_id',reservation.workspace).eq('token',reservation.token);}
}
export async function GET(){
 try{
 const session=await workspaceSession();if(!session?.workspaceId)return json(403,{error:'Workspace access required.'});
 const client=storageClient(),{cases}=await loadBriefing(client,session.workspaceId,session.user.id),rows=await reviewRows(client,session.workspaceId);
 const current=await workspaceSession();if(current?.workspaceId!==session.workspaceId||current?.user.id!==session.user.id)return json(403,{error:'Workspace access changed.'});
 const items=cases.map(c=>({...caseListing(c,currentAssessment(c,rows.assessments)),queued:eligibleLanes(c).allowed.includes('manager')&&rows.queue.some((row:{request_id:string;active:boolean})=>row.request_id===c.id&&row.active)&&!['Internal review complete','Case completed'].includes(c.workflow.status)}));
 return json(200,{cases:items,version:reviewListVersion(cases,rows),scope:`${session.user.id}:${session.workspaceId}`});
 }catch{return json(503,{error:'Saved cases could not load. Please refresh.'});}
}

export async function PATCH(req:Request){
 const origin=requestOrigin(req);if(!origin||req.headers.get('origin')!==origin)return json(403,{error:'Use this app to route a case.'});
 try{const input=await req.json();if(!uuid(input.request_id)||typeof input.fingerprint!=='string')return json(400,{error:'Invalid handoff.'});
 const session=await workspaceSession();if(!session?.workspaceId)return json(403,{error:'Workspace access required.'});
 const client=storageClient(),{cases}=await loadBriefing(client,session.workspaceId,session.user.id),c=cases.find(c=>c.id===input.request_id);
 if(!c)return json(404,{error:'Case not found.'});if(reviewFingerprint(c)!==input.fingerprint)return json(409,{error:'This case changed. Refresh before routing.'});
 if(!eligibleLanes(c).allowed.includes('coordinator'))return json(409,{error:'This case requires Internal Review. It cannot also be routed to Coordinator.'});
 await returnToCoordinator(client,session.workspaceId,session.user.id,c);return json(200,{destination:'coordinator'});
 }catch{return json(409,{error:'Handoff could not be saved. Refresh this case and retry.'});}
}
