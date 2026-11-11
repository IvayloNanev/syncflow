import {enqueueAI} from '../../../server/durable-launch';
import {randomUUID} from 'node:crypto';
import {workspaceSession,storageClient} from '../../../lib/supabase/server';
import {requestOrigin} from '../../../server/request-origin.js';
import {loadBriefing} from '../../../server/briefing-store.js';
import {eligibleLanes} from '../../../agents/internal/triage.js';
import {caseListing,currentAssessment,reviewFingerprint,reviewListVersion} from '../../../agents/internal/lifecycle.js';
import {reviewRows,returnToCoordinator} from '../../../server/internal-review-store.js';
export const runtime='nodejs';
export const maxDuration=60;
const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
const uuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function POST(req:Request){
 const origin=requestOrigin(req);if(!origin||req.headers.get('origin')!==origin)return json(403,{error:'Use this app to assess a case.'});
 try{
 const input=await req.json();if(!input||Object.keys(input).some(key=>key!=='request_id')||!uuid(input.request_id))return json(400,{error:'Choose one saved case.'});
 const session=await workspaceSession();if(!session?.workspaceId)return json(403,{error:'Workspace access required.'});
 const client=storageClient(),workspace=session.workspaceId;
 const {cases}=await loadBriefing(client,workspace,session.user.id,{includeCorrespondence:true}),c=cases.find(c=>c.id===input.request_id);
 if(!c)return json(404,{error:'Request not found in this workspace.'});
 if(['Internal review complete','Case completed'].includes(c.workflow.status))return json(409,{error:'This case is complete. Its saved records remain available in Cases.'});
 if(!eligibleLanes(c).allowed.includes('manager'))return json(409,{error:'This case belongs to Coordinator. Open it there instead.'});
 const attempt=req.headers.get('x-syncflow-attempt'),attemptKey=uuid(attempt)?attempt as string:undefined,leaseToken=randomUUID();
 return json(202,await enqueueAI({kind:'internal_review',workspaceId:workspace,actorId:session.user.id,requestId:c.id,fingerprint:reviewFingerprint(c),leaseToken,attemptKey}));
 }catch{return json(503,{error:'Assessment could not be queued. Check the saved case before retrying.'});}

}
export async function GET(){
 try{
 const session=await workspaceSession();if(!session?.workspaceId)return json(403,{error:'Workspace access required.'});
 const client=storageClient(),{cases}=await loadBriefing(client,session.workspaceId,session.user.id,{includeCorrespondence:true}),rows=await reviewRows(client,session.workspaceId);
 const current=await workspaceSession();if(current?.workspaceId!==session.workspaceId||current?.user.id!==session.user.id)return json(403,{error:'Workspace access changed.'});
 const items=cases.map(c=>({...caseListing(c,currentAssessment(c,rows.assessments)),queued:eligibleLanes(c).allowed.includes('manager')&&rows.queue.some((row:{request_id:string;active:boolean})=>row.request_id===c.id&&row.active)&&!['Internal review complete','Case completed'].includes(c.workflow.status)}));
 return json(200,{cases:items,version:reviewListVersion(cases,rows),scope:`${session.user.id}:${session.workspaceId}`});
 }catch{return json(503,{error:'Saved cases could not load. Please refresh.'});}
}

export async function PATCH(req:Request){
 const origin=requestOrigin(req);if(!origin||req.headers.get('origin')!==origin)return json(403,{error:'Use this app to route a case.'});
 try{const input=await req.json();if(!uuid(input.request_id)||typeof input.fingerprint!=='string')return json(400,{error:'Invalid handoff.'});
 const session=await workspaceSession();if(!session?.workspaceId)return json(403,{error:'Workspace access required.'});
 const client=storageClient(),{cases}=await loadBriefing(client,session.workspaceId,session.user.id,{includeCorrespondence:true}),c=cases.find(c=>c.id===input.request_id);
 if(!c)return json(404,{error:'Case not found.'});if(reviewFingerprint(c)!==input.fingerprint)return json(409,{error:'This case changed. Refresh before routing.'});
 if(!eligibleLanes(c).allowed.includes('coordinator'))return json(409,{error:'This case requires Internal Review. It cannot also be routed to Coordinator.'});
 await returnToCoordinator(client,session.workspaceId,session.user.id,c);return json(200,{destination:'coordinator'});
 }catch{return json(409,{error:'Handoff could not be saved. Refresh this case and retry.'});}
}
