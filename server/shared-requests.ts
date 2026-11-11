import {createBudgetedFetch} from './ai-usage.js';
import {createClaudeProvider} from '../agents/intake/providers/claude.js';
import {createFollowUpClaudeProvider} from '../agents/follow-up/providers/claude.js';
import {reviewPriorities} from '../agents/priority/review.js';
import {requestOrigin} from './request-origin.js';
import {randomUUID} from 'node:crypto';
import {sharedConfigured,storageClient,workspaceSession} from '../lib/supabase/server';
import {createSavedRequestsHandler,requestDetail} from './saved-requests.js';
import {creationId,openSharedStore,listSharedRequests} from '../requests/shared-store.js';
const local=createSavedRequestsHandler();
const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
export async function sharedRequests(req:Request){
 if(!sharedConfigured())return local(req);
 const origin=requestOrigin(req);
 if(!origin||req.headers.get('origin')!==origin)return json(403,{error:{code:'ORIGIN_REJECTED',message:'Use this app to submit changes.'}});
 let lease:{client:ReturnType<typeof storageClient>;workspace:string;token:string}|undefined;
 let store:Awaited<ReturnType<typeof openSharedStore>>|undefined;
 try{
  const session=await workspaceSession();if(!session)return json(401,{error:{code:'SIGN_IN_REQUIRED',message:'Sign in to continue.'}});
  if(!session.workspaceId)return json(403,{error:{code:'WORKSPACE_REQUIRED',message:'Your account needs a workspace membership.'}});
  const client=storageClient();
  // Bounded read before selecting a request. Domain handler independently validates command fields.
  if(Number(req.headers.get('content-length'))>100000)return json(413,{error:{message:'Request is too large.'}});
  const reader=req.body?.getReader();let raw='';let size=0;const decoder=new TextDecoder();
  if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>100000){await reader.cancel();return json(413,{error:{message:'Request is too large.'}});}raw+=decoder.decode(value,{stream:true});}}finally{reader.releaseLock();}
  raw+=decoder.decode();
  let input;try{input=JSON.parse(raw);}catch{return json(400,{error:{message:'Invalid JSON.'}});}
  if(input?.action==='list'&&Object.keys(input).every(key=>['action','include_deleted'].includes(key))){const requests=await listSharedRequests(client,session.workspaceId,input.include_deleted===true);return json(200,{requests,priority_review:reviewPriorities(requests.filter(r=>!r.deleted_at))});}
  const id=input?.action==='create'?creationId(session.workspaceId,session.user.id,input.idempotency_key):input?.request_id;
  if(typeof id!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return json(400,{error:{message:'Invalid request.'}});
  store=await openSharedStore({client,workspaceId:session.workspaceId,actorId:session.user.id,id});
  if(input.action==='analyze'){
   const token=randomUUID();const {data,error}=await client.rpc('syncflow_acquire_analysis',{p_workspace:session.workspaceId,p_actor:session.user.id,p_token:token});
   if(error)throw new Error('Unable to reserve analysis');
   if(!data)return json(429,{error:{code:'BUSY',message:'Your team has an analysis running. Wait, then reopen the request.'}});
   lease={client,workspace:session.workspaceId,token};
  }
  const handler=createSavedRequestsHandler({actor:session.user.id,trustedOrigin:origin,enabled:()=>true,openStore:()=>store!,providers:()=>{const fetchImpl=createBudgetedFetch({client,workspaceId:session.workspaceId,actorId:session.user.id,feature:'coordinator'});return {intakeProvider:createClaudeProvider({fetchImpl}),followUpProvider:createFollowUpClaudeProvider({fetchImpl})};}});
  const response=await handler(new Request(req.url,{method:'POST',headers:req.headers,body:raw}));
  if(!response.ok)return response;
  const committed=await store.flush();
  // A concurrent retry may have replayed at flush: return the authoritative state.
  const result=await response.json();
  const replayed=committed&&'replayed' in committed?committed.replayed:result.replayed;
  return json(input.action==='create'&&replayed?200:response.status,{...result,...requestDetail(store,id,session.user.id),...(replayed!==undefined?{replayed}:{}),...(input.action==='analyze'&&committed?.status?{analysis_status:committed.status}:{})});
 }catch(error){
  const code=(error as {code?:string}).code;
  return json(code==='NOT_FOUND'?404:code==='ACCESS_DENIED'?403:code?.endsWith('CONFLICT')?409:500,{error:{code:code||'REQUEST_FAILED',message:code?.endsWith('CONFLICT')?'This request changed. Reopen it before retrying.':'Unable to complete the request. Saved history is retained.'}});
 }finally{store?.dispose();if(lease)await lease.client.from('syncflow_analysis_leases').delete().eq('workspace_id',lease.workspace).eq('token',lease.token);}
}
