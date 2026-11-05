import { reviewRecording } from '../catalog/review.js';
import { randomUUID } from 'node:crypto';
import { runWorkflow } from '../agents/workflow/run-workflow.js';

/** New unsaved request only; IDs/revisions are generated here, never accepted from clients. */
export async function analyzeEmail(input, providers) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some(key => !['email', 'timezone', 'recording_id'].includes(key))
      || typeof input.email !== 'string' || !input.email.trim() || input.email.length > 20000
      || typeof input.timezone !== 'string')
    return { status: 400, body: { error: { code: 'INVALID_INPUT', message: 'Provide email (1–20000 characters) and a valid timezone only.' } } };
  try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }); }
  catch { return { status: 400, body: { error: { code: 'INVALID_TIMEZONE', message: 'Provide a valid timezone.' } } }; }
  let catalogReview;
  try { catalogReview = reviewRecording(input.recording_id); }
  catch { return { status: 400, body: { error: { code: 'INVALID_RECORDING', message: 'Select a recording from the catalog.' } } }; }
  const context = { schema_version: '1.0', run_id: randomUUID(), request_id: randomUUID(),
    base_record_version: 0, checklist_version: 'intake-v1', coordinator_timezone: input.timezone,
    messages: [{ message_id: 'initial-email', kind: 'initial', text: input.email, supplied_message_date: null }],
    confirmed_fields: [], unresolved_issues: [] };
  const result = await runWorkflow(context, providers);
  return { status: result.ok ? 200 : 502, body: { ...result, catalog_review: catalogReview } };
}
