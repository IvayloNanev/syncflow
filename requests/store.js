import {effectiveFields} from "./effective-fields.js";
import { safeAnalysisFailure } from './analysis-failure.js';
import { requestReadiness } from './readiness.js';
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
 * No HTTP/auth or arbitrary updates. Explicit coordinator decisions are revision-bound commands. Analysis artifacts stay separate from confirmed facts.
 */
export function openRequestStore(path = ':memory:', { ownerId = null, initialState = null, createId = null } = {}) {
  const db = new DatabaseSync(path, { timeout: 1000 });
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL) STRICT;
    CREATE TABLE IF NOT EXISTS events (request_id TEXT NOT NULL REFERENCES requests(id), revision INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(request_id, revision)) STRICT;
    CREATE TABLE IF NOT EXISTS commands (owner_id TEXT NOT NULL, scope TEXT NOT NULL, command_key TEXT NOT NULL, payload_hash TEXT NOT NULL, response TEXT NOT NULL, PRIMARY KEY(owner_id, scope, command_key)) STRICT;
    CREATE TABLE IF NOT EXISTS analysis_runs (sequence INTEGER PRIMARY KEY AUTOINCREMENT, run_id TEXT NOT NULL UNIQUE, request_id TEXT NOT NULL REFERENCES requests(id), command_key TEXT NOT NULL, base_revision INTEGER NOT NULL, context TEXT NOT NULL, status TEXT NOT NULL, result TEXT, result_hash TEXT, created_at TEXT NOT NULL, finished_at TEXT, UNIQUE(request_id,command_key)) STRICT;
    CREATE TABLE IF NOT EXISTS active_analyses (request_id TEXT PRIMARY KEY REFERENCES requests(id), run_id TEXT NOT NULL REFERENCES analysis_runs(run_id)) STRICT;
    CREATE TABLE IF NOT EXISTS review_heads (request_id TEXT PRIMARY KEY REFERENCES requests(id), run_id TEXT NOT NULL REFERENCES analysis_runs(run_id)) STRICT;
    CREATE TABLE IF NOT EXISTS fact_decisions (request_id TEXT NOT NULL REFERENCES requests(id), run_id TEXT NOT NULL REFERENCES analysis_runs(run_id), proposal_id TEXT NOT NULL, body TEXT NOT NULL, PRIMARY KEY(request_id,run_id,proposal_id)) STRICT;`);
  db.exec('CREATE TABLE IF NOT EXISTS reviewer_tracking (request_id TEXT PRIMARY KEY REFERENCES requests(id), version INTEGER NOT NULL, body TEXT NOT NULL) STRICT');
  db.exec('CREATE TABLE IF NOT EXISTS review_completions (request_id TEXT NOT NULL REFERENCES requests(id), sequence INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL) STRICT');
  db.exec('CREATE TABLE IF NOT EXISTS handoff_versions (request_id TEXT NOT NULL REFERENCES requests(id), version INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(request_id,version)) STRICT');
  db.exec('CREATE TABLE IF NOT EXISTS brief_approvals (request_id TEXT NOT NULL REFERENCES requests(id), version INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(request_id,version)) STRICT');
  db.exec('INSERT OR IGNORE INTO review_heads SELECT request_id,run_id FROM active_analyses');
  // Trusted persistence adapter only. Explicit table/column allowlist; never HTTP input.
  const tables = ['requests','events','commands','analysis_runs','active_analyses','review_heads','fact_decisions','reviewer_tracking','review_completions','handoff_versions','brief_approvals'];
  if (initialState) {
    if (initialState.schema_version !== 1) fail('INVALID_SNAPSHOT');
    db.exec('BEGIN');
    try {
      for (const table of tables) {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
        for (const row of initialState.tables[table] || []) {
          db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).run(...columns.map(c => row[c] ?? null));
        }
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  }
  const owned = (actor, id) => {
    identity(actor);
    if (!text(id, 200)) fail('INVALID_REQUEST_ID');
    const row = db.prepare('SELECT body FROM requests WHERE id=? AND owner_id=?').get(id, ownerId ?? actor);
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
  const event = (request, actor, action, messageId, details = {}) => db.prepare('INSERT INTO events VALUES (?,?,?)').run(request.id, request.revision,
    JSON.stringify({ request_id: request.id, revision: request.revision, actor_id: actor, action, message_id: messageId, ...details, at: request.updated_at }));
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
        const request = { id: createId ?? randomUUID(), owner_id: ownerId ?? input.actor_id, revision: 0, created_at: now, updated_at: now,
          recording_id: recording?.id ?? null, coordinator_timezone: input.timezone, messages: [{ message_id: messageId, kind: 'initial', text: input.email,
            supplied_message_date: null, received_at: now, added_by: input.actor_id }], confirmed_fields: [], unresolved_issues: [] };
        db.prepare('INSERT INTO requests VALUES (?,?,?,?)').run(request.id, request.owner_id, request.revision, JSON.stringify(request));
        event(request, input.actor_id, 'request_created', messageId);
        return request;
      });
    },
    changeRecording(input) {
      if(!keys(input,['actor_id','request_id','expected_revision','recording_id','reason','idempotency_key'])) fail('INVALID_INPUT');
      command(input);owned(input.actor_id,input.request_id);
      if(!Object.hasOwn(input,'recording_id')||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0||!text(input.reason,2000)) fail('INVALID_RECORDING_CHANGE');
      let recording;try{recording=resolveRecording(input.recording_id);}catch{fail('INVALID_RECORDING');}
      return execute(input,`recording:${input.request_id}`,{expected_revision:input.expected_revision,recording_id:recording?.id??null,reason:input.reason},()=>{
        const request=owned(input.actor_id,input.request_id);
        if(request.revision!==input.expected_revision||request.revision>=Number.MAX_SAFE_INTEGER)fail('REVISION_CONFLICT');
        const previous=request.recording_id??null;
        if(previous===(recording?.id??null))fail('INVALID_RECORDING_CHANGE');
        request.recording_id=recording?.id??null;request.revision++;request.updated_at=new Date().toISOString();
        const update=db.prepare('UPDATE requests SET revision=?,body=? WHERE id=? AND owner_id=? AND revision=?').run(request.revision,JSON.stringify(request),request.id,ownerId ?? input.actor_id,input.expected_revision);
        if(update.changes!==1)fail('REVISION_CONFLICT');
        db.prepare('DELETE FROM active_analyses WHERE request_id=?').run(request.id);
        db.prepare("UPDATE analysis_runs SET status='stale' WHERE request_id=? AND status='completed'").run(request.id);
        db.prepare('DELETE FROM review_heads WHERE request_id=?').run(request.id);
        event(request,input.actor_id,'recording_corrected',null,{previous_recording_id:previous,recording_id:request.recording_id,reason:input.reason.trim()});
        return request;
      });
    },
    setCompleted(input) {
      if(!keys(input,['actor_id','request_id','expected_revision','completed','idempotency_key'])||typeof input.completed!=='boolean'||!Number.isSafeInteger(input.expected_revision))fail('INVALID_INPUT');
      command(input);owned(input.actor_id,input.request_id);
      return execute(input,`completed:${input.request_id}`,{expected_revision:input.expected_revision,completed:input.completed},()=>{
        const request=owned(input.actor_id,input.request_id);
        if(request.revision!==input.expected_revision)fail('REVISION_CONFLICT');
        request.completed_at=input.completed?new Date().toISOString():null;
        request.completed_by=input.completed?input.actor_id:null;
        request.updated_at=new Date().toISOString();
        request.completion_history=[...(request.completion_history||[]),{request_id:request.id,revision:request.revision,actor_id:input.actor_id,action:input.completed?'case_completed':'case_reopened',at:request.updated_at}];
        db.prepare('UPDATE requests SET body=? WHERE id=? AND owner_id=?').run(JSON.stringify(request),request.id,ownerId??input.actor_id);
        return request;
      });
    },
    setDeleted(input) {
      if(!keys(input,['actor_id','request_id','expected_revision','deleted','idempotency_key'])||typeof input.deleted!=='boolean'||!Number.isSafeInteger(input.expected_revision))fail('INVALID_INPUT');
      command(input);owned(input.actor_id,input.request_id);
      return execute(input,`deleted:${input.request_id}`,{expected_revision:input.expected_revision,deleted:input.deleted},()=>{
        const request=owned(input.actor_id,input.request_id);
        if(request.revision!==input.expected_revision)fail('REVISION_CONFLICT');
        request.deleted_at=input.deleted?new Date().toISOString():null;
        request.deleted_by=input.deleted?input.actor_id:null;
        request.updated_at=new Date().toISOString();
        db.prepare('UPDATE requests SET body=? WHERE id=? AND owner_id=?').run(JSON.stringify(request),request.id,ownerId??input.actor_id);
        return request;
      });
    },
    get(actor, id) { return owned(actor, id); },
    list(actor, includeDeleted=false) {
      identity(actor);
      return db.prepare('SELECT body FROM requests WHERE owner_id=? ORDER BY rowid').all(ownerId ?? actor).filter(row=>includeDeleted||!JSON.parse(row.body).deleted_at).map(row => {
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
        if(request.completed_at){
          request.completed_at=null;request.completed_by=null;
          request.completion_history=[...(request.completion_history||[]),{request_id:request.id,revision:request.revision+1,actor_id:input.actor_id,action:'case_reopened',reason:'New email reply',at:now}];
        }
        request.revision++; request.updated_at = now;
        const result = db.prepare('UPDATE requests SET revision=?,body=? WHERE id=? AND owner_id=? AND revision=?').run(request.revision, JSON.stringify(request), request.id, ownerId ?? input.actor_id, input.expected_revision);
        if (result.changes !== 1) fail('REVISION_CONFLICT');
        db.prepare('DELETE FROM active_analyses WHERE request_id=?').run(request.id);
        db.prepare("UPDATE analysis_runs SET status='stale' WHERE request_id=? AND status='completed'").run(request.id);
        db.prepare('DELETE FROM review_heads WHERE request_id=?').run(request.id);
        event(request, input.actor_id, 'reply_appended', messageId);
        return request;
      });
    },
    decisions(actor, id) {
      owned(actor, id);
      return db.prepare('SELECT body FROM fact_decisions WHERE request_id=? ORDER BY rowid').all(id).map(row => JSON.parse(row.body));
    },
    reviewAnalysis(actor, id) {
      owned(actor, id);
      const row = db.prepare('SELECT run_id FROM review_heads WHERE request_id=?').get(id);
      return row ? this.analysis(actor, id, row.run_id) : null;
    },
    decideProposal(input) {
      if (!keys(input, ['actor_id','request_id','expected_revision','idempotency_key','run_id','proposal_id','decision'])) fail('INVALID_INPUT');
      command(input);
      if (!Number.isSafeInteger(input.expected_revision) || input.expected_revision < 0 || !text(input.run_id,200)
          || !text(input.proposal_id,200) || !['accept','reject'].includes(input.decision)) fail('INVALID_INPUT');
      owned(input.actor_id, input.request_id);
      const payload = { expected_revision:input.expected_revision, run_id:input.run_id, proposal_id:input.proposal_id, decision:input.decision };
      return execute(input, `decide:${input.request_id}`, payload, () => {
        const request = owned(input.actor_id,input.request_id);
        if (request.revision !== input.expected_revision || request.revision >= Number.MAX_SAFE_INTEGER) fail('REVISION_CONFLICT');
        const head = this.reviewAnalysis(input.actor_id,request.id);
        if (!head || head.run_id !== input.run_id || !head.result?.ok) fail('STALE_PROPOSAL');
        if (db.prepare('SELECT 1 FROM fact_decisions WHERE request_id=? AND run_id=? AND proposal_id=?').get(request.id,input.run_id,input.proposal_id)) fail('DECISION_EXISTS');
        const proposal = head.result.stages.intake.output.proposed_changes.find(p => p.proposal_id === input.proposal_id);
        if (!proposal) fail('INVALID_PROPOSAL');
        const old = request.confirmed_fields.find(f => f.field_key === proposal.field_key);
        const previous = old?.state === 'confirmed' ? old.value : null;
        if (hash(previous) !== hash(proposal.previous_value)) fail('STALE_PROPOSAL');
        const at = new Date().toISOString();
        if (input.decision === 'accept') {
          const confirmed = { field_key:proposal.field_key, state:'confirmed', value:structuredClone(proposal.proposed_value),
            evidence:structuredClone(proposal.evidence), confirmed_by:input.actor_id, confirmed_at:at, not_applicable_reason:null };
          request.confirmed_fields = [...request.confirmed_fields.filter(f => f.field_key !== proposal.field_key), confirmed];
        }
        request.revision++; request.updated_at = at;
        // Revalidate the complete updated record context, including exact evidence and human attribution.
        try {
          validateContract('context', { ...head.context, base_record_version:request.revision,
            messages:request.messages.map(({message_id,kind,text,supplied_message_date}) => ({message_id,kind,text,supplied_message_date})),
            confirmed_fields:request.confirmed_fields, unresolved_issues:request.unresolved_issues });
        } catch { fail('INVALID_CONFIRMATION'); }
        const decision = { request_id:request.id, run_id:input.run_id, proposal_id:input.proposal_id, field_key:proposal.field_key,
          decision:input.decision, previous_value:previous, proposed_value:proposal.proposed_value, evidence:proposal.evidence,
          decided_by:input.actor_id, decided_at:at, based_on_revision:input.expected_revision, resulting_revision:request.revision };
        const changed = db.prepare('UPDATE requests SET revision=?,body=? WHERE id=? AND owner_id=? AND revision=?')
          .run(request.revision,JSON.stringify(request),request.id,ownerId ?? input.actor_id,input.expected_revision);
        if (changed.changes !== 1) fail('REVISION_CONFLICT');
        db.prepare('INSERT INTO fact_decisions VALUES (?,?,?,?)').run(request.id,input.run_id,input.proposal_id,JSON.stringify(decision));
        db.prepare('DELETE FROM active_analyses WHERE request_id=?').run(request.id);
        db.prepare("UPDATE analysis_runs SET status='stale' WHERE request_id=? AND status='completed'").run(request.id);
        // Keep this review head for remaining undecided fields only. Replies/new completed runs replace it.
        event(request,input.actor_id,'proposal_decided',null,{run_id:input.run_id,proposal_id:input.proposal_id,decision:input.decision});
        return request;
      });
    },
    history(actor, id) {
      const request=owned(actor, id);
      return [...db.prepare('SELECT body FROM events WHERE request_id=? ORDER BY revision').all(id).map(row => JSON.parse(row.body)),...(request.completion_history||[])];
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
          result=safeAnalysisFailure(input.result);
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
        if(status==='completed') {
          db.prepare('INSERT INTO active_analyses VALUES (?,?) ON CONFLICT(request_id) DO UPDATE SET run_id=excluded.run_id').run(request.id,row.run_id);
          db.prepare('INSERT INTO review_heads VALUES (?,?) ON CONFLICT(request_id) DO UPDATE SET run_id=excluded.run_id').run(request.id,row.run_id);
        }
        return this.analysis(input.actor_id,request.id,row.run_id);
      });
    },
    reviewers(actor,id) {
      const request = owned(actor,id);
      const row = db.prepare('SELECT version,body FROM reviewer_tracking WHERE request_id=?').get(id);
      const state = row ? JSON.parse(row.body) : {reviewers:[],history:[]};
      const fields=effectiveFields(request,this.activeAnalysis(actor,id),this.decisions(actor,id));
      const token=hash(fields.map(f=>({field_key:f.field_key,value:f.value,evidence:f.evidence})).sort((a,b)=>a.field_key.localeCompare(b.field_key)));
      const hasAutomatic=fields.some(f=>f.origin==='agent');
      return {version:row?.version ?? 0, ...state, reviewers:state.reviewers.map(r => ({...r, needs_reconfirmation:r.status !== 'Pending' && (r.reviewed_revision !== request.revision || (hasAutomatic && r.reviewed_fields_token!==token))}))};
    },
    recordReview(input) {
      if (!keys(input,['actor_id','request_id','expected_revision','expected_review_version','idempotency_key','operation','reviewer_id','name','role','status','notes'])) fail('INVALID_INPUT');
      command(input);
      if (!Number.isInteger(input.expected_revision) || !Number.isInteger(input.expected_review_version) || input.expected_review_version < 0) fail('INVALID_REVISION');
      if (!['assign','decision'].includes(input.operation)) fail('INVALID_REVIEW');
      if (input.operation === 'assign' && (!text(input.name,200) || !text(input.role,200))) fail('INVALID_REVIEW');
      if (input.operation === 'decision' && (!text(input.reviewer_id,200) || !['Pending','Approved','Changes requested','Declined'].includes(input.status) || typeof input.notes !== 'string' || input.notes.length > 4000)) fail('INVALID_REVIEW');
      const actor_id=input.actor_id;
      const payload=Object.fromEntries(Object.entries(input).filter(([key]) => !['actor_id','idempotency_key'].includes(key)));
      return execute(input,`reviewers:${input.request_id}`,payload,() => {
        const request = owned(actor_id,input.request_id);
        if(request.revision !== input.expected_revision) fail('REVISION_CONFLICT');
        const row = db.prepare('SELECT version,body FROM reviewer_tracking WHERE request_id=?').get(request.id);
        if((row?.version ?? 0) !== input.expected_review_version) fail('REVIEW_CONFLICT');
        const state = row ? JSON.parse(row.body) : {reviewers:[],history:[]};
        let reviewer;
        if(input.operation === 'assign') {
          if(state.reviewers.length >= 20 || state.reviewers.some(r => r.name.toLowerCase() === input.name.trim().toLowerCase() && r.role.toLowerCase() === input.role.trim().toLowerCase())) fail('INVALID_REVIEW');
          reviewer = {id:randomUUID(),name:input.name.trim(),role:input.role.trim(),status:'Pending',notes:'',reviewed_revision:request.revision};
          state.reviewers.push(reviewer);
        } else {
          reviewer = state.reviewers.find(r => r.id === input.reviewer_id);
          if(!reviewer) fail('NOT_FOUND');
          reviewer.status=input.status;reviewer.notes=input.notes;reviewer.reviewed_revision=request.revision;
        }
        const fields=effectiveFields(request,this.activeAnalysis(actor_id,request.id),this.decisions(actor_id,request.id));
        reviewer.reviewed_fields_token=hash(fields.map(f=>({field_key:f.field_key,value:f.value,evidence:f.evidence})).sort((a,b)=>a.field_key.localeCompare(b.field_key)));
        reviewer.recorded_by=actor_id;reviewer.recorded_at=new Date().toISOString();
        state.history.push({...reviewer,operation:input.operation});
        db.prepare('INSERT INTO reviewer_tracking VALUES (?,?,?) ON CONFLICT(request_id) DO UPDATE SET version=excluded.version,body=excluded.body').run(request.id,(row?.version ?? 0)+1,JSON.stringify(state));
        return request;
      });
    },
    briefApproval(actor,id) {
      owned(actor,id);
      const history=db.prepare('SELECT body FROM brief_approvals WHERE request_id=? ORDER BY version').all(id).map(row=>JSON.parse(row.body));
      return {latest:history.at(-1)||null,history};
    },
    approveBrief(input) {
      if(!keys(input,['actor_id','request_id','expected_revision','analysis_run_id','idempotency_key']))fail('INVALID_INPUT');
      command(input);owned(input.actor_id,input.request_id);
      if(!Number.isSafeInteger(input.expected_revision)||!text(input.analysis_run_id,200))fail('INVALID_INPUT');
      const {actor_id,request_id,expected_revision,analysis_run_id}=input;
      return execute(input,`approve-brief:${request_id}`,{request_id,expected_revision,analysis_run_id},()=>{
        const request=owned(actor_id,request_id);
        if(request.revision!==expected_revision)fail('REVISION_CONFLICT');
        if(this.activeAnalysis(actor_id,request_id)?.run_id!==analysis_run_id||this.analyses(actor_id,request_id).at(-1)?.run_id!==analysis_run_id)fail('BRIEF_ANALYSIS_CONFLICT');
        const workflow=this.workflow(actor_id,request_id);
        if(workflow.brief_approved)return request;
        if(!workflow.can_approve_brief)fail('BRIEF_NOT_READY');
        const history=this.briefApproval(actor_id,request_id).history;
        const record={version:history.length+1,request_revision:request.revision,analysis_run_id,approved_by:actor_id,approved_at:new Date().toISOString()};
        db.prepare('INSERT INTO brief_approvals VALUES (?,?,?)').run(request_id,record.version,JSON.stringify(record));
        return request;
      });
    },
    workflow(actor,id) {
      const request=owned(actor,id);
      if(request.completed_at)return {status:'Case completed',reasons:[],next_action:'Case completed. Reopen it if further work is needed.',completed:true,can_complete:false,can_approve_brief:false,completion:{completed_at:request.completed_at,completed_by:request.completed_by},history:[]};
      const history=db.prepare('SELECT body FROM review_completions WHERE request_id=? ORDER BY sequence').all(id).map(row=>JSON.parse(row.body));
      return {...requestReadiness({request,analysis:this.activeAnalysis(actor,id),tracking:this.reviewers(actor,id),decisions:this.decisions(actor,id),briefApproval:this.briefApproval(actor,id).latest,latestAnalysis:this.analyses(actor,id).at(-1)||null,completion:history.at(-1) || null}),history};
    },
    completeReview(input) {
      if(!keys(input,['actor_id','request_id','expected_revision','expected_review_version','idempotency_key'])) fail('INVALID_INPUT');
      command(input);
      const {actor_id,request_id,expected_revision,expected_review_version}=input;
      if(!Number.isInteger(expected_revision)||!Number.isInteger(expected_review_version)) fail('INVALID_REVISION');
      return execute(input,`complete-review:${request_id}`,{request_id,expected_revision,expected_review_version},()=>{
        const request=owned(actor_id,request_id);
        if(request.revision!==expected_revision) fail('REVISION_CONFLICT');
        if(this.reviewers(actor_id,request_id).version!==expected_review_version) fail('REVIEW_CONFLICT');
        if(!this.workflow(actor_id,request_id).can_complete) fail('REVIEW_NOT_READY');
        db.prepare('INSERT INTO review_completions (request_id,body) VALUES (?,?)').run(request_id,JSON.stringify({brief_approval_version:this.briefApproval(actor_id,request_id).latest.version,request_revision:expected_revision,review_version:expected_review_version,completed_by:actor_id,completed_at:new Date().toISOString()}));
        return request;
      });
    },
    handoff(actor,id) {
      const request=owned(actor,id);
      const source_token=hash({intake_policy:"coordinator-signoff-v1",brief_approval:this.briefApproval(actor,id).latest?.version??0,revision:request.revision,analysis_run:this.activeAnalysis(actor,id)?.run_id ?? null,review_version:this.reviewers(actor,id).version});
      const versions=db.prepare('SELECT version,body FROM handoff_versions WHERE request_id=? ORDER BY version').all(id).map(row=>JSON.parse(row.body));
      const latest=versions.at(-1) || null;
      return {version:latest?.version ?? 0,source_token,latest:latest ? {...latest,outdated:latest.source_token!==source_token} : null,
        history:versions.map(({version,saved_at,saved_by,request_revision})=>({version,saved_at,saved_by,request_revision}))};
    },
    saveHandoff(input) {
      if(!keys(input,['actor_id','request_id','expected_revision','expected_handoff_version','source_token','text','idempotency_key'])) fail('INVALID_INPUT');
      command(input);
      if(!Number.isInteger(input.expected_revision)||!Number.isInteger(input.expected_handoff_version)||!text(input.text,50000)||!text(input.source_token,200)) fail('INVALID_HANDOFF');
      const payload=Object.fromEntries(Object.entries(input).filter(([key])=>!['actor_id','idempotency_key'].includes(key)));
      return execute(input,`handoff:${input.request_id}`,payload,()=>{
        const request=owned(input.actor_id,input.request_id);
        if(request.revision!==input.expected_revision) fail('REVISION_CONFLICT');
        const state=this.handoff(input.actor_id,input.request_id);
        if(state.version!==input.expected_handoff_version) fail('HANDOFF_CONFLICT');
        if(state.source_token!==input.source_token) fail('STALE_HANDOFF');
        const record={version:state.version+1,source_token:state.source_token,text:input.text,request_revision:request.revision,saved_by:input.actor_id,saved_at:new Date().toISOString()};
        db.prepare('INSERT INTO handoff_versions VALUES (?,?,?)').run(request.id,record.version,JSON.stringify(record));
        return request;
      });
    },
    exportState() { return {schema_version:1,tables:Object.fromEntries(tables.map(table=>[table,db.prepare(`SELECT * FROM ${table}`).all()]))}; },
    close() { db.close(); },
  };
}
