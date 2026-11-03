import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checklist, manifest, directory, verifyCorpus } from '../evaluation/verify.js';
const cases = manifest.cases.map(c => JSON.parse(readFileSync(new URL(c.file, directory), 'utf8')));
const get = id => cases.find(c => c.case_id === id);
test('held-out corpus is frozen, distinct and validates against shared contracts', () => assert.equal(verifyCorpus(), 20));
test('checklist is consistent with the contract field keys and waiver rules', () => {
  const schema = JSON.parse(readFileSync(new URL('../contracts/shared.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(checklist.fields.map(f => f.key), schema.$defs.confirmed_field.oneOf.map(s => s.properties.field_key.const));
  assert.deepEqual(checklist.fields.filter(f=>f.allow_not_applicable).map(f=>f.key), ['campaign_term','music_length','budget','response_deadline']);
});
test('complete cases cover four different uses, not just advertising',()=>{
  const uses=cases.slice(0,4).map(c=>c.intake.proposed_changes.find(p=>p.field_key==='intended_use').proposed_value);
  assert.equal(new Set(uses).size,4);
  for(const c of cases.slice(0,4)){assert.equal(c.review.issues.length,0);assert.equal(c.follow_up,null);}
});
test('relative deadline and absent timezone stay unresolved',()=>{
  const p=get('E08').intake.proposed_changes.find(p=>p.field_key==='response_deadline').proposed_value;
  assert.equal(p.date,null);assert.equal(p.timezone,null);assert.equal(get('E08').review.issues[0].type,'ambiguous');
  assert.equal(get('E13').intake.proposed_changes.find(p=>p.field_key==='response_deadline').proposed_value.timezone,null);
});
test('currency and budget-scope ambiguity are independent cases',()=>{
  const a=get('E06').intake.proposed_changes.find(p=>p.field_key==='budget').proposed_value;
  const b=get('E07').intake.proposed_changes.find(p=>p.field_key==='budget').proposed_value;
  assert.equal(a.currency,null);assert.equal(a.scope,'both');assert.equal(b.currency,'GBP');assert.equal(b.scope,'unspecified');
});
test('conflicting territory does not silently select a value',()=>{
  const c=get('E12');assert.equal(c.intake.proposed_changes.some(p=>p.field_key==='territories'),false);
  assert.equal(c.review.issues.length,1);assert.equal(c.review.issues[0].type,'conflict');
});
test('multiple recordings block a single-recording handoff',()=>{
  const c=get('E15');assert.equal(c.review.issues[0].type,'split_request');assert.equal(c.review.issues[0].severity,'blocking');
});
test('partial answer leaves three unanswered issues',()=>{
  const c=get('E16');assert.deepEqual(c.intake.proposed_changes.map(p=>p.field_key),['project']);
  assert.deepEqual(c.review.issues.flatMap(i=>i.field_keys).sort(),['campaign_term','music_length','platforms']);
});
test('material versus nonmaterial replies and acknowledgement have explicit expected behavior',()=>{
  assert.equal(get('E17').expected_behavior.material_change_after_acceptance,true);
  assert.equal(get('E18').expected_behavior.material_change_after_acceptance,false);
  assert.equal(get('E19').intake.proposed_changes.length,0);
});
test('sparse request has no fabricated facts and all twelve gaps',()=>{
  const c=get('E20');assert.equal(c.intake.proposed_changes.length,0);assert.equal(c.review.issues.length,12);
});
