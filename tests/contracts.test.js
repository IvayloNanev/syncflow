import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateContract, validateFixture, ContractError } from '../contracts/validate.js';
const load = name => JSON.parse(readFileSync(new URL(`../fixtures/development/${name}.json`, import.meta.url), 'utf8'));
const rejects = (fn, text) => assert.throws(fn, e => e instanceof ContractError && (!text || e.message.includes(text)));
for (const name of ['complete', 'incomplete', 'partial-reply']) test(`valid development fixture: ${name}`, () => validateFixture(load(name)));
test('partial reply proposes territory only and preserves confirmed term without mutation', () => {
  const f=load('partial-reply');const before=structuredClone(f.context);validateFixture(f);
  assert.deepEqual(f.intake.proposed_changes.map(p=>p.field_key),['territories']);
  assert.equal(f.context.confirmed_fields.find(p=>p.field_key==='campaign_term').value.duration_text,'three months');
  assert.deepEqual(f.context,before);
});
test('incomplete request flags exactly four missing fields',()=>{
  assert.deepEqual(load('incomplete').review.issues.flatMap(i=>i.field_keys).sort(),['campaign_term','music_length','platforms','project']);
});
test('rejects agent-authored approval and unknown top-level keys',()=>{
  const f=load('complete');f.intake.approved=true;rejects(()=>validateFixture(f));
});
test('rejects unknown field key',()=>{const f=load('complete');f.intake.proposed_changes[0].field_key='licence_status';rejects(()=>validateFixture(f));});
test('rejects incorrect value types',()=>{const f=load('complete');f.intake.proposed_changes.find(p=>p.field_key==='territories').proposed_value='Canada';rejects(()=>validateFixture(f));});
test('rejects absent source message',()=>{const f=load('complete');f.intake.proposed_changes[0].evidence[0].message_id='missing';rejects(()=>validateFixture(f),'Unknown evidence');});
test('rejects fabricated quote',()=>{const f=load('complete');f.intake.proposed_changes[0].evidence[0].exact_quote='approved worldwide';rejects(()=>validateFixture(f),'quote not found');});
test('rejects stale record version and mismatched run ID',()=>{const f=load('complete');f.intake.base_record_version=99;rejects(()=>validateFixture(f),'Stale');f.intake.base_record_version=0;f.intake.run_id='other';rejects(()=>validateFixture(f),'Run ID');});
test('rejects incorrect previous value',()=>{const f=load('partial-reply');f.intake.proposed_changes[0].previous_value=['US'];rejects(()=>validateFixture(f),'previous value');});
test('rejects duplicate proposal IDs and repeated field changes',()=>{const f=load('complete');f.intake.proposed_changes.push(f.intake.proposed_changes[0]);rejects(()=>validateFixture(f),'duplicate');});
test('unknown is not a confirmed fact',()=>{const f=load('partial-reply');f.context.confirmed_fields[0].state='unknown';rejects(()=>validateFixture(f),'unknown fields');});
test('requires human attribution on confirmed facts',()=>{const f=load('partial-reply');f.context.confirmed_fields[0].confirmed_by=null;rejects(()=>validateFixture(f),'human attribution');});
test('valid N/A needs reason and only waiver-eligible field',()=>{const f=load('partial-reply');const deadline=f.context.confirmed_fields.find(x=>x.field_key==='response_deadline');Object.assign(deadline,{state:'not_applicable',value:null,evidence:[],not_applicable_reason:'No deadline supplied; coordinator waiver for test.'});validateContract('context',f.context);deadline.not_applicable_reason='';rejects(()=>validateContract('context',f.context));});
test('track identity cannot be waived',()=>{const f=load('partial-reply');Object.assign(f.context.confirmed_fields[0],{state:'not_applicable',value:null,not_applicable_reason:'Skip'});rejects(()=>validateContract('context',f.context));});
test('rejects follow-up addressing nonexistent question',()=>{const f=load('incomplete');f.follow_up.addressed_issue_ids=['fake'];rejects(()=>validateFixture(f),'Unknown addressed');});
test('skip Follow-up when no unresolved questions',()=>{const f=load('complete');assert.equal(f.follow_up,null);rejects(()=>validateContract('follow_up',{schema_version:'1.0',run_id:f.context.run_id,base_record_version:0,subject:'Hello',body:'Hello',addressed_issue_ids:[]},f.context,f.review),'No unresolved');});
test('rejects impossible normalized dates',()=>{const f=load('complete');f.intake.proposed_changes.find(p=>p.field_key==='response_deadline').proposed_value.date='2026-02-30';rejects(()=>validateFixture(f),'Invalid calendar date');});
