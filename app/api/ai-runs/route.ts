import {getRun} from 'workflow/api';
import {workspaceSession} from '../../../lib/supabase/server';
import {requestOrigin} from '../../../server/request-origin.js';
import {verifyRunAccess} from '../../../server/ai-run-token.js';
export const runtime='nodejs';
const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'private, no-store'}});
export async function POST(req:Request){
 const origin=requestOrigin(req);if(!origin||req.headers.get('origin')!==origin)return json(403,{error:'Use this app to check AI progress.'});
 try{
  const session=await workspaceSession();if(!session?.workspaceId)return json(403,{error:'Workspace access required.'});
  if(Number(req.headers.get('content-length'))>3000)return json(400,{error:'Invalid run token.'});
  const reader=req.body?.getReader();let raw='',size=0;const decoder=new TextDecoder();
  if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>3000){await reader.cancel();return json(400,{error:'Invalid run token.'});}raw+=decoder.decode(value,{stream:true});}}finally{reader.releaseLock();}
  const input=JSON.parse(raw+decoder.decode());const runId=verifyRunAccess(input?.run_token,session.workspaceId);if(!runId)return json(404,{error:'AI run not found in this workspace.'});
  const run=getRun<{status:number;body:unknown}>(runId),status=await run.status;
  const result=status==='completed'?await run.returnValue:undefined;
  const current=await workspaceSession();if(current?.workspaceId!==session.workspaceId||current?.user.id!==session.user.id)return json(403,{error:'Workspace access changed.'});
  return json(200,{status,...(result?{result}:{})});
 }catch{return json(503,{error:'AI progress could not refresh. Background work may still be running; check saved results before retrying.'});}
}
