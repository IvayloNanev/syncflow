export const requiredFields = ['client_contact','project','artist','track_title','recording_version','intended_use','platforms','territories','campaign_term','music_length','budget','response_deadline'];

// Internal process readiness only. No state here grants a licence or clears rights.
export function requestReadiness({request, analysis, tracking, completion = null}) {
  const confirmed = new Set(request.confirmed_fields.filter(f => f.state === 'confirmed').map(f => f.field_key));
  const missing = requiredFields.filter(key => !confirmed.has(key));
  const issues = analysis?.result?.stages?.review?.output?.issues || [];
  const currentAnalysis = !!analysis?.result?.ok && analysis.base_revision === request.revision;
  const reviews = tracking.reviewers;
  const reconfirm = reviews.filter(r => r.needs_reconfirmation);
  const allApproved = reviews.length > 0 && reviews.every(r => r.status === 'Approved' && !r.needs_reconfirmation);
  const reasons = [];
  if (!request.recording_id) reasons.push('Exact catalog recording is unresolved.');
  if (!currentAnalysis) reasons.push('Analyze the current revision to refresh the checklist.');
  else if (issues.length) reasons.push(`${issues.length} checklist questions or ambiguities remain.`);
  if (missing.length) reasons.push(`${missing.length} required facts still need coordinator confirmation.`);
  const intakeReady = !!request.recording_id && currentAnalysis && issues.length === 0 && missing.length === 0;
  if (!reviews.length) reasons.push('Assign at least one required internal reviewer.');
  if (reconfirm.length) reasons.push(`${reconfirm.length} reviewer decisions need reconfirmation.`);
  if (reviews.some(r => r.status === 'Pending')) reasons.push('Required reviewer decisions are pending.');
  if (reviews.some(r => r.status === 'Changes requested' && !r.needs_reconfirmation)) reasons.push('A reviewer requested changes.');
  if (reviews.some(r => r.status === 'Declined' && !r.needs_reconfirmation)) reasons.push('A reviewer declined the request.');
  const canComplete = intakeReady && allApproved;
  const completed = canComplete && completion?.request_revision === request.revision && completion?.review_version === tracking.version;
  let status, next_action;
  if (completed) {status='Internal review complete';next_action='Continue the separate licensing process; no rights have been granted here.';}
  else if (!currentAnalysis) {status='Needs analysis';next_action='Recheck the current conversation and confirmed facts.';}
  else if (!request.recording_id) {status='Recording unresolved';next_action='Resolve the exact recording before internal handoff.';}
  else if (issues.length) {status='Needs clarification';next_action='Resolve checklist questions, then recheck the request.';}
  else if (missing.length) {status='Needs fact confirmation';next_action='Review source evidence and confirm the remaining required facts.';}
  else if (reviews.some(r=>r.status==='Declined'&&!r.needs_reconfirmation)) {status='Declined';next_action='Review the decline with the responsible internal reviewer.';}
  else if (reviews.some(r=>r.status==='Changes requested'&&!r.needs_reconfirmation)) {status='Changes requested';next_action='Address the reviewer’s notes and record a new decision.';}
  else if (!reviews.length) {status='Ready for internal review';next_action='Prepare the handoff and assign the required reviewers.';}
  else if (!allApproved) {status='Internal review pending';next_action='Obtain pending decisions or reconfirm decisions for this revision.';}
  else {status='Ready to complete internal review';next_action='Record internal review completion after checking the handoff.';}
  return {status,next_action,intake_ready:intakeReady,can_complete:canComplete && !completed,completed:!!completed,reasons,unconfirmed_fields:missing,
    completion:completion ? {...completion,needs_reconfirmation:!completed} : null};
}
