import { runIntake } from '../intake/run-intake.js';
import { runReview } from '../review/run-review.js';
import { runFollowUp } from '../follow-up/run-follow-up.js';

/** Sequential, proposal-only workflow. No writes, sends, approvals or automatic retries. */
export async function runWorkflow(context, { intakeProvider, followUpProvider, timeoutMs = 30000, getCurrentVersion, catalogueCheck=false } = {}) {
  let snapshot;
  try { snapshot = structuredClone(context); }
  catch { return { ok: false, failed_stage: 'intake', error: { code: 'INVALID_CONTEXT', message: 'Request context could not be copied.' }, stages: {} }; }
  const stages = {};
  const failed = (name, result) => ({ ok: false, failed_stage: name, error: result.error, stages,
    manual_review_required: true, saved: false, sent: false });
  stages.intake = await runIntake(snapshot, { provider: intakeProvider, timeoutMs, getCurrentVersion });
  if (!stages.intake.ok) return failed('intake', stages.intake);
  stages.review = runReview(snapshot, stages.intake.output,{catalogueCheck});
  if (!stages.review.ok) return failed('review', stages.review);
  const coordinatorIds = new Set(stages.review.coordinator_issue_ids);
  const draftContext = { ...snapshot, unresolved_issues: snapshot.unresolved_issues.filter(i => !coordinatorIds.has(i.issue_id)) };
  const draftReview = { ...stages.review.output, issues: stages.review.output.issues.filter(i => !coordinatorIds.has(i.issue_id)) };
  stages.follow_up = await runFollowUp(draftContext, draftReview, { provider: followUpProvider, timeoutMs, getCurrentVersion, catalogueAssessment:stages.review.catalogue_assessment });
  if (!stages.follow_up.ok) return failed('follow_up', stages.follow_up);
  return { ok: true, ...(catalogueCheck?{catalogue_policy:'current-catalogue-v1'}:{}), run_id: snapshot.run_id, base_record_version: snapshot.base_record_version,
    freshness: stages.follow_up.skipped ? stages.intake.freshness : stages.follow_up.freshness,
    status: stages.follow_up.skipped ? 'review_required' : 'draft_ready_for_review',
    coordinator_review_issue_ids: [...coordinatorIds],
    manual_review_required: true, saved: false, sent: false, stages };
}
