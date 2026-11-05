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
