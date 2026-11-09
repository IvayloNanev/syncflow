import {effectiveFields} from "../requests/effective-fields.js";
import { dashboardRequest } from '../requests/dashboard.js';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { openRequestStore } from '../requests/store.js';
import { analyzeSavedRequest } from '../requests/analyze-saved.js';
import { reviewRecording } from '../catalog/review.js';
import { createClaudeProvider } from '../agents/intake/providers/claude.js';
import { createFollowUpClaudeProvider } from '../agents/follow-up/providers/claude.js';

// Single local operator only. This is NOT an authenticated shared workspace.
const localActor = 'local-coordinator';
function localStore() {
  const dir = join(process.cwd(), '.syncflow-data');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const path = join(dir, 'browser-requests.sqlite');
  const store = openRequestStore(path);
  chmodSync(path, 0o600);
  return store;
}
const allowed = {
  approve_brief:['action','request_id','expected_revision','analysis_run_id','idempotency_key'],
  change_recording: ['action','request_id','expected_revision','recording_id','reason','idempotency_key'],
  save_handoff: ['action','request_id','expected_revision','expected_handoff_version','source_token','text','idempotency_key'],
  complete_review: ['action','request_id','expected_revision','expected_review_version','idempotency_key'],
  reviewer: ['action','request_id','expected_revision','expected_review_version','idempotency_key','operation','reviewer_id','name','role','status','notes'],
  set_deleted:['action','request_id','expected_revision','deleted','idempotency_key'],
  list: ['action','include_deleted'], get: ['action', 'request_id'],
  create: ['action', 'email', 'timezone', 'recording_id', 'idempotency_key'],
  reply: ['action', 'request_id', 'expected_revision', 'text', 'idempotency_key'],
  decide: ['action','request_id','expected_revision','idempotency_key','run_id','proposal_id','decision'],
  analyze: ['action', 'request_id', 'expected_revision', 'idempotency_key'],
};
export function requestDetail(store, id, actor = localActor) {
  const request = store.get(actor, id);
  request.agent_fields=effectiveFields(request,store.activeAnalysis(actor,id),store.decisions(actor,id)).filter(f=>f.origin==="agent");
  return { request, brief_approval_history:store.briefApproval(actor,id).history, recording_changes:store.history(actor,id).filter(event=>event.action==='recording_corrected'), handoff: store.handoff(actor,id), workflow: store.workflow(actor,id), reviewer_tracking: store.reviewers(actor,id), review_analysis: store.reviewAnalysis(actor,id), decisions: store.decisions(actor,id), active_analysis: store.activeAnalysis(actor, id),
    analyses: store.analyses(actor, id).map(({ run_id, base_revision, status, created_at, context, result }) => ({ run_id, base_revision, status, created_at, message_count: context.messages.length, failure: result?.ok===false ? result : null, draft: ['completed', 'stale', 'superseded'].includes(status) && result?.ok ? result.stages?.follow_up?.output ?? null : null })),
    catalog_review: reviewRecording(request.recording_id) };
}
const safeErrors = {
  BRIEF_NOT_READY:[409,'Resolve missing details, recording identity and checklist issues before approving the brief.'],
  BRIEF_ANALYSIS_CONFLICT:[409,'The analysis changed. Reopen the request and review its latest brief.'],
  HANDOFF_CONFLICT: [409, 'A newer summary was saved. Reopen the request before saving again.'],
  STALE_HANDOFF: [409, 'The request, analysis or reviewers changed. Regenerate the summary before saving.'],
  REVIEW_NOT_READY: [409, 'Internal review cannot be completed until current facts, checklist and required approvals are ready.'],
  REVIEW_CONFLICT: [409, 'Reviewer records changed. Reopen the request before saving.'],
  NOT_FOUND: [404, 'Request not found.'],
  REVISION_CONFLICT: [409, 'This request changed. Reopen it before adding a reply or analyzing again.'],
  IDEMPOTENCY_CONFLICT: [409, 'This retry key belongs to different input. Reopen the request and review your changes.'],
  STALE_PROPOSAL: [409, 'This proposal is no longer current. Reopen and analyze the current request.'],
  DECISION_EXISTS: [409, 'This proposal already has a saved decision. Reopen to see it.'],
  INVALID_RECORDING: [400, 'Choose a valid catalog recording.'],
  INVALID_TIMEZONE: [400, 'Choose a valid timezone.'],
};
export function createSavedRequestsHandler({ actor = localActor, trustedOrigin = /** @type {string|null} */ (null), enabled = () => process.env.NODE_ENV === 'development',
  openStore = localStore, customerSubmission = false, providers = () => ({ intakeProvider: createClaudeProvider(), followUpProvider: createFollowUpClaudeProvider() }) } = {}) {
  let analyzing = false;
  const json = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  return async function POST(req) {
    if (!enabled()) return json(503, { error: { code: 'LOCAL_DEVELOPMENT_ONLY', message: 'Saved requests are available on the local development server only.' } });
    const url = new URL(req.url); const authority = req.headers.get('host') || url.host;
    if (trustedOrigin ? req.headers.get('origin') !== trustedOrigin : !['127.0.0.1', 'localhost'].includes(url.hostname) || !/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(authority)
      || (req.headers.get('origin') && req.headers.get('origin') !== `http://${authority}`))
      return json(403, { error: { code: 'ORIGIN_REJECTED', message: 'Use the same local address as the app.' } });
    if (req.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
      return json(415, { error: { code: 'JSON_REQUIRED', message: 'Send JSON.' } });
    let store;
    try {
      const reader = req.body?.getReader(); const chunks = []; let size = 0;
      if (reader) try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > 100000) { await reader.cancel(); return json(413, { error: { code: 'BODY_TOO_LARGE', message: 'Request is too large.' } }); }
          chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return json(400, { error: { code: 'INVALID_JSON', message: 'Invalid JSON.' } }); }
      const keys = input && !Array.isArray(input) && typeof input === 'object' && Object.hasOwn(allowed, input.action) && allowed[input.action];
      if (!keys || (customerSubmission && input.action !== 'create') || Object.keys(input).some(key => !keys.includes(key)))
        return json(400, { error: { code: 'INVALID_INPUT', message: 'Use a supported request command and fields.' } });
      // Prevent duplicate live runs in this process while allowing replies to invalidate an in-flight snapshot.
      if (input.action === 'analyze' && analyzing) return json(429, { error: { code: 'BUSY', message: 'An analysis is running. Wait, then reopen this request before retrying.' } });
      store = await openStore();
      if (input.action === 'list') {
        const requests = store.list(actor,input.include_deleted===true).map(item => {
          const r = store.get(actor, item.id);
          r.agent_fields=effectiveFields(r,store.activeAnalysis(actor,r.id),store.decisions(actor,r.id)).filter(f=>f.origin==="agent");
          return { ...item, ...dashboardRequest(r,store.workflow(actor,r.id),store.reviewers(actor,r.id)), preview: r.messages[0].text.slice(0, 100), recording_id: r.recording_id ?? null };
        }).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        return json(200, { requests });
      }
      if (input.action === 'get') return json(200, requestDetail(store, input.request_id, actor));
      const { action, ...fields } = input;
      if(action==='set_deleted'){const result=store.setDeleted({...fields,actor_id:actor});return json(200,{...requestDetail(store,fields.request_id,actor),replayed:result.replayed});}
      if(action==='approve_brief'){const result=store.approveBrief({...fields,actor_id:actor});return json(200,{...requestDetail(store,fields.request_id,actor),replayed:result.replayed});}
      if (action === 'create') {
        const result = store.create({ ...fields, actor_id: actor });
        return json(result.replayed ? 200 : 201, customerSubmission ? { request_id: result.request.id, status: "submitted", replayed: result.replayed } : { ...requestDetail(store, result.request.id, actor), replayed: result.replayed });
      }
      if (action === 'reply') {
        const result = store.appendReply({ ...fields, actor_id: actor });
        return json(200, { ...requestDetail(store, result.request.id, actor), replayed: result.replayed });
      }
      if (action === 'change_recording') {
        const result=store.changeRecording({...fields,actor_id:actor});
        return json(200,{...requestDetail(store, result.request.id, actor),replayed:result.replayed});
      }
      if (action === 'save_handoff') {
        const result=store.saveHandoff({...fields,actor_id:actor});
        return json(200,{...requestDetail(store, result.request.id, actor),replayed:result.replayed});
      }
      if (action === 'complete_review') {
        const result=store.completeReview({...fields,actor_id:actor});
        return json(200,{...requestDetail(store, result.request.id, actor),replayed:result.replayed});
      }
      if (action === 'reviewer') {
        const result = store.recordReview({...fields,actor_id:actor});
        return json(200,{...requestDetail(store, result.request.id, actor),replayed:result.replayed});
      }
      if (action === 'decide') {
        const result = store.decideProposal({ ...fields, actor_id: actor });
        return json(200, { ...requestDetail(store, result.request.id, actor), replayed:result.replayed });
      }
      analyzing = true;
      try {
        const lazy = {};
        let configured;
        for (const key of ['intakeProvider', 'followUpProvider']) lazy[key] = {
          id: 'server:claude', mode: 'live', async generate(args) { configured ??= providers(); return configured[key].generate(args); },
        };
        const outcome = await analyzeSavedRequest(store, { ...fields, actor_id: actor }, lazy);
        return json(200, { ...requestDetail(store, input.request_id, actor), analysis_status: outcome.analysis.status, replayed: outcome.replayed });
      } finally { analyzing = false; }
    } catch (error) {
      const [status, message] = safeErrors[error.code] || (error.code?.startsWith('INVALID_') ? [400, 'Invalid request details.'] : [500, 'Unable to complete the request. Your saved history is retained; reopen before retrying.']);
      return json(status, { error: { code: safeErrors[error.code] || error.code?.startsWith('INVALID_') ? error.code : 'REQUEST_FAILED', message } });
    } finally { store?.close(); }
  };
}
