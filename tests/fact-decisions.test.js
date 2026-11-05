import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openRequestStore } from '../requests/store.js';
import { analyzeSavedRequest } from '../requests/analyze-saved.js';
import { createFollowUpMockProvider } from '../agents/follow-up/providers/mock.js';
import { createSavedRequestsHandler } from '../server/saved-requests.js';
function providers() {
  return { intakeProvider:{id:'test',mode:'mock',generate:async({context})=>{
    const message=context.messages.at(-1);const territory=message.text.includes('North America')?'North America':'Canada';
    return {schema_version:'1.0',run_id:context.run_id,base_record_version:context.base_record_version,ambiguities:[],
      proposed_changes:[{proposal_id:'territories',field_key:'territories',previous_value:context.confirmed_fields.find(f=>f.field_key==='territories')?.value??null,
        proposed_value:[territory],evidence:[{message_id:message.message_id,exact_quote:territory}]},
      {proposal_id:'project',field_key:'project',previous_value:context.confirmed_fields.find(f=>f.field_key==='project')?.value??null,
        proposed_value:'Advertising',evidence:[{message_id:context.messages[0].message_id,exact_quote:'Advertising'}]}]};
  }}, followUpProvider:createFollowUpMockProvider() };
}
async function setup(t) {
  const dir=mkdtempSync(join(tmpdir(),'syncflow-decisions-'));const path=join(dir,'requests.sqlite');let store=openRequestStore(path);
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const request=store.create({actor_id:'A',idempotency_key:'create',email:'Advertising in Canada.',timezone:'UTC'}).request;
  const outcome=await analyzeSavedRequest(store,{actor_id:'A',request_id:request.id,expected_revision:0,idempotency_key:'analysis'},providers());
  const command={actor_id:'A',request_id:request.id,expected_revision:0,idempotency_key:'decision',run_id:outcome.analysis.run_id,proposal_id:'territories',decision:'accept'};
  return {store,path,request,command,reopen:()=>{store.close();store=openRequestStore(path);return store;}};
}
test('accept saves exact proposal, source evidence, human attribution and audit across reopen',async t=>{
  const s=await setup(t);const before=s.store.get('A',s.request.id);
  const result=s.store.decideProposal(s.command);assert.equal(result.request.revision,1);
  const field=result.request.confirmed_fields[0];assert.deepEqual(field.value,['Canada']);assert.equal(field.state,'confirmed');assert.equal(field.confirmed_by,'A');assert.ok(field.confirmed_at);
  assert.equal(field.evidence[0].message_id,before.messages[0].message_id);assert.equal(field.evidence[0].exact_quote,'Canada');
  assert.deepEqual(result.request.messages,before.messages);assert.equal(s.store.activeAnalysis('A',s.request.id),null);
  assert.equal(s.store.reviewAnalysis('A',s.request.id).run_id,s.command.run_id);
  const store=s.reopen();assert.deepEqual(store.get('A',s.request.id).confirmed_fields,[field]);
  assert.equal(store.decisions('A',s.request.id)[0].decision,'accept');assert.equal(store.history('A',s.request.id)[1].action,'proposal_decided');
  assert.equal(store.context('A',s.request.id).confirmed_fields[0].confirmed_by,'A');
});
test('remaining proposals can be rejected without overwriting accepted fields; retry is idempotent',async t=>{
  const {store,request,command}=await setup(t);
  store.decideProposal(command);
  assert.equal(store.decideProposal(command).replayed,true);assert.equal(store.get('A',request.id).revision,1);
  assert.throws(()=>store.decideProposal({...command,decision:'reject'}),{code:'IDEMPOTENCY_CONFLICT'});
  assert.throws(()=>store.decideProposal({...command,expected_revision:1,idempotency_key:'again'}),{code:'DECISION_EXISTS'});
  const rejected=store.decideProposal({...command,expected_revision:1,idempotency_key:'reject-project',proposal_id:'project',decision:'reject'});
  assert.equal(rejected.request.revision,2);assert.equal(rejected.request.confirmed_fields.length,1);
  assert.deepEqual(rejected.request.confirmed_fields[0].value,['Canada']);assert.equal(store.decisions('A',request.id).length,2);
});
test('later reply and analysis never overwrite a confirmed value; replacement requires new acceptance',async t=>{
  const {store,request,command}=await setup(t);store.decideProposal(command);
  store.appendReply({actor_id:'A',request_id:request.id,expected_revision:1,idempotency_key:'reply',text:'Correction: North America.'});
  assert.equal(store.reviewAnalysis('A',request.id),null);
  assert.throws(()=>store.decideProposal({...command,expected_revision:2,idempotency_key:'stale'}),{code:'STALE_PROPOSAL'});
  const next=await analyzeSavedRequest(store,{actor_id:'A',request_id:request.id,expected_revision:2,idempotency_key:'new-analysis'},providers());
  assert.deepEqual(store.get('A',request.id).confirmed_fields[0].value,['Canada']);
  const proposal=next.analysis.result.stages.intake.output.proposed_changes.find(p=>p.field_key==='territories');
  assert.deepEqual(proposal.previous_value,['Canada']);assert.deepEqual(proposal.proposed_value,['North America']);
  store.decideProposal({...command,expected_revision:2,idempotency_key:'reject-change',run_id:next.analysis.run_id,decision:'reject'});
  assert.deepEqual(store.get('A',request.id).confirmed_fields[0].value,['Canada']);
  const final=await analyzeSavedRequest(store,{actor_id:'A',request_id:request.id,expected_revision:3,idempotency_key:'final-analysis'},providers());
  const accepted=store.decideProposal({...command,expected_revision:3,idempotency_key:'accept-change',run_id:final.analysis.run_id});
  assert.deepEqual(accepted.request.confirmed_fields[0].value,['North America']);assert.equal(store.decisions('A',request.id).length,3);
});
test('stale revision, unknown/foreign proposals, forged values and owner spoofing cannot mutate records',async t=>{
  const {store,request,command}=await setup(t);const before=store.get('A',request.id);
  for(const [change,code] of [[{expected_revision:1},'REVISION_CONFLICT'],[{run_id:'not-a-run'},'STALE_PROPOSAL'],[{proposal_id:'invented'},'INVALID_PROPOSAL'],[{value:['World']},'INVALID_INPUT'],[{confirmed_by:'admin'},'INVALID_INPUT'],[{actor_id:'B'},'NOT_FOUND']]) {
    assert.throws(()=>store.decideProposal({...command,...change}),{code});assert.deepEqual(store.get('A',request.id),before);
  }
});
test('new completed analysis supersedes the previous review head even when source revision is unchanged',async t=>{
  const {store,request,command}=await setup(t);
  await analyzeSavedRequest(store,{actor_id:'A',request_id:request.id,expected_revision:0,idempotency_key:'newer'},providers());
  assert.throws(()=>store.decideProposal(command),{code:'STALE_PROPOSAL'});
});
test('confirmation during an in-flight run invalidates that run instead of overwriting human state',async t=>{
  const {store,request,command}=await setup(t);let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
  const p=providers();const generate=p.intakeProvider.generate;p.intakeProvider.generate=async args=>{enter();await gate;return generate(args);};
  const pending=analyzeSavedRequest(store,{actor_id:'A',request_id:request.id,expected_revision:0,idempotency_key:'pending'},p);await entered;
  store.decideProposal(command);release();assert.equal((await pending).analysis.status,'stale');
  assert.deepEqual(store.get('A',request.id).confirmed_fields[0].value,['Canada']);assert.equal(store.activeAnalysis('A',request.id),null);
});
test('API accepts only IDs/decision and restores confirmed facts and decision history',async t=>{
  const dir=mkdtempSync(join(tmpdir(),'syncflow-decision-api-'));const path=join(dir,'store.sqlite');t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const post=createSavedRequestsHandler({enabled:()=>true,openStore:()=>openRequestStore(path),providers});
  const call=async body=>{const response=await post(new Request('http://127.0.0.1:3000/api/requests',{method:'POST',headers:{origin:'http://127.0.0.1:3000','content-type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,...await response.json()};};
  const created=await call({action:'create',email:'Advertising in Canada.',timezone:'UTC',idempotency_key:'create'});
  const analyzed=await call({action:'analyze',request_id:created.request.id,expected_revision:0,idempotency_key:'run'});
  const cmd={action:'decide',request_id:created.request.id,expected_revision:0,idempotency_key:'accept',run_id:analyzed.review_analysis.run_id,proposal_id:'territories',decision:'accept'};
  assert.equal((await call({...cmd,proposed_value:['World']})).status,400);
  const accepted=await call(cmd);assert.equal(accepted.status,200);assert.equal(accepted.request.confirmed_fields[0].confirmed_by,'local-coordinator');
  const reopened=await call({action:'get',request_id:created.request.id});assert.equal(reopened.decisions.length,1);assert.equal(reopened.request.revision,1);
  assert.equal((await call(cmd)).replayed,true);assert.equal((await call({...cmd,idempotency_key:'old'})).status,409);
});
