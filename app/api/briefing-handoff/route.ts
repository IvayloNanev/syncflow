import {workspaceSession,storageClient} from '../../../lib/supabase/server';
import {loadBriefing} from '../../../server/briefing-store.js';
import {briefingHandoff} from '../../../agents/priority/handoff.js';
export const runtime='nodejs';
const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
export async function GET(req:Request){
 const params=new URL(req.url).searchParams,request=params.get('request'),destination=params.get('destination');
 if(!request||!/^[0-9a-f-]{36}$/i.test(request)||!['coordinator','internal'].includes(destination||''))return json(400,{error:'Invalid handoff request.'});
 try{
  const session=await workspaceSession();if(!session?.workspaceId)return json(403,{error:'Workspace access required.'});
  const {supervision}=await loadBriefing(storageClient(),session.workspaceId,session.user.id);
  const current=await workspaceSession();if(current?.workspaceId!==session.workspaceId||current?.user.id!==session.user.id)return json(403,{error:'Workspace access changed.'});
  const handoff=briefingHandoff(supervision,request,destination);if(!handoff)return json(404,{error:'Request not found in this workspace.'});
  return json(200,{handoff});
 }catch{return json(503,{error:'Could not verify the briefing handoff. Review the current request before acting.'});}
}
