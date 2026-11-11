# Durable hosted AI runs

Hosted Coordinator, Daily Brief, and Internal Review work runs through Workflow SDK 5.5.0. The authenticated API queues work and returns HTTP 202. The browser polls a signed, workspace-bound token; disconnecting the browser does not cancel the workflow. Existing AI progress indicators remain visible while polling. Local offline/CLI mode retains its synchronous path.

Coordinator checkpoints the immutable request context, validated Intake output, Review/Follow-up result, and final case write as separate steps. Daily Brief and Internal Review checkpoint their snapshot, generation, and saved result. Database-only steps can retry. Completed steps are replayed from the workflow history, rather than calling the provider again when a later save fails.

## Paid-call safety

Paid steps have `maxRetries=0`. A server-only PostgreSQL attempt claim also fences every network call by run, stage and attempt index. Claims include a SHA-256 payload digest, actor and timestamp; they contain no email, prompt or model output. A worker replay that reaches an existing claim stops before network delivery. An uncertain call is never automatically repeated. The user must explicitly start a new attempt; previously saved case results remain available.

Daily Brief retains its existing single repair attempt for a received but invalid report; each attempt reserves quota. Its background path no longer retries an unavailable/ambiguous transport response. Intake, Follow-up and Internal Review do not retry provider calls. This is conservative at-most-once delivery per claimed attempt, not a claim of exactly-once provider processing: a crash after claiming but before sending can also require an explicit retry.

Atomic workflow start tokens prevent duplicate dispatch of the same Coordinator domain run or the same browser submission nonce. Nonces do not grant lease ownership: Daily Brief and Internal Review use server-generated lease tokens. Workspace leases renew only for their current owner and expire after 180 seconds. Other queued work waits for ownership in the preparation step. Membership is rechecked in every step and in the quota/claim transaction. Case writes keep existing compare-and-swap revision checks; Internal Review rechecks its full-history fingerprint. Daily Brief rejects a changed snapshot before saving and supervision marks subsequently changed cases as stale; it does not execute recommendations.

## Setup and retention

Apply `db/ai-usage.sql`, then `db/durable-analysis-lease.sql` and `db/durable-ai-attempts.sql`. The latter two were applied to the linked SyncFlow database on November 11, 2026. `db/check-durable-ai.sql` verifies server-only access, membership, exclusive lease renewal, duplicate claims and quota preservation using disposable records in a rolled-back transaction.

`withWorkflow` in Next config generates the internal queue handlers. Do not commit generated `app/.well-known/workflow` files or block those paths in the auth proxy. On Vercel, enable access to System Environment Variables so build and runtime receive `VERCEL_DEPLOYMENT_ID`; otherwise the SDK selects filesystem storage, which is unsuitable for a deployment. The managed backend stores workflow arguments and checkpoint results, including saved case context, within the project's environment. Review Vercel retention/access settings as part of deployment configuration. Local development uses `.workflow-data`; integration tests use a separate `.workflow-vitest` directory.

Start tokens are retained for seven days. Poll credentials expire after 24 hours and require a fresh authenticated workspace session. Attempt claims have no automatic deletion: retain them for at least as long as a workflow can replay. Do not delete a claim to force recovery. A recently committed Coordinator run left before queue dispatch can be attached/queued on reopening within 60 seconds; older missing runs fail safely for explicit retry. Legacy inline runs are never silently submitted as new jobs. Failed/cancelled SDK jobs are reconciled into a failed domain attempt on the next case read, without replacing a valid active analysis.

This does not migrate the SQLite validation engine to native relational domain tables, cancel work when a browser closes, or guarantee recovery from an uncertain paid invocation. It makes completed checkpoints and database retries durable while keeping uncertain paid work explicit.

## Verification

`pnpm test:durable` runs the compiled SDK runtime with synthetic HTTP fixtures, not live AI or client records. It covers all three agent paths, duplicate dispatch, a failed final save with one Intake/Follow-up call each, and access revocation. `pnpm test` covers signed polling credentials, cancellation without resubmission, paid-call replay fencing, old/new snapshot compatibility and prompt assets. Prompt JSON assets are byte-matched against their reviewed text sources so SDK bundles need no relative filesystem reads.

### Hosted preview verification — November 11, 2026

Verified commit `beb7af6` on branch-only Preview deployment `DTLDrFsoGf9yCVDUMEe2CeSnujPp`, using the existing owner's SyncFlow workspace. Production code and email-delivery settings were unchanged. The branch has scoped Supabase/Anthropic configuration and its exact OAuth callback is allow-listed.

Created synthetic case `43bb8b9d-8a81-5110-a16d-f196ee92f2a5` through New Inquiries, then opened Coordinator and observed the working indicator. Navigated to Cases while generation was active. Durable run `6b2d8054-9267-4c0c-98ae-cffe466a938d` completed at `2026-11-11T18:06:45.189Z`; reopening displayed its saved budget clarification draft. The database still contained one completed analysis and exactly two allowed provider-attempt claims: Intake and Follow-up, one each. Reopening did not enqueue another analysis or claim another provider call. The draft remained unsent.

Moved only this synthetic case to recoverable Deleted requests at `2026-11-11T18:10:16.085Z`; its analysis/history and two attempt claims remain. This hosted check verifies navigation-away recovery and saved-result reuse. Worker-crash/failed-save replay and the other agent paths are covered by compiled local integration tests, not hosted fault injection.
