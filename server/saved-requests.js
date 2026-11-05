import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { openRequestStore } from '../requests/store.js';
import { analyzeSavedRequest } from '../requests/analyze-saved.js';
import { reviewRecording } from '../catalog/review.js';
import { createClaudeProvider } from '../agents/intake/providers/claude.js';
import { createFollowUpClaudeProvider } from '../agents/follow-up/providers/claude.js';

// Single local operator only. This is NOT an authenticated shared workspace.
const actor = 'local-coordinator';
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
  list: ['action'], get: ['action', 'request_id'],
  create: ['action', 'email', 'timezone', 'recording_id', 'idempotency_key'],
  reply: ['action', 'request_id', 'expected_revision', 'text', 'idempotency_key'],
  analyze: ['action', 'request_id', 'expected_revision', 'idempotency_key'],
};
function detail(store, id) {
  const request = store.get(actor, id);
  return { request, active_analysis: store.activeAnalysis(actor, id),
    analyses: store.analyses(actor, id).map(({ run_id, base_revision, status, created_at }) => ({ run_id, base_revision, status, created_at })),
    catalog_review: reviewRecording(request.recording_id) };
}
const safeErrors = {
  NOT_FOUND: [404, 'Request not found.'],
  REVISION_CONFLICT: [409, 'This request changed. Reopen it before adding a reply or analyzing again.'],
  IDEMPOTENCY_CONFLICT: [409, 'This retry key belongs to different input. Reopen the request and review your changes.'],
  INVALID_RECORDING: [400, 'Choose a valid catalog recording.'],
  INVALID_TIMEZONE: [400, 'Choose a valid timezone.'],
};
export function createSavedRequestsHandler({ enabled = () => process.env.NODE_ENV === 'development',
  openStore = localStore, providers = () => ({ intakeProvider: createClaudeProvider(), followUpProvider: createFollowUpClaudeProvider() }) } = {}) {
  let analyzing = false;
  const json = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  return async function POST(req) {
    if (!enabled()) return json(503, { error: { code: 'LOCAL_DEVELOPMENT_ONLY', message: 'Saved requests are available on the local development server only.' } });
    const url = new URL(req.url); const authority = req.headers.get('host') || url.host;
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(authority)
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
      if (!keys || Object.keys(input).some(key => !keys.includes(key)))
        return json(400, { error: { code: 'INVALID_INPUT', message: 'Use a supported request command and fields.' } });
      // Prevent duplicate live runs in this process while allowing replies to invalidate an in-flight snapshot.
      if (input.action === 'analyze' && analyzing) return json(429, { error: { code: 'BUSY', message: 'An analysis is running. Wait, then reopen this request before retrying.' } });
      store = openStore();
      if (input.action === 'list') {
        const requests = store.list(actor).map(item => {
          const r = store.get(actor, item.id);
          return { ...item, preview: r.messages[0].text.slice(0, 100), recording_id: r.recording_id ?? null };
        }).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        return json(200, { requests });
      }
      if (input.action === 'get') return json(200, detail(store, input.request_id));
      const { action, ...fields } = input;
      if (action === 'create') {
        const result = store.create({ ...fields, actor_id: actor });
        return json(result.replayed ? 200 : 201, { ...detail(store, result.request.id), replayed: result.replayed });
      }
      if (action === 'reply') {
        const result = store.appendReply({ ...fields, actor_id: actor });
        return json(200, { ...detail(store, result.request.id), replayed: result.replayed });
      }
      analyzing = true;
      try {
        const lazy = {};
        let configured;
        for (const key of ['intakeProvider', 'followUpProvider']) lazy[key] = {
          id: 'server:claude', mode: 'live', async generate(args) { configured ??= providers(); return configured[key].generate(args); },
        };
        const outcome = await analyzeSavedRequest(store, { ...fields, actor_id: actor }, lazy);
        return json(200, { ...detail(store, input.request_id), analysis_status: outcome.analysis.status, replayed: outcome.replayed });
      } finally { analyzing = false; }
    } catch (error) {
      const [status, message] = safeErrors[error.code] || (error.code?.startsWith('INVALID_') ? [400, 'Invalid request details.'] : [500, 'Unable to complete the request. Your saved history is retained; reopen before retrying.']);
      return json(status, { error: { code: safeErrors[error.code] || error.code?.startsWith('INVALID_') ? error.code : 'REQUEST_FAILED', message } });
    } finally { store?.close(); }
  };
}
