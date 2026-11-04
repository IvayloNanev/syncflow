# Local saved-request foundation

Implemented: a storage module for create/get/list, append-only replies, audit history and projecting a saved revision into the existing agent context. SQLite persistence uses Node's built-in node:sqlite API; use Node 24+ (the existing CI already uses Node 24). No extra dependency is installed. API reference: https://nodejs.org/api/sqlite.html.

`pnpm requests:demo` creates a private temporary fictional database, saves an initial email and reply, closes/reopens it, reports two messages/two audit events, then deletes only that temporary demo directory. It makes no model calls or network requests.

```js
import { openRequestStore } from './requests/store.js';
const store = openRequestStore('/absolute/private/path/requests.sqlite');
try {
  const { request } = store.create({
    actor_id: trustedActorId, // server session/CLI context, never an HTTP body value
    idempotency_key: 'new-command-uuid',
    email: 'Original client email', timezone: 'America/New_York',
  });
  store.appendReply({ actor_id: trustedActorId, request_id: request.id,
    expected_revision: request.revision, idempotency_key: 'reply-command-uuid',
    text: 'Original client reply', supplied_message_date: null });
  const context = store.context(trustedActorId, request.id);
} finally { store.close(); }
```

The parent directory must already exist. Use a private local directory, normally .syncflow-data/, which is ignored along with SQLite files/sidecars. The module does not provision shared storage, encrypt the database or create sessions. Do not put a database containing real emails into Git. Tests use temporary databases and remove them afterward.

## Invariants

- Database-generated IDs and timestamps; original message text retained byte-for-byte as a JavaScript string. Replies are new messages, never edits.
- Actor-bound read/list/history/append checks. Unknown or other-owner IDs return NOT_FOUND. **actor_id is trusted input to this module, not authenticated by it.** Accepting it from an untrusted request would defeat the boundary.
- Append requires expected_revision and checks it under BEGIN IMMEDIATE, with a guarded SQL update. Request update, audit event and idempotency result commit/rollback together. Conflicting updates fail with REVISION_CONFLICT; no automatic retry.
- Keys are scoped to actor/action/request. Repeating a key with the same canonical command returns replayed:true and the original response, even if newer revisions now exist. Fetch the record for its latest state. Same key/different command fails with IDEMPOTENCY_CONFLICT.
- Inputs cannot set IDs, revision, confirmed fields, agent outputs or approvals. Returned records are detached snapshots. There is no generic update method.
- context() strips database-only message metadata, generates a run ID and validates against the existing agent context contract. It does not run or persist an analysis.

## Remaining work

This is a local storage module, **not shared authenticated persistence**. No new HTTP routes were added; /api/analyze still handles unsaved requests. The UI is not connected. Authentication, workspace membership/sharing, a production database adapter/migrations/backups, analysis-run persistence and atomic activation, human confirmation/issue-resolution commands, summary storage and approval invalidation remain separate deliverables. Owner-bound storage tests do not constitute an authentication test.

All 114 tests pass, including durable reopen, retries, stale revisions, independent database handles and cross-actor access rejection. The demo reopens revision 1 with two messages/two audit events. No production load, corruption recovery, backup/restore or deployment verification was performed. The shared database/auth choice remains open; SQLite here is a reversible local-development adapter.
