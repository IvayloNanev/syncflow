# Saved-revision analysis

Implemented locally: `analyzeSavedRequest(store, command, providers)` reads a saved request snapshot, runs Intake → Review → Follow-up outside the SQLite transaction, then stores the result and atomically checks whether it can become active. Trusted actor identity and the existing provider ports are required. No new HTTP routes or login are implemented.

```
pnpm requests:analysis:demo
```

The demo replays the known fictional development fixture through mock Intake, deterministic Review and template Follow-up. It persists/reopens eight proposed facts and five issues, with zero confirmed fields and zero model calls. Appending a reply removes the active result; prior output remains in run history. Only its own temporary directory is removed afterward.

## Storage behavior

- beginAnalysis takes actor_id, request_id, expected_revision and idempotency_key. It owns the run ID, timestamps and immutable context snapshot. A new run requires a current revision.
- Same request/key/revision returns the original running or finished run without provider calls. A key reused for a different revision fails. Provider configuration is not part of the key: use a new key for an explicit reanalysis with different settings.
- Analysis artifacts do not change the source revision or confirmed state. They have separate run history, lifecycle status and timestamps. Source message/field changes must invalidate active artifacts; appendReply now does so atomically. Future confirmation commands must use the same rule.
- finishAnalysis checks ownership and validates successful Intake evidence/schema/revision, recomputes deterministic Review, checks coordinator routing and validates filtered Follow-up issue coverage. Approval properties and mismatched results are rejected.
- The final transaction checks current revision and run ordering. Statuses: running, completed, failed, stale, superseded. Only the latest-started successful run at the current revision can become active; a late older completion cannot replace it.
- A failed new run leaves the previous valid active run intact. If newer work has started, an older still-running result becomes superseded even if the newer run later fails; explicit rerun is required. Replies clear the active pointer and mark completed historical runs stale, retaining their outputs.
- Runtime failures store only a safe failure label, not arbitrary provider exception text. The original request is preserved. No automatic retries. A crashed process can leave a run running; a new command key starts an explicit retry. Crash recovery/resumption is not implemented.
- Finishing twice with the same normalized stored result is idempotent; a different terminal result is rejected. Invalid finalization rolls back and leaves the run running for inspection. Only trusted application code may call these methods.

The wrapper injects a current-version callback into both provider harnesses, and the final transaction closes the remaining check-to-save race. Version callbacks alone are not the persistence guard.

## Usage

```js
const outcome = await analyzeSavedRequest(store, {
  actor_id: trustedActorId, request_id: savedRequestId,
  expected_revision: currentRevision, idempotency_key: newCommandKey,
}, { intakeProvider, followUpProvider });
const current = store.activeAnalysis(trustedActorId, savedRequestId);
```

The stored workflow envelope still says saved:false: its agent stages never saved confirmed request facts. The outer analysis record is persisted separately. No candidate acceptance, issue resolution, summary generation or internal approval is implemented by saving an analysis.

## Verification and remaining work

124 automated tests pass, including change-during-generation, change-before-finalization, same-revision overlapping runs, repeated commands without duplicate calls, failure preservation, durable reopen, owner isolation and agent-authored approval rejection. Fixtures and frozen evaluation integrity pass. The saved-request mock demo passes. No new live Claude run, UI/login integration, process-crash recovery or shared deployment was tested in this change.

Next: human confirmation/edit/issue-resolution commands with atomic revision checks and active-analysis invalidation. Shared authentication and app wiring remain separate prerequisites for exposing these storage operations over HTTP.
