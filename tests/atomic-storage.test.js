import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { openRequestStore } from '../requests/store.js';
import { analyzeSavedRequest } from '../requests/analyze-saved.js';
import { createFollowUpMockProvider } from '../agents/follow-up/providers/mock.js';

async function setup(t) {
  const dir=mkdtempSync(join(tmpdir(),'syncflow-atomic-'));const path=join(dir,'test.sqlite');
  const store=openRequestStore(path);const fault=new DatabaseSync(path);
  t.after(()=>{fault.close();store.close();rmSync(dir,{recursive:true,force:true});});
  const request=store.create({actor_id:'test-owner',idempotency_key:'create',email:'Use the recording in Canada.',timezone:'UTC'}).request;
  const providers={intakeProvider:{id:'fault-test',mode:'mock',generate:async({context})=>({schema_version:'1.0',run_id:context.run_id,base_record_version:context.base_record_version,
    proposed_changes:[{proposal_id:'territory',field_key:'territories',previous_value:null,proposed_value:['Canada'],evidence:[{message_id:context.messages[0].message_id,exact_quote:'Canada'}]}],ambiguities:[]})},followUpProvider:createFollowUpMockProvider()};
  const {analysis}=await analyzeSavedRequest(store,{actor_id:'test-owner',request_id:request.id,expected_revision:0,idempotency_key:'run'},providers);
  // Inject failure after request mutation and analysis invalidation but before the audit row can commit.
  fault.exec("CREATE TRIGGER reject_test_audit BEFORE INSERT ON events WHEN NEW.revision > 0 BEGIN SELECT RAISE(ABORT, 'injected audit write failure'); END");
  return {store,fault,request,analysis};
}
test('audit failure rolls back reply, revision, analysis invalidation and retry command together',async t=>{
  const {store,fault,request,analysis}=await setup(t);
  const command={actor_id:'test-owner',request_id:request.id,expected_revision:0,idempotency_key:'reply',text:'Updated scope.'};
  assert.throws(()=>store.appendReply(command),{code:'STORE_FAILED'});
  assert.deepEqual(store.get('test-owner',request.id),request);
  assert.equal(store.history('test-owner',request.id).length,1);
  assert.equal(store.activeAnalysis('test-owner',request.id).run_id,analysis.run_id);
  assert.equal(store.analysis('test-owner',request.id,analysis.run_id).status,'completed');
  assert.equal(fault.prepare("SELECT COUNT(*) AS count FROM commands WHERE command_key='reply'").get().count,0);
  fault.exec('DROP TRIGGER reject_test_audit');
  assert.equal(store.appendReply(command).request.messages.length,2);
  assert.equal(store.appendReply(command).replayed,true);
  assert.equal(store.history('test-owner',request.id).length,2);
});
test('audit failure rolls back accepted field, decision, revision and command; same-key retry then succeeds once',async t=>{
  const {store,fault,request,analysis}=await setup(t);
  const command={actor_id:'test-owner',request_id:request.id,expected_revision:0,idempotency_key:'accept',run_id:analysis.run_id,proposal_id:'territory',decision:'accept'};
  assert.throws(()=>store.decideProposal(command),{code:'STORE_FAILED'});
  assert.deepEqual(store.get('test-owner',request.id),request);
  assert.deepEqual(store.decisions('test-owner',request.id),[]);
  assert.equal(store.history('test-owner',request.id).length,1);
  assert.equal(store.activeAnalysis('test-owner',request.id).run_id,analysis.run_id);
  assert.equal(store.analysis('test-owner',request.id,analysis.run_id).status,'completed');
  assert.equal(fault.prepare("SELECT COUNT(*) AS count FROM commands WHERE command_key='accept'").get().count,0);
  fault.exec('DROP TRIGGER reject_test_audit');
  const accepted=store.decideProposal(command);
  assert.deepEqual(accepted.request.confirmed_fields[0].value,['Canada']);
  assert.equal(store.decideProposal(command).replayed,true);
  assert.equal(store.get('test-owner',request.id).revision,1);
  assert.equal(store.decisions('test-owner',request.id).length,1);
  assert.equal(store.history('test-owner',request.id).length,2);
});
