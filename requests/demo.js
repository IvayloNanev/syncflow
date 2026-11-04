import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openRequestStore } from './store.js';
const dir = mkdtempSync(join(tmpdir(), 'syncflow-store-demo-')); const path = join(dir, 'demo.sqlite');
let store;
try {
  store = openRequestStore(path);
  const created = store.create({ actor_id: 'fictional-coordinator', idempotency_key: 'demo-create', email: 'Fictional request for a film trailer.', timezone: 'America/New_York' });
  store.appendReply({ actor_id: 'fictional-coordinator', request_id: created.request.id, expected_revision: 0, idempotency_key: 'demo-reply', text: 'The campaign will run for six months.' });
  store.close(); store = openRequestStore(path);
  const restored = store.get('fictional-coordinator', created.request.id);
  console.log(JSON.stringify({ reopened: true, revision: restored.revision, messages: restored.messages.length, audit_events: store.history('fictional-coordinator', restored.id).length, model_calls: 0, sent: false }, null, 2));
} finally { store?.close(); rmSync(dir, { recursive: true, force: true }); }
