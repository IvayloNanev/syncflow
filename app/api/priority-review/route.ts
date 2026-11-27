import {randomUUID} from 'node:crypto';
import {workspaceSession,storageClient} from '../../../lib/supabase/server';
import {requestOrigin} from '../../../server/request-origin.js';
import {loadBriefing} from '../../../server/briefing-store.js';
import {enqueueAI} from '../../../server/durable-launch';
export const runtime='nodejs';
export const maxDuration=60;
const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
export async function POST(req:Request){
 const origin=requestOrigin(req);if(!origin||req.headers.get('origin')!==origin)return json(403,{error:'Use the dashboard to run a review.'});
 try{const session=await workspaceSession();if(!session?.workspaceId)return json(403,{error:'Workspace access required.'});
 const attempt=req.headers.get('x-syncflow-attempt');const attemptKey=attempt&&/^[a-f0-9-]{36}$/i.test(attempt)?attempt:undefined,leaseToken=randomUUID();
 return json(202,await enqueueAI({kind:'daily_brief',workspaceId:session.workspaceId,actorId:session.user.id,leaseToken,attemptKey}));
 }catch(error){if(error instanceof Error&&error.message==='DEMO_USAGE_LIMIT')return json(429,{error:'This guest session has reached its AI run limit. Exit the demo and sign in to continue.'});return json(503,{error:'AI review could not be queued. Check saved results before retrying.'});}
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
