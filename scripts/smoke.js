// Fresh-checkout smoke test (issue #18). For the running app, also open http://127.0.0.1:3000/api/health.
// No API key, network call or model use. Runs the real /api/requests handler against a temporary
// database with mock providers: create -> analyze -> reply -> dashboard list, checking the
// server-derived workflow status at each step. Nothing is sent to anyone.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openRequestStore } from '../requests/store.js';
import { createSavedRequestsHandler } from '../server/saved-requests.js';
import { createFollowUpMockProvider } from '../agents/follow-up/providers/mock.js';

const dir = mkdtempSync(join(tmpdir(), 'syncflow-smoke-'));
let steps = 0;
const check = (label, ok, detail = '') => {
  steps++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) throw new Error(`Smoke step failed: ${label}`);
};
try {
  const providers = () => ({ intakeProvider: { id: 'smoke', mode: 'mock', generate: async ({ context }) =>
    ({ schema_version: '1.0', run_id: context.run_id, base_record_version: context.base_record_version, proposed_changes: [], ambiguities: [] }) },
  followUpProvider: createFollowUpMockProvider() });
  const post = createSavedRequestsHandler({ enabled: () => true, openStore: () => openRequestStore(join(dir, 'smoke.sqlite')), providers });
  const call = async body => {
    const response = await post(new Request('http://127.0.0.1:3000/api/requests', { method: 'POST',
      headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' }, body: JSON.stringify(body) }));
    return { status: response.status, ...await response.json() };
  };

  const created = await call({ action: 'create', email: 'Contact: Smoke Test (fictional). Online ad in Canada.', timezone: 'UTC', recording_id: 'TRACK-0001', idempotency_key: 'smoke-create' });
  check('create saves a request', created.status === 201 && created.workflow?.status === 'Needs analysis', created.workflow?.status);
  const id = created.request.id;

  const replay = await call({ action: 'create', email: 'Contact: Smoke Test (fictional). Online ad in Canada.', timezone: 'UTC', recording_id: 'TRACK-0001', idempotency_key: 'smoke-create' });
  check('retrying the same save does not duplicate it', replay.replayed === true && replay.request.id === id);

  const analyzed = await call({ action: 'analyze', request_id: id, expected_revision: created.request.revision, idempotency_key: 'smoke-analyze' });
  check('mock analysis completes', analyzed.analysis_status === 'completed');
  check('missing details need clarification', analyzed.workflow?.status === 'Needs clarification', analyzed.workflow?.next_action);
  check('no facts are confirmed automatically', analyzed.request.confirmed_fields.length === 0);
  check('draft is never marked sent', analyzed.active_analysis?.result?.sent === false);

  const replied = await call({ action: 'reply', request_id: id, expected_revision: analyzed.request.revision, text: 'Project is Aurora Launch.', idempotency_key: 'smoke-reply' });
  check('reply appends and outdates the analysis', replied.request.messages.length === 2 && replied.active_analysis === null && replied.workflow?.status === 'Needs analysis');

  const list = await call({ action: 'list' });
  check('dashboard lists the request with status', list.requests.length === 1 && list.requests[0].status === 'Needs analysis', list.requests[0]?.blocker);
  console.log(`\nSmoke test passed: ${steps} checks. No email was sent and no model was called.`);
} catch (error) {
  console.error(`\n${error.message}`);
  process.exitCode = 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
