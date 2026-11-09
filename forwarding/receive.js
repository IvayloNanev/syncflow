import {openRequestStore} from '../requests/store.js';
import {creationId} from '../requests/shared-store.js';
import {dashboardRequest} from '../requests/dashboard.js';
export function mailbox(value){
 if(typeof value!=='string'||value.length>320||/[\r\n]/.test(value))return null;
 const match=value.trim().match(/^(?:[^<>]*<)?([^<>\s]+@[^<>\s]+)>?$/);
 return match?match[1].toLowerCase():null;
}
export function recipientToken(to,domain,requestsToken){
 if(!Array.isArray(to)||!domain)return null;
 const candidates=to.map(mailbox).filter(Boolean).filter(address=>address.endsWith('@'+domain.toLowerCase()));
 if(candidates.length!==1)return null;
 const local=candidates[0].split('@')[0];
 if(local==='requests'&&/^[a-f0-9]{40}$/.test(requestsToken||''))return requestsToken;
 return /^sf-[a-f0-9]{40}$/.test(local)?local.slice(3):null;
}
export async function receiveEmail(client,email,domain){
 if(!email||typeof email.id!=='string'||!/^[a-zA-Z0-9-]{1,100}$/.test(email.id))throw Error('INVALID_EMAIL');
 const token=recipientToken(email.to,domain,process.env.SYNCFLOW_INBOUND_REQUESTS_TOKEN),sender=mailbox(email.from);
 if(!token||!sender)throw Error('FORWARDING_DENIED');
 const {data:route,error}=await client.from('syncflow_email_routes').select('*').eq('token',token).eq('enabled',true).maybeSingle();
 if(error)throw Error('STORE_FAILED');if(!route)throw Error('FORWARDING_DENIED');
 // A workspace inbox accepts new client enquiries. Case reply routes remain coordinator-only.
 const {data:{user},error:userError}=await client.auth.admin.getUserById(route.actor_id);
 if(userError||!user?.email_confirmed_at||(route.request_id&&user.email?.toLowerCase()!==sender))throw Error('FORWARDING_DENIED');
 const {data:member}=await client.from('syncflow_members').select('user_id').eq('workspace_id',route.workspace_id).eq('user_id',route.actor_id).maybeSingle();
 if(!member)throw Error('FORWARDING_DENIED');
 const {data:receipt,error:receiptError}=await client.from('syncflow_email_receipts').select('request_id').eq('email_id',email.id).maybeSingle();
 if(receiptError)throw Error('STORE_FAILED');if(receipt)return {requestId:receipt.request_id};
 if(typeof email.text!=='string'||!email.text.trim()||email.text.length>18000)throw Error('UNSUPPORTED_EMAIL');
 const subject=typeof email.subject==='string'?email.subject.slice(0,500):'(no subject)';
 const attachments=Array.isArray(email.attachments)?email.attachments.length:0;
 const text=`${route.request_id?'Forwarded by':'From'}: ${sender}\nSubject: ${subject}\n${attachments?'Attachments were not imported.\n':''}\n${email.text}`;
 const id=route.request_id||creationId(route.workspace_id,route.actor_id,`email:${email.id}`);
 for(let attempt=0;attempt<3;attempt++){
  const {data:row,error:loadError}=await client.from('syncflow_requests').select('state,version').eq('workspace_id',route.workspace_id).eq('id',id).maybeSingle();
  if(loadError)throw Error('STORE_FAILED');if(route.request_id&&!row)throw Error('FORWARDING_DENIED');
  const store=openRequestStore(':memory:',{ownerId:route.workspace_id,createId:id,initialState:row?.state??null});
  try{
   if(row){const r=store.get(route.actor_id,id);store.appendReply({actor_id:route.actor_id,request_id:id,expected_revision:r.revision,text,idempotency_key:`inbound:${email.id}`});}
   else store.create({actor_id:route.actor_id,idempotency_key:`inbound:${email.id}`,email:text,timezone:'UTC',recording_id:null});
   const request=store.get(route.actor_id,id),dashboard={...dashboardRequest(request,store.workflow(route.actor_id,id),store.reviewers(route.actor_id,id)),id:request.id,revision:request.revision,recording_id:request.recording_id??null,created_at:request.created_at,updated_at:request.updated_at,message_count:request.messages.length,preview:request.messages[0].text.slice(0,100)};
   const {data:committed,error:commitError}=await client.rpc('syncflow_commit_email',{p_token:token,p_email:email.id,p_sender:sender,p_id:id,p_expected:row?.version??0,p_state:store.exportState(),p_dashboard:dashboard,p_subject:subject,p_attachments:attachments});
   if(!commitError)return {requestId:committed};
   if(!commitError.message?.includes('STORAGE_CONFLICT'))throw Error(commitError.message?.includes('FORWARDING_DENIED')?'FORWARDING_DENIED':'STORE_FAILED');
  }finally{store.close();}
 }
 throw Error('STORE_FAILED');
}
