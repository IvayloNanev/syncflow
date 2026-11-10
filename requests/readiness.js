import {activeAgentAssignment} from './agent-assignment.js';
import {resolvedEscalation} from './manager-decision.js';
import {assessCatalogue} from '../catalog/availability.js';
import {effectiveFields} from "./effective-fields.js";
import {recordingMismatches} from '../catalog/identity-check.js';
export const requiredFields = ['client_contact','project','artist','track_title','recording_version','intended_use','platforms','territories','campaign_term','music_length','budget','response_deadline'];

// Internal process readiness only. No state here grants a licence or clears rights.
export function requestReadiness({request, analysis, tracking, completion = null, decisions = [], briefApproval = null, latestAnalysis = analysis}) {
  const fields=effectiveFields(request,analysis,decisions);
  const catalogue=assessCatalogue({messages:request.messages,fields});
  const catalogueBlocked=(!request.recording_id&&catalogue.status==='not_found')||catalogue.catalogueWide;
  const confirmed = new Set(fields.map(f => f.field_key));
  const missing = requiredFields.filter(key => !confirmed.has(key));
  const issues = analysis?.result?.stages?.review?.output?.issues || [];
  const currentAnalysis = !!analysis?.result?.ok && analysis.base_revision === request.revision && latestAnalysis?.run_id===analysis.run_id && (!latestAnalysis.status||latestAnalysis.status==='completed');
  const briefApproved=!!briefApproval&&briefApproval.request_revision===request.revision&&briefApproval.analysis_run_id===analysis?.run_id&&currentAnalysis;
  const reviews = tracking.reviewers;
  const reconfirm = reviews.filter(r => r.needs_reconfirmation);
  const allApproved = reviews.length > 0 && reviews.every(r => r.status === 'Approved' && !r.needs_reconfirmation);
  const reasons = [];
  const identityMismatch=recordingMismatches({...request,confirmed_fields:fields.map(f=>({...f,state:"confirmed"}))});
  if(catalogueBlocked)reasons.push(catalogue.message);
  if(identityMismatch.length)reasons.push(`Recorded client ${identityMismatch.map(k=>k.replaceAll('_',' ')).join(', ')} does not match the selected catalog recording. Resolve identity before internal review.`);
  if (!request.recording_id) reasons.push('Exact catalog recording is unresolved.');
  if (!currentAnalysis) reasons.push('Analyze the current revision to refresh the checklist.');
  else if (issues.length) reasons.push(`${issues.length} checklist questions or ambiguities remain.`);
  if (missing.length) reasons.push(`${missing.length} required details are missing or need attention.`);
  const intakeReady = !catalogueBlocked && !!request.recording_id && !identityMismatch.length && currentAnalysis && issues.length === 0 && missing.length === 0;
  if (reconfirm.length) reasons.push(`${reconfirm.length} reviewer decisions need reconfirmation.`);
  if (reviews.some(r => r.status === 'Pending')) reasons.push('Required reviewer decisions are pending.');
  if (reviews.some(r => r.status === 'Changes requested' && !r.needs_reconfirmation)) reasons.push('A reviewer requested changes.');
  if (reviews.some(r => r.status === 'Declined' && !r.needs_reconfirmation)) reasons.push('A reviewer declined the request.');
  const assignment=activeAgentAssignment({...request,reviewers:tracking});
  const managerPending=assignment?.destination==='internal'||(assignment?.destination!=='coordinator'&&!!request.internal_review_request&&!resolvedEscalation({...request,reviewers:tracking}));
  if(managerPending)reasons.push('A manager decision is needed for this internal review.');
  const canComplete = intakeReady && !managerPending && (!reviews.length||allApproved);
  const completed = canComplete && completion?.request_revision === request.revision && completion?.review_version === tracking.version;
  let status, next_action;
  if (completed) {status='Internal review complete';next_action='Continue the separate licensing process; no rights have been granted here.';}
  else if (managerPending) {status='Internal review pending';next_action='Review the case and obtain the manager’s decision.';}
  else if (!currentAnalysis) {status='Needs analysis';next_action='Recheck the current conversation and recorded requirements.';}
  else if (!request.recording_id&&catalogue.status==='not_found') {status='Not found in catalogue';next_action=catalogue.question;}
  else if (catalogue.catalogueWide) {status='Specify requested recordings';next_action=catalogue.question;}
  else if (!request.recording_id) {status='Recording unresolved';next_action='Resolve the exact recording before internal handoff.';}
  else if (identityMismatch.length) {status='Recording mismatch';next_action='Check the selected recording against confirmed artist, title and version. Correct the recording or obtain a source-backed client correction.';}
  else if (issues.length) {status='Needs clarification';next_action='Resolve checklist questions, then recheck the request.';}
  else if (missing.length) {status='Needs request details';next_action='Resolve missing or uncertain details, then analyze the updated conversation.';}
  else if (reviews.some(r=>r.status==='Declined'&&!r.needs_reconfirmation)) {status='Declined';next_action='Review the decline with the responsible internal reviewer.';}
  else if (reviews.some(r=>r.status==='Changes requested'&&!r.needs_reconfirmation)) {status='Changes requested';next_action='Address the reviewer’s notes and record a new decision.';}
  else if (!reviews.length) {status='Ready for coordination';next_action='Review the response and continue client coordination. Send to Internal Review if a manager decision is needed.';}
  else if (!allApproved) {status='Internal review pending';next_action='Obtain pending decisions or reconfirm decisions for this revision.';}
  else {status='Ready to complete internal review';next_action='Record internal review completion after checking the handoff.';}
  return {status,next_action,intake_ready:intakeReady,brief_approved:briefApproved,can_approve_brief:intakeReady&&!briefApproved,brief_approval:briefApproval?{...briefApproval,outdated:!briefApproved}:null,can_complete:canComplete && !completed,completed:!!completed,reasons,unconfirmed_fields:missing,missing_fields:missing,agent_extracted_count:fields.filter(f=>f.origin==="agent").length,
    completion:completion ? {...completion,needs_reconfirmation:!completed} : null};
}
