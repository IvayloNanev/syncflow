import {openRequestStore} from '../requests/store.js';
import {creationId} from '../requests/shared-store.js';
import {dashboardRequest} from '../requests/dashboard.js';
export async function saveInquiry(client,{workspaceId,actorId,emailId,timezone='UTC'}){
 const {data:inquiry,error}=await client.from('syncflow_inquiries').select('*').eq('workspace_id',workspaceId).eq('email_id',emailId).maybeSingle();
 if(error)throw Error('STORE_FAILED');if(!inquiry)throw Error('INQUIRY_NOT_FOUND');
 // Always use the admission RPC, including retries, so live membership is checked.
 const id=inquiry.request_id||creationId(workspaceId,inquiry.actor_id,`inquiry:${emailId}`);
 const store=openRequestStore(':memory:',{ownerId:workspaceId,createId:id});
 try{
  store.create({actor_id:actorId,idempotency_key:`inquiry:${emailId}`,email:inquiry.body,timezone,recording_id:null});
  const request=store.get(actorId,id);
  const dashboard={...dashboardRequest(request,store.workflow(actorId,id),store.reviewers(actorId,id)),id,revision:0,recording_id:null,created_at:request.created_at,updated_at:request.updated_at,message_count:1,preview:inquiry.body.slice(0,100)};
  const {data,error:saveError}=await client.rpc('syncflow_save_inquiry',{p_workspace:workspaceId,p_actor:actorId,p_email:emailId,p_id:id,p_state:store.exportState(),p_dashboard:dashboard});
  if(saveError)throw Error(saveError.message?.includes('WORKSPACE_ACCESS_DENIED')?'ACCESS_DENIED':'STORE_FAILED');
  return {requestId:data};
 }finally{store.close();}
}
