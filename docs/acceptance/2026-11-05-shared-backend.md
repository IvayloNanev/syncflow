# Authenticated shared backend verification — 2026-11-05

Story: a coordinator signs in, opens a workspace request, saves/reopens it, and a teammate appends a reply without losing history or overwriting another edit. Agent analysis is persisted against the saved revision and activates only when current.

## Verified

- Production build, TypeScript, ESLint and `git diff --check` passed.
- Full regression suite: 209 tests passed. Seven new tests exercise shared persistence, audit identity, concurrency, idempotent creation, same-key analysis retries, denied writes and canonical origins.
- Collaborator smoke script: eight checks passed, using mock agents and a temporary local database.
- Hosted integration script passed against the real Supabase project and running Next app: actual synthetic Auth sign-in; API create/retry/reopen/list; teammate reply attributed to the correct Auth user; stale revision rejection; anonymous 401; foreign-origin 403; another workspace's request 404; protected-page redirect.
- Hosted persisted analysis/reopen passed with mock providers. No new claims about live model extraction quality are made here.
- Direct client access to internal request aggregates and mutation RPCs was denied. Membership RLS returned only the signed-in account's memberships. The server commit RPC verified membership again.
- Real PostgreSQL rollback-only isolation checks passed: own workspace/membership visibility, anonymous restrictions, server-only commands, atomic compare-and-swap, cross-workspace write denial and distributed analysis lease.
- Supabase security advisor returned no findings after revoking client execution of the Supabase-created automatic-RLS helper.
- `.env` and `.env.local` are ignored. Server key was validated by a local setup form and never returned in chat or committed. No secret-key prefix was found in generated browser static assets.
- All synthetic hosted test identities, workspaces, requests, memberships and leases created by the HTTP integration script were removed. SQL isolation fixtures were rolled back. Existing local request files were not uploaded or reset.

## Implementation and limits

PostgreSQL is the durable store. Each request is a versioned JSON aggregate of structured domain records, not a SQLite file or a whole-workspace snapshot. The existing SQLite engine runs temporarily in memory to reuse evidence and lifecycle validation. Atomic aggregate commits prevent lost updates; dashboard projections avoid loading histories for list views. A native PostgreSQL domain adapter and history archival would reduce overhead at scale.

Shared mode is enabled when the Supabase URL is configured; missing credentials do not fall back to the local data store. Production requires explicit HTTPS `SYNCFLOW_APP_ORIGIN`. The standalone CLI/local adapters remain single-operator and loopback-only. Browser authentication and the public project/publishable keys are separate from server-only storage credentials.

One workspace per account is supported initially. Workspace memberships are administrator-managed; creating an Auth account alone does not reveal team requests. Reviewer decisions remain recorded by a coordinator, with the authenticated recorder attributed; they are not verified signatures from the named reviewer. Original local records remain local until a reviewed import.

A 180-second, workspace-scoped database lease prevents overlapping team analyses and expires after a crash. It is not a durable job queue, spending quota, or performance guarantee. The integration checks use mocks for agent output; this report does not replace earlier live-quality reports, user research, load testing or time-saving measurements.

Not yet verified for release: deployment-specific Auth redirects/SMTP, password recovery UI, invitation UI, operational backup/restore, durable agent jobs and load limits. Initial real user membership must still be assigned after account creation. This is an implemented and tested shared foundation, not a claim that all production-readiness gates are complete.
