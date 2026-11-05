import { resolveRecording } from '../catalog/review.js';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID, createHash } from 'node:crypto';
import { validateSuccessfulAnalysis } from './validate-analysis.js';
import { validateContract } from '../contracts/validate.js';

export class RequestStoreError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const fail = code => { throw new RequestStoreError(code); };
const text = (value, max = 20000) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
};
const hash = value => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const keys = (input, allowed) => input && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).every(k => allowed.includes(k));
const identity = actor => { if (!text(actor, 200)) fail('INVALID_ACTOR'); };
const command = input => {
  identity(input.actor_id);
  if (!text(input.idempotency_key, 200)) fail('INVALID_IDEMPOTENCY_KEY');
};

/** Trusted server/CLI boundary only: actor_id must come from authenticated caller context.
 * No HTTP/auth, arbitrary updates, confirmation or decisions. Analysis artifacts stay separate from confirmed facts.
 */
export function openRequestStore(path = ':memory:') {
  const db = new DatabaseSync(path, { timeout: 1000 });
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS events (request_id TEXT NOT NULL REFERENCES requests(id), revision INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(request_id, revision)) STRICT;
    CREATE TABLE IF NOT EXISTS commands (owner_id TEXT NOT NULL, scope TEXT NOT NULL, command_key TEXT NOT NULL, payload_hash TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(owner_id, scope, command_key)) STRICT;
    CREATE TABLE IF NOT EXISTS analysis_runs (sequence INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL UNIQUE, request_id TEXT NOT NULL REFERENCES requests(id), command_key TEXT NOT NULL, base_revision INTEGER NOT NULL, context TEXT NOT NULL, status TEXT NOT NULL, result TEXT, result_hash TEXT, created_at TEXT NOT NULL, finished_at TEXT, UNIQUE(request_id,command_key)) STRICT;
    CREATE TABLE IF NOT EXISTS active_analyses (request_id TEXT PRIMARY KEY REFERENCES requests(id), run_id TEXT NOT NULL REFERENCES analysis_runs(run_id)) STRICT;`);
  const owned = (actor, id) => {
    identity(actor);
    if (!text(id, 200)) fail('INVALID_REQUEST_ID');
    const row = db.prepare('SELECT body FROM requests WHERE id=? AND owner_id=?').get(id, actor);
    if (!row) fail('NOT_FOUND');
    return JSON.parse(row.body);
  };
  const transaction = action => {
    let begun = false;
    try { db.exec('BEGIN IMMEDIATE'); begun = true; const result = action(); db.exec('COMMIT'); return result; }
    catch (error) {
      if (begun) db.exec('ROLLBACK');
      throw error instanceof RequestStoreError ? error : new RequestStoreError('STORE_FAILED');
    }
  };
  const execute = (input, scope, payload, action) => transaction(() => {
    const digest = hash(payload);
    const existing = db.prepare('SELECT payload_hash,response FROM commands WHERE owner_id=? AND scope=? AND command_key=?').get(input.actor_id, scope, input.idempotency_key);
    if (existing) {
      if (existing.payload_hash !== digest) fail('IDEMPOTENCY_CONFLICT');
      return { replayed: true, request: JSON.parse(existing.response) };
    }
    const request = action();
    db.prepare('INSERT INTO commands VALUES (?,?,?,?,?)').run(input.actor_id, scope, input.idempotency_key, digest, JSON.stringify(request));
    return { replayed: false, request };
  });
  const event = (request, actor, action, messageId) => db.prepare('INSERT INTO events VALUES (?,?,?)').run(request.id, request.revision,
    JSON.stringify({ request_id: request.id, revision: request.revision, actor_id: actor, action, message_id: messageId, at: request.updated_at }));
  return {
    create(input) {
      if (!keys(input, ['actor_id', 'idempotency_key', 'email', 'timezone', 'recording_id'])) fail('INVALID_INPUT');
      command(input);
      if (!text(input.email) || !text(input.timezone, 100)) fail('INVALID_INPUT');
      try { new Intl.DateTimeFormat('en', { timeZone: input.timezone }); } catch { fail('INVALID_TIMEZONE'); }
      let recording;
      try { recording = resolveRecording(input.recording_id); } catch { fail('INVALID_RECORDING'); }
      return execute(input, 'create', { email: input.email, timezone: input.timezone, ...(recording ? { recording_id: recording.id } : {}) }, () => {
        const now = new Date().toISOString(); const messageId = randomUUID();
        const request = { id: randomUUID(), owner_id: input.actor_id, revision: 0, created_at: now, updated_at: now,
          recording_id: recording?.id ?? null, coordinator_timezone: input.timezone, messages: [{ message_id: messageId, kind: 'initial', text: input.email,
            supplied_message_date: null, received_at: now, added_by: input.actor_id }], confirmed_fields: [], unresolved_issues: [] };
        db.prepare('INSERT INTO requests VALUES (?,?,?,?)').run(request.id, request.owner_id, request.revision, JSON.stringify(request));
        event(request, input.actor_id, 'request_created', messageId);
        return request;
      });
    },
    get(actor, id) { return owned(actor, id); },
    list(actor) {
      identity(actor);
      return db.prepare('SELECT body FROM requests WHERE owner_id=? ORDER BY rowid').all(actor).map(row => {
        const r = JSON.parse(row.body); return { id: r.id, revision: r.revision, created_at: r.created_at, updated_at: r.updated_at, message_count: r.messages.length };
      });
    },
    appendReply(input) {
      if (!keys(input, ['actor_id', 'idempotency_key', 'request_id', 'expected_revision', 'text', 'supplied_message_date'])) fail('INVALID_INPUT');
      command(input);
      if (!text(input.text) || !Number.isSafeInteger(input.expected_revision) || input.expected_revision < 0
          || (input.supplied_message_date != null && !text(input.supplied_message_date, 100))) fail('INVALID_INPUT');
      // Check ownership even when replaying a previous command.
      owned(input.actor_id, input.request_id);
      return execute(input, `append:${input.request_id}`, { expected_revision: input.expected_revision, text: input.text, supplied_message_date: input.supplied_message_date ?? null }, () => {
        const request = owned(input.actor_id, input.request_id);
        if (request.revision !== input.expected_revision) fail('REVISION_CONFLICT');
        if (request.revision >= Number.MAX_SAFE_INTEGER) fail('REVISION_CONFLICT');
        const now = new Date().toISOString(); const messageId = randomUUID();
        request.messages.push({ message_id: messageId, kind: 'reply', text: input.text,
          supplied_message_date: input.supplied_message_date ?? null, received_at: now, added_by: input.actor_id });
        request.revision++; request.updated_at = now;
        const result = db.prepare('UPDATE requests SET revision=?,body=? WHERE id=? AND owner_id=? AND revision=?').run(request.revision, JSON.stringify(request), request.id, input.actor_id, input.expected_revision);
        if (result.changes !== 1) fail('REVISION_CONFLICT');
        db.prepare('DELETE FROM active_analyses WHERE request_id=?').run(request.id);
        db.prepare("UPDATE analysis_runs SET status='stale' WHERE request_id=? AND status='completed'").run(request.id);
        event(request, input.actor_id, 'reply_appended', messageId);
        return request;
      });
    },
    history(actor, id) {
      owned(actor, id);
      return db.prepare('SELECT body FROM events WHERE request_id=? ORDER BY revision').all(id).map(row => JSON.parse(row.body));
    },
    context(actor, id, runId = randomUUID()) {
      const r = owned(actor, id);
      const context = { schema_version: '1.0', run_id: runId, request_id: r.id, base_record_version: r.revision,
        checklist_version: 'intake-v1', coordinator_timezone: r.coordinator_timezone,
        messages: r.messages.map(({ message_id, kind, text, supplied_message_date }) => ({ message_id, kind, text, supplied_message_date })),
        confirmed_fields: r.confirmed_fields, unresolved_issues: r.unresolved_issues };
      return validateContract('context', context);
    },
    beginAnalysis(input) {
      if (!keys(input, ['actor_id','request_id','expected_revision','idempotency_key'])) fail('INVALID_INPUT');
      command(input);
      if (!Number.isSafeInteger(input.expected_revision) || input.expected_revision < 0) fail('INVALID_INPUT');
      return transaction(() => {
        const request = owned(input.actor_id, input.request_id);
        const old = db.prepare('SELECT * FROM analysis_runs WHERE request_id=? AND command_key=?').get(request.id,input.idempotency_key);
        if (old) {
          if (old.base_revision !== input.expected_revision) fail('IDEMPOTENCY_CONFLICT');
          return { replayed:true, analysis:this.analysis(input.actor_id,request.id,old.run_id) };
        }
        if (request.revision !== input.expected_revision) fail('REVISION_CONFLICT');
        const runId = randomUUID(); const context = this.context(input.actor_id,request.id,runId);
        db.prepare('INSERT INTO analysis_runs (run_id,request_id,command_key,base_revision,context,status,created_at) VALUES (?,?,?,?,?,?,?)')
          .run(runId,request.id,input.idempotency_key,request.revision,JSON.stringify(context),'running',new Date().toISOString());
        return { replayed:false, analysis:this.analysis(input.actor_id,request.id,runId) };
      });
    },
    analysis(actor,id,runId) {
      owned(actor,id);
      const row = db.prepare('SELECT * FROM analysis_runs WHERE request_id=? AND run_id=?').get(id,runId);
      if (!row) fail('NOT_FOUND');
      return { run_id:row.run_id, request_id:id, base_revision:row.base_revision, context:JSON.parse(row.context), status:row.status,
        result:row.result===null?null:JSON.parse(row.result), created_at:row.created_at, finished_at:row.finished_at };
    },
    analyses(actor,id) {
      owned(actor,id);
      return db.prepare('SELECT run_id FROM analysis_runs WHERE request_id=? ORDER BY sequence').all(id).map(row=>this.analysis(actor,id,row.run_id));
    },
    activeAnalysis(actor,id) {
      const request=owned(actor,id);
      const row=db.prepare('SELECT a.run_id,r.base_revision FROM active_analyses a JOIN analysis_runs r ON r.run_id=a.run_id WHERE a.request_id=?').get(id);
      return row && row.base_revision===request.revision ? this.analysis(actor,id,row.run_id) : null;
    },
    finishAnalysis(input) {
      if (!keys(input,['actor_id','request_id','run_id','result'])) fail('INVALID_INPUT');
      return transaction(() => {
        const request=owned(input.actor_id,input.request_id);
        const row=db.prepare('SELECT * FROM analysis_runs WHERE request_id=? AND run_id=?').get(request.id,input.run_id);
        if (!row) fail('NOT_FOUND');
        const context=JSON.parse(row.context);
        let result;
        if (input.result?.ok===true) {
          try { result=structuredClone(input.result); validateSuccessfulAnalysis(result,context); } catch { fail('INVALID_ANALYSIS'); }
        } else if (input.result?.ok===false) {
          // Persist only a safe failure label, never arbitrary provider errors or unvalidated payloads.
          result={ok:false,failed_stage:['intake','review','follow_up'].includes(input.result.failed_stage)?input.result.failed_stage:'intake',
            error:{code:'ANALYSIS_FAILED',message:'Analysis failed. Review the request or explicitly retry with a new command key.'}};
        } else fail('INVALID_ANALYSIS');
        const digest=hash(result);
        if (row.status!=='running') {
          if(row.result_hash!==digest)fail('ANALYSIS_ALREADY_FINISHED');
          return this.analysis(input.actor_id,request.id,row.run_id);
        }
        const newest=db.prepare('SELECT MAX(sequence) AS latest FROM analysis_runs WHERE request_id=? AND base_revision=?').get(request.id,row.base_revision).latest;
        const status=request.revision!==row.base_revision?'stale':row.sequence!==newest?'superseded':result.ok?'completed':'failed';
        db.prepare('UPDATE analysis_runs SET status=?,result=?,result_hash=?,finished_at=? WHERE run_id=?')
          .run(status,JSON.stringify(result),digest,new Date().toISOString(),row.run_id);
        if(status==='completed')db.prepare('INSERT INTO active_analyses VALUES (?,?) ON CONFLICT(request_id) DO UPDATE SET run_id=excluded.run_id').run(request.id,row.run_id);
        return this.analysis(input.actor_id,request.id,row.run_id);
      });
    },
    close() { db.close(); },
  };
}
