import checklist from '../../contracts/checklists/intake-v1.json' with { type: 'json' };
import { validateContract } from '../../contracts/validate.js';

/** Deterministic review of candidate facts. Does not save, confirm, clear issues or approve rights. */
export function runReview(context, intake) {
  try { validateContract('context', context); }
  catch { return { ok: false, stage: 'review', error: { code: 'INVALID_CONTEXT', message: 'Correct request context before review.' } }; }
  try { validateContract('intake', intake, context); }
  catch { return { ok: false, stage: 'review', error: { code: 'INVALID_INTAKE', message: 'Intake failed schema, evidence or version validation.' } }; }
  const fields = new Map(context.confirmed_fields.map(f => [f.field_key, structuredClone(f)]));
  for (const change of intake.proposed_changes)
    fields.set(change.field_key, { state: 'proposed', value: change.proposed_value, evidence: change.evidence });
  const issues = structuredClone(context.unresolved_issues);
  const ids = new Set(issues.map(i => i.issue_id));
  const add = (id, type, keys, question, evidence = []) => {
    let unique = id;
    while (ids.has(unique)) unique += '-new';
    ids.add(unique);
    issues.push({ issue_id: unique, type, severity: 'blocking', field_keys: keys, question, evidence: structuredClone(evidence) });
  };
  const checks = checklist.fields.map(({ key }) => {
    const field = fields.get(key);
    const present = field?.state === 'not_applicable' || field?.value != null;
    if (!present && !issues.some(i => i.type === 'missing' && i.field_keys.includes(key)))
      add(`missing-${key}`, 'missing', [key], key === 'budget' ? 'Please confirm the budget amount, currency and rights scope (master, publishing or both).' : `Please confirm ${key.replaceAll('_', ' ')}.`);
    return { rule_id: `required:${key}`, result: present ? 'pass' : 'fail' };
  });
  for (const [index, ambiguity] of intake.ambiguities.entries())
    add(`intake-ambiguity-${index}`, ambiguity.issue_type || 'ambiguous', ambiguity.field_keys, `Please clarify: ${ambiguity.reason}`, ambiguity.evidence);
  const inspect = (key, unclear, question) => {
    const field = fields.get(key);
    if (field?.value && unclear(field.value))
      add(`ambiguous-${key}`, 'ambiguous', [key], question, field.evidence);
  };
  inspect('platforms', value => value.every(v => /^(online|internet|digital|web)$/i.test(v.trim())),
    'Which specific platforms or channels will the music appear on?');
  const budget = fields.get('budget')?.value;
  if (budget) {
    const needed = [budget.amount === null && 'amount', budget.currency === null && 'currency',
      budget.scope === 'unspecified' && 'rights scope (master, publishing or both)'].filter(Boolean);
    if (needed.length) inspect('budget', () => true, `Please confirm the budget ${needed.join(' and ')}.`);
  }
  inspect('campaign_term', v => !v.duration_text && !(v.start_date && v.end_date),
    'Please confirm campaign duration or both start and end dates.');
  inspect('music_length', v => v.seconds === null, 'Please confirm the length of music in seconds.');
  const deadlineValue = fields.get('response_deadline')?.value;
  if (deadlineValue) {
    const needed = ['date', 'time', 'timezone'].filter(key => !deadlineValue[key]);
    if (needed.length) inspect('response_deadline', () => true, `Please confirm the response deadline ${needed.join(' and ')}.`);
  }
  const deadline = fields.get('response_deadline');
  checks.push({ rule_id: 'deadline_unambiguous', result: deadline?.state === 'not_applicable' ? 'pass'
    : !deadline?.value ? 'unknown' : deadline.value.date && deadline.value.time && deadline.value.timezone ? 'pass' : 'fail' });
  // An extractor's silence cannot prove one recording or absence of conflicting scope.
  checks.push({ rule_id: 'single_recording', result: issues.some(i => i.type === 'split_request') ? 'fail' : 'unknown' },
    { rule_id: 'evidence_valid', result: 'pass' },
    { rule_id: 'no_conflicting_scope', result: issues.some(i => ['conflict', 'ambiguous'].includes(i.type)) ? 'fail' : 'unknown' });
  const output = { schema_version: context.schema_version, run_id: context.run_id,
    base_record_version: context.base_record_version, issues, checks };
  validateContract('review', output, context);
  // Keep stored issues open, but route already supplied answers to coordinator confirmation.
  const coordinator_issue_ids = context.unresolved_issues.filter(issue => issue.type === 'missing'
    && issue.field_keys.every(key => {
      const field = fields.get(key);
      return (field?.state === 'not_applicable' || field?.value != null)
        && !issues.some(other => other.issue_id !== issue.issue_id
          && other.type !== 'missing' && other.field_keys.includes(key));
    })).map(issue => issue.issue_id);
  return { ok: true, stage: 'review', mode: 'rules', freshness: 'not_checked', coordinator_issue_ids, output };
}
