import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runReview } from '../agents/review/run-review.js';
const fixture = name => JSON.parse(readFileSync(new URL(`../fixtures/development/${name}.json`, import.meta.url), 'utf8'));
test('incomplete intake flags four missing fields plus deadline time/zone without mutation', () => {
  const f = fixture('incomplete'); const before = structuredClone(f);
  const r = runReview(f.context, f.intake);
  assert.equal(r.ok, true);
  assert.deepEqual(r.output.issues.filter(i => i.type === 'missing').flatMap(i => i.field_keys), ['project','platforms','campaign_term','music_length']);
  assert.ok(r.output.issues.some(i => i.issue_id === 'ambiguous-response_deadline'));
  assert.deepEqual(f, before);
  assert.equal(r.output.checks.find(c => c.rule_id === 'single_recording').result, 'unknown');
});
test('bad evidence and stale Intake are rejected before Review', () => {
  const f = fixture('incomplete'); f.intake.base_record_version++;
  assert.equal(runReview(f.context, f.intake).error.code, 'INVALID_INTAKE');
  f.intake.base_record_version--; f.intake.proposed_changes[0].evidence[0].exact_quote = 'invented quote';
  assert.equal(runReview(f.context, f.intake).error.code, 'INVALID_INTAKE');
});
test('partial replies retain confirmed values and every existing unresolved issue', () => {
  const f = fixture('partial-reply'); const r = runReview(f.context, f.intake);
  assert.equal(r.ok, true);
  for (const issue of f.context.unresolved_issues) assert.ok(r.output.issues.some(i => JSON.stringify(i) === JSON.stringify(issue)));
  for (const field of f.context.confirmed_fields.filter(f => f.state === 'confirmed'))
    assert.equal(r.output.checks.find(c => c.rule_id === `required:${field.field_key}`).result, 'pass');
});
test('unknown budget currency/scope is flagged even when an amount exists', () => {
  const f = fixture('incomplete'); const b = f.intake.proposed_changes.find(c => c.field_key === 'budget').proposed_value;
  b.currency = null; b.scope = 'unspecified';
  assert.ok(runReview(f.context, f.intake).output.issues.some(i => i.issue_id === 'ambiguous-budget'));
});
test('intake ambiguities are passed through as blocking questions', () => {
  const f = fixture('incomplete'); f.intake.ambiguities.push({field_keys:['territories'],reason:'Scope needs human review',evidence:[]});
  assert.ok(runReview(f.context, f.intake).output.issues.some(i => i.question.includes('Scope needs human review')));
});
test('complete presence fixture still needs deadline time and timezone', () => {
  const f = fixture('complete'); const r = runReview(f.context, f.intake);
  assert.equal(r.ok, true);
  assert.ok(r.output.checks.filter(c => c.rule_id.startsWith('required:')).every(c => c.result === 'pass'));
  assert.equal(r.output.checks.find(c => c.rule_id === 'deadline_unambiguous').result, 'fail');
});
test('invalid context returns safe failure', () => {
  assert.equal(runReview({}, {}).error.code, 'INVALID_CONTEXT');
});

test('explicit deadline date, time and timezone passes deadline check', () => {
  const f = fixture('complete');
  const quote = 'November 6, 2026 at 17:00 America/New_York';
  f.context.messages[0].text += ` Deadline clarified: ${quote}.`;
  const change = f.intake.proposed_changes.find(c => c.field_key === 'response_deadline');
  change.proposed_value = { supplied_text: quote, date: '2026-11-06', time: '17:00', timezone: 'America/New_York' };
  change.evidence = [{ message_id: f.context.messages[0].message_id, exact_quote: quote }];
  const r = runReview(f.context, f.intake);
  assert.equal(r.ok, true);
  assert.equal(r.output.checks.find(c => c.rule_id === 'deadline_unambiguous').result, 'pass');
  assert.ok(!r.output.issues.some(i => i.issue_id === 'ambiguous-response_deadline'));
});
