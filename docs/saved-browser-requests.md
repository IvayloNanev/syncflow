# Saved browser request flow

Current scope: single local operator, fictional data, Next development server bound to 127.0.0.1. The SQLite RequestStore is the sole request writer. Production routes are disabled. Prisma remains unused; its dev.db is never opened by this service.

## User flow

1. Paste email, select recording (or leave identity unresolved), choose timezone.
2. Save request, optionally analyze immediately. The server saves before making a model call.
3. Refresh, open the saved request from history. Original email, selected recording and current completed analysis load from SQLite.
4. Append the client's reply as a new message. The revision advances, previous active analysis is invalidated, and run history shows stale status.
5. Analyze the new revision. The context contains all original messages in order. Extracted facts remain proposals.

Original input is locked after saving. Recording changes require a separate request; automatic split/reassignment and human fact confirmation are future work. Draft editing is not persisted. Opening another request/new request deliberately replaces the current unsent draft/reply view.

## Endpoint

POST /api/requests accepts only JSON, maximum 100 KB, same loopback Host/Origin and development mode. Server identity is fixed local-coordinator, not accepted from input. There is no authentication or multi-user authorization. Storage errors are sanitized.

| action | Fields |
| --- | --- |
| list | action |
| get | action, request_id |
| create | action, email, timezone, recording_id (optional), idempotency_key |
| reply | action, request_id, expected_revision, text, idempotency_key |
| analyze | action, request_id, expected_revision, idempotency_key |

Detail responses contain the request, current active_analysis or null, analysis status history and separately computed catalog_review. The nested workflow result retains saved:false because it is the proposal-only agent envelope; its enclosing persisted run is the persistence evidence. No agent gets storage tools or client-controlled confirmed facts.

Same key/payload replays the original command without duplicate messages/model calls; changed input with the same key returns 409. The browser preserves keys while retrying an uncertain command. New request resets command keys. Successful/failed completed analysis can be rerun only by an explicit new command. A replayed running run is not executed again. After a process interruption, reopen and check history; explicit “Retry analysis with a new run” permits another paid attempt, leaving old history intact.

A process-level guard prevents overlapping analysis submissions while allowing replies to advance the source revision during a call. The existing transaction/revision guard prevents stale results from becoming active, including across independent database handles. This is not a distributed worker queue or crash recovery service.

## Verification

Route tests cover durable create/reopen, idempotent save/reply/analysis, selected recording, immutable history, revision conflicts, stale in-flight analysis, safe provider failure/retry, actor spoofing, foreign-owner reads, origin/production/body restrictions. Existing RequestStore/workflow tests remain the underlying lifecycle requirements. Browser checks are recorded in the PR, separately from automated tests.

Verified in the local browser on November 5, 2026: saved a fictional Northern Lights / TRACK-0002 request, analyzed revision 0 (nine proposed fields, three missing details), refreshed and reopened the same email/recording/analysis. Appended a reply supplying platforms, 30-second cue and deadline: revision 1 retained two messages, marked revision 0 stale and removed its active display. Analyzed revision 1 (12 proposed fields, no email checklist gaps, publishing verification still an internal catalog blocker), refreshed and reopened again with both run statuses intact. Three live Claude calls in total; no email sent. Screenshot saved outside the repository. This checks persistence, not model accuracy or human-confirmation behavior.
