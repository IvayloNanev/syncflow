import test from 'node:test';
import assert from 'node:assert/strict';
import {Resend} from 'resend';
import {createHmac} from 'node:crypto';
import {mailbox,recipientToken,receiveEmail} from '../forwarding/receive.js';
import {saveInquiry} from '../forwarding/inquiries.js';
import {inquiryLabels} from '../requests/inquiry-labels.js';
const token='a'.repeat(40),workspace='workspace',actor='actor',rows=new Map(),receipts=new Map(),inquiries=new Map();
function reset(){rows.clear();receipts.clear();inquiries.clear();}
function client({requestId=null,member=true,failSave=false}={}){
 return {auth:{admin:{getUserById:async()=>({data:{user:{email:'owner@example.com',email_confirmed_at:'2026-11-09'}}})}},from(table){let filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},async maybeSingle(){return {data:table==='syncflow_email_routes'?{token,workspace_id:workspace,actor_id:actor,request_id:requestId}:table==='syncflow_members'?(member?{user_id:actor}:null):table==='syncflow_email_receipts'?receipts.get(filters.email_id)||null:table==='syncflow_inquiries'?(filters.workspace_id===workspace?inquiries.get(filters.email_id)||null:null):rows.get(filters.id)||null};}};return q;},async rpc(name,input){
  if(name==='syncflow_capture_inquiry'){if(!inquiries.has(input.p_email))inquiries.set(input.p_email,{email_id:input.p_email,actor_id:actor,body:input.p_body,request_id:null});return {data:input.p_email};}
  if(name==='syncflow_save_inquiry'){
   if(!member)return {error:{message:'WORKSPACE_ACCESS_DENIED'}};
   if(failSave)return {error:{message:'STORE_FAILED'}};
   const inquiry=inquiries.get(input.p_email);if(inquiry.request_id)return {data:inquiry.request_id};
   assert.equal(input.p_dashboard.id,input.p_id);rows.set(input.p_id,{state:input.p_state,version:1});inquiry.request_id=input.p_id;receipts.set(input.p_email,{request_id:input.p_id});return {data:input.p_id};
  }
  assert.equal(name,'syncflow_commit_email');assert.equal(input.p_dashboard.id,input.p_id);rows.set(input.p_id,{state:input.p_state,version:(rows.get(input.p_id)?.version||0)+1});receipts.set(input.p_email,{request_id:input.p_id});return {data:input.p_id};}};
}
const email={id:'email-one',from:'Client <client@example.com>',to:[`sf-${token}@test.resend.app`],subject:'Music enquiry',text:'Original client message. Please use the original version.'};
test('delivery stages an inquiry without creating a case or running an agent; duplicates preserve original',async()=>{
 reset();const first=await receiveEmail(client(),email,'test.resend.app');assert.equal(first.inquiryId,email.id);assert.equal(rows.size,0);assert.equal(receipts.size,0);
 await receiveEmail(client(),{...email,text:'Changed retry body'},'test.resend.app');assert.equal(inquiries.size,1);assert.match(inquiries.get(email.id).body,/Original client message/);
});
test('explicit save creates one case, retains original email, and replay does not duplicate',async()=>{
 reset();await receiveEmail(client(),email,'test.resend.app');
 const options={workspaceId:workspace,actorId:actor,emailId:email.id};
 const first=await saveInquiry(client(),options);assert.equal(rows.size,1);assert.equal(inquiries.get(email.id).request_id,first.requestId);
 assert.match(JSON.stringify(rows.get(first.requestId).state),/From: client@example.com/);
 assert.deepEqual(rows.get(first.requestId).state.tables.analysis_runs,[]);
 assert.deepEqual(await saveInquiry(client(),options),first);assert.equal(rows.size,1);
 assert.equal((await receiveEmail(client(),email,'test.resend.app')).requestId,first.requestId);
});
test('failed conversion preserves inquiry, and workspace/membership checks prevent foreign saves',async()=>{
 reset();await receiveEmail(client(),email,'test.resend.app');const options={workspaceId:workspace,actorId:actor,emailId:email.id};
 await assert.rejects(saveInquiry(client({failSave:true}),options),/STORE_FAILED/);assert.equal(inquiries.get(email.id).request_id,null);assert.equal(rows.size,0);
 await assert.rejects(saveInquiry(client(),{...options,workspaceId:'other'}),/INQUIRY_NOT_FOUND/);
 await assert.rejects(saveInquiry(client({member:false}),options),/ACCESS_DENIED/);assert.equal(rows.size,0);
});
test('case-specific forwarded replies still append to the existing case and deduplicate',async()=>{
 reset();await receiveEmail(client(),email,'test.resend.app');const first=await saveInquiry(client(),{workspaceId:workspace,actorId:actor,emailId:email.id});
 const reply={...email,id:'email-two',from:'owner@example.com',text:'Our budget is CAD 5000.'};
 await receiveEmail(client({requestId:first.requestId}),reply,'test.resend.app');assert.equal(rows.get(first.requestId).version,2);
 await receiveEmail(client({requestId:first.requestId}),reply,'test.resend.app');assert.equal(rows.get(first.requestId).version,2);
});
test('forwarding rejects unauthorized replies, revoked membership, ambiguous destinations and unsupported bodies',async()=>{
 await assert.rejects(receiveEmail(client({requestId:'existing-case'}),{...email,id:'foreign',from:'other@example.com'},'test.resend.app'),/DENIED/);
 await assert.rejects(receiveEmail(client({member:false}),email,'test.resend.app'),/DENIED/);
 await assert.rejects(receiveEmail(client(),{...email,id:'new',text:null,html:'<p>html</p>'},'test.resend.app'),/UNSUPPORTED/);
 assert.equal(recipientToken([...email.to,...email.to],'test.resend.app'),null);assert.equal(recipientToken(email.to,'evil.example'),null);assert.equal(mailbox('x@example.com\nBcc: other@example.com'),null);
});
test('official webhook verifier rejects tampering and old timestamps',()=>{
 const secret='whsec_'+Buffer.from('test-signing-secret').toString('base64'),raw=JSON.stringify({type:'email.received',data:{email_id:'test'}}),id='msg_test',timestamp=String(Math.floor(Date.now()/1000));
 const signature='v1,'+createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${timestamp}.${raw}`).digest('base64');
 const resend=new Resend('re_test');const input={payload:raw,webhookSecret:secret,headers:{id,timestamp,signature}};
 assert.equal(resend.webhooks.verify(input).type,'email.received');assert.throws(()=>resend.webhooks.verify({...input,payload:raw+' '}));assert.throws(()=>resend.webhooks.verify({...input,headers:{...input.headers,timestamp:'1'}}));
});
test('short requests alias resolves only with an explicit route and rejects ambiguous recipients',()=>{
 assert.equal(recipientToken(['requests@test.resend.app'],'test.resend.app',token),token);assert.equal(recipientToken(['requests@test.resend.app'],'test.resend.app'),null);
 assert.equal(recipientToken(['requests@other.example'],'test.resend.app',token),null);assert.equal(recipientToken(['requests@test.resend.app',...email.to],'test.resend.app',token),null);
});
test('unanalyzed cases have literal source labels without confirming inferred facts',()=>{
 assert.deepEqual(inquiryLabels('From: client@example.com\nSubject: Autumn launch\n\nHello'),{title:'Autumn launch',sender:'client@example.com'});
 assert.equal(inquiryLabels('Project: Film campaign\nContact: Client Name').title,'Film campaign');
});
