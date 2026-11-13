import {reserveDemo} from './demo-policy.js';
import {reconcileCoordinator} from './durable-recovery';
import {enqueueAI} from './durable-launch';
import {storedRoutingCase,canRunCoordinator} from './case-routing-policy.js';
import {createBudgetedFetch} from './ai-usage.js';
import {createClaudeProvider} from '../agents/intake/providers/claude.js';
import {createFollowUpClaudeProvider} from '../agents/follow-up/providers/claude.js';
import {reviewPriorities} from '../agents/priority/review.js';
import {requestOrigin} from './request-origin.js';
import {sharedConfigured,storageClient,workspaceSession} from '../lib/supabase/server';
import {createSavedRequestsHandler,requestDetail} from './saved-requests.js';
import {creationId,openSharedStore,listSharedRequests} from '../requests/shared-store.js';
const local=createSavedRequestsHandler();
const json=(status:number,body:unknown)=>Response.json(body,{status,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
export async function sharedRequests(req:Request){
 if(!sharedConfigured())return local(req);
 const origin=requestOrigin(req);
 if(!origin||req.headers.get('origin')!==origin)return json(403,{error:{code:'ORIGIN_REJECTED',message:'Use this app to submit changes.'}});
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
  if(session.demo&&!['list','get'].includes(input?.action)&&!await reserveDemo(client,session.workspaceId,session.user.id,input?.action==='create'?'create':'command',typeof input?.idempotency_key==='string'?input.idempotency_key:'invalid'))return json(429,{error:{code:'DEMO_LIMIT',message:'This guest workspace has reached its change limit. Sign in to keep working.'}});
  const id=input?.action==='create'?creationId(session.workspaceId,session.user.id,input.idempotency_key):input?.request_id;
  if(typeof id!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return json(400,{error:{message:'Invalid request.'}});
  store=await openSharedStore({client,workspaceId:session.workspaceId,actorId:session.user.id,id});
  if(input.action==='get')await reconcileCoordinator(store,session.workspaceId,session.user.id,id);
  if(input.action==='analyze'){
   if(Object.keys(input).some(key=>!['action','request_id','expected_revision','idempotency_key'].includes(key)))return json(400,{error:{code:'INVALID_INPUT',message:'Invalid analysis command.'}});
   if(!canRunCoordinator(storedRoutingCase(store,session.user.id,id)))return json(409,{error:{code:'WRONG_AGENT',message:'Open this case in its assigned agent.'}});
   const attempted=store.beginAnalysis({actor_id:session.user.id,request_id:id,expected_revision:input.expected_revision,idempotency_key:input.idempotency_key,execution_mode:'durable'});
   const committed=await store.flush();const analysis=committed?.analysis||attempted.analysis;
   if(analysis.status!=='running'||analysis.execution_mode!=='durable')return json(200,{...requestDetail(store,id,session.user.id),analysis_status:analysis.status,replayed:attempted.replayed});
   let queued;
   try{queued=await enqueueAI({kind:'coordinator',workspaceId:session.workspaceId,actorId:typeof analysis.started_by==='string'?analysis.started_by:session.user.id,leaseToken:analysis.run_id,analysisRunId:analysis.run_id,requestId:id});}
   catch(error){
    if(error instanceof Error&&error.message==='DEMO_USAGE_LIMIT'){
     store.finishAnalysis({actor_id:session.user.id,request_id:id,run_id:analysis.run_id,result:{ok:false,failed_stage:'intake',error:{code:'PROVIDER_USAGE_LIMIT'}}});await store.flush();
     return json(429,{...requestDetail(store,id,session.user.id),error:{code:'DEMO_USAGE_LIMIT',message:'This guest session has reached its AI run limit. Exit the demo and sign in to use your own workspace.'}});
    }
    throw error;
   }
   return json(202,{...queued,...requestDetail(store,id,session.user.id),replayed:attempted.replayed});
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
  return json(code==='NOT_FOUND'?404:code==='ACCESS_DENIED'?403:code?.endsWith('CONFLICT')?409:code?.startsWith('INVALID_')?400:500,{error:{code:code||'REQUEST_FAILED',message:code?.endsWith('CONFLICT')?'This request changed. Reopen it before retrying.':'Unable to complete the request. Saved history is retained.'}});
 }finally{store?.dispose();}
}
