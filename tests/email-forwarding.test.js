import test from 'node:test';
import assert from 'node:assert/strict';
import {Resend} from 'resend';
import {createHmac} from 'node:crypto';
import {mailbox,recipientToken,receiveEmail} from '../forwarding/receive.js';
const token='a'.repeat(40),workspace='workspace',actor='actor',rows=new Map(),receipts=new Map();
function client({requestId=null,member=true}={}){
 return {auth:{admin:{getUserById:async()=>({data:{user:{email:'owner@example.com',email_confirmed_at:'2026-11-09'}}})}},from(table){let filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},async maybeSingle(){return {data:table==='syncflow_email_routes'?{token,workspace_id:workspace,actor_id:actor,request_id:requestId}:table==='syncflow_members'?(member?{user_id:actor}:null):table==='syncflow_email_receipts'?receipts.get(filters.email_id)||null:rows.get(filters.id)||null};}};return q;},async rpc(name,input){assert.equal(name,'syncflow_commit_email');assert.equal(input.p_dashboard.id,input.p_id);assert.equal(typeof input.p_dashboard.revision,'number');rows.set(input.p_id,{state:input.p_state,version:(rows.get(input.p_id)?.version||0)+1});receipts.set(input.p_email,{request_id:input.p_id});return {data:input.p_id};}};
}
const email={id:'email-one',from:'Owner <owner@example.com>',to:[`sf-${token}@test.resend.app`],subject:'Fwd: Music enquiry',text:'Original client message. Please use the original version.'};
test('forwarded messages create a case, append through its case route, and replay without duplicates',async()=>{
 rows.clear();receipts.clear();const first=await receiveEmail(client(),email,'test.resend.app');assert.ok(first.requestId);
 await receiveEmail(client(),email,'test.resend.app');assert.equal(rows.size,1);assert.equal(rows.get(first.requestId).version,1);
 await receiveEmail(client({requestId:first.requestId}),{...email,id:'email-two',text:'Our budget is CAD 5000.'},'test.resend.app');assert.equal(rows.get(first.requestId).version,2);
 await receiveEmail(client({requestId:first.requestId}),{...email,id:'email-two',text:'Our budget is CAD 5000.'},'test.resend.app');assert.equal(rows.get(first.requestId).version,2);
});
test('forwarding rejects unauthorized sender, revoked membership, ambiguous destinations and unsupported bodies',async()=>{
 await assert.rejects(receiveEmail(client({requestId:'existing-case'}),{...email,from:'other@example.com'},'test.resend.app'),/DENIED/);
 await assert.rejects(receiveEmail(client({member:false}),email,'test.resend.app'),/DENIED/);
 await assert.rejects(receiveEmail(client(),{...email,id:'new',text:null,html:'<p>html</p>'},'test.resend.app'),/UNSUPPORTED/);
 assert.equal(recipientToken([...email.to,...email.to],'test.resend.app'),null);
 assert.equal(recipientToken(email.to,'evil.example'),null);assert.equal(mailbox('x@example.com\nBcc: other@example.com'),null);
});
test('official webhook verifier rejects tampering and old timestamps',()=>{
 const secret='whsec_'+Buffer.from('test-signing-secret').toString('base64'),raw=JSON.stringify({type:'email.received',data:{email_id:'test'}}),id='msg_test',timestamp=String(Math.floor(Date.now()/1000));
 const signature='v1,'+createHmac('sha256',Buffer.from(secret.slice(6),'base64')).update(`${id}.${timestamp}.${raw}`).digest('base64');
 const resend=new Resend('re_test');const input={payload:raw,webhookSecret:secret,headers:{id,timestamp,signature}};
 assert.equal(resend.webhooks.verify(input).type,'email.received');assert.throws(()=>resend.webhooks.verify({...input,payload:raw+' '}));assert.throws(()=>resend.webhooks.verify({...input,headers:{...input.headers,timestamp:'1'}}));
});

test('short requests alias resolves only with an explicit route and rejects ambiguous recipients',()=>{
 assert.equal(recipientToken(['requests@test.resend.app'],'test.resend.app',token),token);
 assert.equal(recipientToken(['requests@test.resend.app'],'test.resend.app'),null);
 assert.equal(recipientToken(['requests@other.example'],'test.resend.app',token),null);
 assert.equal(recipientToken(['requests@test.resend.app',...email.to],'test.resend.app',token),null);
});

 test('workspace inbox accepts external client requests and keeps the sender in the case',async()=>{
 rows.clear();receipts.clear();
 const external={...email,id:'external-client',from:'Client <ivaylo.nanev@pursuit.org>'};
 const result=await receiveEmail(client(),external,'test.resend.app');
 assert.ok(result.requestId);
 assert.match(JSON.stringify(rows.get(result.requestId).state),/From: ivaylo.nanev@pursuit.org/);
 await receiveEmail(client(),external,'test.resend.app');
 assert.equal(rows.get(result.requestId).version,1);
 await assert.rejects(receiveEmail(client({requestId:result.requestId}),{...external,id:'unauthorized-reply'},'test.resend.app'),/DENIED/);
 await assert.rejects(receiveEmail(client({member:false}),{...external,id:'revoked-route'},'test.resend.app'),/DENIED/);
});
