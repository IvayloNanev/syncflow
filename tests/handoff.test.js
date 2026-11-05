import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHandoffSummary} from '../handoff/build-summary.js';
const request = {id:'request-demo',revision:2,messages:[{text:'original'},{text:'reply'}],confirmed_fields:[
  {field_key:'territories',state:'confirmed',value:['Canada'],confirmed_by:'coordinator',confirmed_at:'2026-11-05',evidence:[{message_id:'msg-1',exact_quote:'in Canada'}]},
  {field_key:'budget',state:'proposed',value:{amount:999999}},
]};
test('handoff includes only confirmed facts, their evidence and separate open checks', () => {
  const before = JSON.stringify(request);
  const text = buildHandoffSummary({request,analysisCurrent:true,pendingCount:3,questions:[{question:'Which platforms?'}],catalog:{recording:{title:'Demo',artist:'Artist',version:'Instrumental',id:'TRACK-0002'},blockers:[{question:'Verify publishing ownership.'}]}});
  assert.match(text,/Territory: Canada/);
  assert.match(text,/Source msg-1: in Canada/);
  assert.match(text,/Budget \/ currency \/ scope: Not confirmed/);
  assert.doesNotMatch(text,/999999/);
  assert.match(text,/Which platforms\?/);
  assert.match(text,/Verify publishing ownership/);
  assert.match(text,/not a licence/);
  assert.equal(JSON.stringify(request),before);
});
test('stale handoff never implies no questions or a complete intake', () => {
  const text = buildHandoffSummary({request,analysisCurrent:false,questions:[]});
  assert.match(text,/unavailable or outdated/);
  assert.match(text,/Unknown until current analysis/);
  assert.match(text,/Recording identity unresolved/);
  assert.doesNotMatch(text,/No current client questions/);
});
test('empty confirmed record keeps unknowns rather than backfilling catalog data', () => {
  const text = buildHandoffSummary({request:{...request,confirmed_fields:[]},analysisCurrent:true});
  assert.match(text,/0 confirmed facts/);
  assert.match(text,/Track title: Not confirmed/);
  assert.match(text,/Reviewer assignment and approval tracking are not recorded/);
});

// Persistence guards are separate from report generation and never mutate request facts.
test('saved handoff edits survive reopen and reject stale or conflicting writes', async t => {
  const {openRequestStore}=await import('../requests/store.js');
  const {mkdtempSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');const {join}=await import('node:path');
  const dir=mkdtempSync(join(tmpdir(),'syncflow-handoff-'));let store=openRequestStore(join(dir,'store.sqlite'));
  t.after(()=>{store.close();rmSync(dir,{recursive:true,force:true});});
  const r=store.create({actor_id:'A',email:'Fictional request',timezone:'UTC',idempotency_key:'create'}).request;
  const source=store.handoff('A',r.id).source_token;
  const command={actor_id:'A',request_id:r.id,expected_revision:0,expected_handoff_version:0,source_token:source,text:'Edited summary\nCoordinator note.',idempotency_key:'save'};
  store.saveHandoff(command);store.saveHandoff(command);
  assert.equal(store.handoff('A',r.id).version,1);assert.equal(store.get('A',r.id).revision,0);
  store.close();store=openRequestStore(join(dir,'store.sqlite'));
  assert.equal(store.handoff('A',r.id).latest.text,command.text);
  assert.throws(()=>store.saveHandoff({...command,idempotency_key:'conflict'}),/HANDOFF_CONFLICT/);
  assert.throws(()=>store.handoff('B',r.id),/NOT_FOUND/);
  store.recordReview({actor_id:'A',request_id:r.id,expected_revision:0,expected_review_version:0,operation:'assign',name:'Morgan',role:'Director',idempotency_key:'reviewer'});
  assert.equal(store.handoff('A',r.id).latest.outdated,true);
  assert.throws(()=>store.saveHandoff({...command,expected_handoff_version:1,idempotency_key:'stale'}),/STALE_HANDOFF/);
  store.saveHandoff({...command,expected_handoff_version:1,source_token:store.handoff('A',r.id).source_token,idempotency_key:'regenerated',text:'Updated summary'});
  assert.equal(store.handoff('A',r.id).history.length,2);
});
