import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewRecording } from '../catalog/review.js';
import { analyzeEmail } from '../server/analyze.js';
import { openRequestStore } from '../requests/store.js';
import { createFollowUpMockProvider } from '../agents/follow-up/providers/mock.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('catalog review always requires publishing verification and routes gaps internally', () => {
  assert.equal(reviewRecording(null).blockers[0].code, 'RECORDING_UNRESOLVED');
  for (const [id, code] of [['TRACK-0018','MASTER_CONTACT_MISSING'], ['TRACK-0012','ASSETS_UNAVAILABLE'], ['TRACK-0030','METADATA_CONFLICT']]) {
    const result = reviewRecording(id);
    assert.equal(result.cleared, false);
    assert.ok(result.blockers.some(b => b.code === code));
    assert.ok(result.blockers.every(b => b.audience === 'coordinator'));
  }
});
test('API validates selected ID before model use and keeps catalog outside email evidence', async () => {
  let context;
  const providers = { intakeProvider: { id:'test',mode:'mock',generate:async args => {
    context=args.context;return {schema_version:'1.0',run_id:context.run_id,base_record_version:0,proposed_changes:[],ambiguities:[]};
  } }, followUpProvider:createFollowUpMockProvider() };
  assert.equal((await analyzeEmail({email:'Client text',timezone:'UTC',recording_id:'FAKE'},providers)).status,400);
  assert.equal(context,undefined);
  assert.equal((await analyzeEmail({email:'Client text',timezone:'UTC',recording_id:{id:'TRACK-0001'}},providers)).status,400);
  const r=await analyzeEmail({email:'Client text',timezone:'UTC',recording_id:'TRACK-0018'},providers);
  assert.equal(r.status,200);
  assert.equal(context.messages[0].text,'Client text');
  assert.equal(context.confirmed_fields.length,0);
  assert.equal(r.body.catalog_review.recording.id,'TRACK-0018');
  assert.ok(r.body.catalog_review.blockers.some(b=>b.code==='MASTER_CONTACT_MISSING'));
});
test('saved request preserves recording across reopen and replies; command replay rejects changed selection', () => {
  const dir=mkdtempSync(join(tmpdir(),'syncflow-recording-'));const path=join(dir,'requests.sqlite');let store=openRequestStore(path);
  try {
    const command={actor_id:'local-test',idempotency_key:'create-1',email:'Client text',timezone:'UTC',recording_id:'TRACK-0002'};
    const request=store.create(command).request;
    assert.equal(store.create(command).replayed,true);
    assert.throws(()=>store.create({...command,recording_id:'TRACK-0003'}),{code:'IDEMPOTENCY_CONFLICT'});
    assert.throws(()=>store.create({...command,idempotency_key:'bad',recording_id:'FAKE'}),{code:'INVALID_RECORDING'});
    store.close();store=openRequestStore(path);
    assert.equal(store.get('local-test',request.id).recording_id,'TRACK-0002');
    const reply=store.appendReply({actor_id:'local-test',idempotency_key:'reply-1',request_id:request.id,expected_revision:0,text:'Updated budget'}).request;
    assert.equal(reply.recording_id,'TRACK-0002');assert.equal(reply.revision,1);
    assert.equal(store.context('local-test',request.id).confirmed_fields.length,0);
    assert.equal(store.context('local-test',request.id).messages.length,2);
  } finally {store.close();rmSync(dir,{recursive:true,force:true});}
});
