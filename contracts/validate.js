import Ajv from 'ajv';
import shared from './shared.schema.json' with { type: 'json' };
import contextSchema from './context.schema.json' with { type: 'json' };
import intakeSchema from './intake.schema.json' with { type: 'json' };
import reviewSchema from './review.schema.json' with { type: 'json' };
import followUpSchema from './follow_up.schema.json' with { type: 'json' };

const ajv = new Ajv({ allErrors: true, strict: true });
ajv.addSchema(shared);
const validators = Object.fromEntries(Object.entries({ context: contextSchema, intake: intakeSchema, review: reviewSchema, follow_up: followUpSchema })
  .map(([kind, schema]) => [kind, ajv.compile(schema)]));
const noWaiver = new Set(['client_contact', 'project', 'artist', 'track_title',
  'recording_version', 'intended_use', 'platforms', 'territories']);

export class ContractError extends Error {
  constructor(errors) { super(errors.join('\n')); this.name = 'ContractError'; this.errors = errors; }
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const unique = (items, key, errors, label) => {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item[key])) errors.push(`${label}: duplicate ${key} ${item[key]}`);
    seen.add(item[key]);
  }
};
function dates(value, errors) {
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (['date', 'start_date', 'end_date'].includes(key) && item !== null) {
      const parsed = new Date(`${item}T00:00:00Z`);
      if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== item)
        errors.push(`Invalid calendar date: ${item}`);
    }
    if (key === 'timezone' && item !== null) {
      try { new Intl.DateTimeFormat('en', { timeZone: item }); }
      catch { errors.push(`Invalid timezone: ${item}`); }
    }
    dates(item, errors);
  }
}
function evidence(items, context, errors) {
  for (const item of items) {
    const message = context.messages.find(m => m.message_id === item.message_id);
    if (!message) errors.push(`Unknown evidence message: ${item.message_id}`);
    else if (!message.text.includes(item.exact_quote))
      errors.push(`Evidence quote not found in ${item.message_id}: ${item.exact_quote}`);
  }
}
function schema(kind, payload) {
  if (!validators[kind]) throw new ContractError([`Unknown contract kind: ${kind}`]);
  if (!validators[kind](payload)) throw new ContractError(
    validators[kind].errors.map(e => `${e.instancePath || '/'} ${e.message}`),
  );
}

/** Validate shape and cross-record references; never mutate payload or confirmed state. */
export function validateContract(kind, payload, context = null, review = null) {
  schema(kind, payload);
  const errors = [];
  dates(payload, errors);
  if (kind === 'context') {
    unique(payload.messages, 'message_id', errors, 'messages');
    unique(payload.confirmed_fields, 'field_key', errors, 'confirmed_fields');
    unique(payload.unresolved_issues, 'issue_id', errors, 'unresolved_issues');
    try { new Intl.DateTimeFormat('en', { timeZone: payload.coordinator_timezone }); }
    catch { errors.push('Invalid coordinator timezone'); }
    for (const f of payload.confirmed_fields) {
      evidence(f.evidence, payload, errors);
      if (f.state === 'unknown' && (f.value !== null || f.evidence.length || f.confirmed_by !== null || f.confirmed_at !== null || f.not_applicable_reason !== null))
        errors.push(`${f.field_key}: unknown fields must have null value/confirmation and no evidence or waiver`);
      if (f.state === 'confirmed' && (f.value === null || !f.confirmed_by || !f.confirmed_at || f.not_applicable_reason !== null))
        errors.push(`${f.field_key}: confirmed fields require value and human attribution, without waiver`);
      if (f.state === 'not_applicable' && (noWaiver.has(f.field_key) || f.value !== null || !f.not_applicable_reason?.trim() || !f.confirmed_by || !f.confirmed_at))
        errors.push(`${f.field_key}: invalid N/A or missing reason/human attribution`);
    }
    for (const issue of payload.unresolved_issues) evidence(issue.evidence, payload, errors);
  } else {
    if (!context) throw new ContractError(['Context is required for output validation']);
    validateContract('context', context);
    if (payload.run_id !== context.run_id) errors.push('Run ID does not match context');
    if (payload.base_record_version !== context.base_record_version) errors.push('Stale base record version');
    if (kind === 'intake') {
      unique(payload.proposed_changes, 'proposal_id', errors, 'proposed_changes');
      unique(payload.proposed_changes, 'field_key', errors, 'proposed_changes');
      for (const change of payload.proposed_changes) {
        evidence(change.evidence, context, errors);
        const old = context.confirmed_fields.find(f => f.field_key === change.field_key);
        const previous = old?.state === 'confirmed' ? old.value : null;
        if (!equal(change.previous_value, previous)) errors.push(`${change.field_key}: previous value differs from confirmed state`);
      }
      for (const ambiguity of payload.ambiguities) {
        evidence(ambiguity.evidence, context, errors);
        if (['conflict', 'split_request'].includes(ambiguity.issue_type) && !ambiguity.evidence.length)
          errors.push('Conflict/split classification requires source evidence');
      }
    }
    if (kind === 'review') {
      unique(payload.issues, 'issue_id', errors, 'issues');
      unique(payload.checks, 'rule_id', errors, 'checks');
      for (const issue of payload.issues) evidence(issue.evidence, context, errors);
    }
    if (kind === 'follow_up') {
      if (!review) throw new ContractError(['Validated review is required for follow-up validation']);
      validateContract('review', review, context);
      const available = new Set([...context.unresolved_issues, ...review.issues].map(i => i.issue_id));
      if (!payload.addressed_issue_ids.length) errors.push('No unresolved issues addressed; skip Follow-up instead');
      for (const id of payload.addressed_issue_ids)
        if (!available.has(id)) errors.push(`Unknown addressed issue: ${id}`);
    }
  }
  if (errors.length) throw new ContractError(errors);
  return payload;
}

export function validateFixture(fixture) {
  validateContract('context', fixture.context);
  validateContract('intake', fixture.intake, fixture.context);
  validateContract('review', fixture.review, fixture.context);
  if (fixture.follow_up !== null)
    validateContract('follow_up', fixture.follow_up, fixture.context, fixture.review);
  return fixture;
}
