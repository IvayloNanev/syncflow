# Reconcile developer application and main agent work

> Updated decision: the local browser now uses RequestStore as its sole writer in `.syncflow-data/browser-requests.sqlite`. This is a development-only single-operator integration, not the Prisma migration proposed below. Prisma remains a separate unused scaffold. See README “Saved browser requests” and docs/saved-browser-requests.md for current behavior. The remainder is the historical reconciliation report.

The reconciliation branch merges developer's Next.js/Prisma foundation with main's latest agent, evaluation and local request-store work. It preserves both histories. It does not change main/developer until the PR is merged, and does not migrate either database or wire the sample screen to agents.

## Present state

| Area | Existing implementation | Integration implication |
| --- | --- | --- |
| App | app/page.tsx renders three fictional sample requests | Layout foundation only; no saved requests or agent calls on screen |
| Next.js routes | /api/health | No /api/analyze in Next yet |
| Local agent API | server/ on 127.0.0.1:3001 | Independent of Next.js; no auth or saved requests |
| Agents | Framework-neutral JS workflow and JSON contracts | Reuse directly from trusted server services; keys never enter client components |
| Prisma | Relational SQLite schema, migration and generated client | Application mapping/scaffold; business invariants and auth are not implemented by schema |
| Local request store | requests/store.js with raw SQLite tables and lifecycle tests | Working local reference adapter; separate schema/database, not transparently interchangeable with Prisma |

Both stores use SQLite but have different tables and representations. Do not set the request-store path to Prisma's dev.db. Neither currently synchronizes data with the other. No existing .env was overwritten and no migrations were run during reconciliation.

## Proposed integration direction

Use Mosiah's Prisma mapping for the application persistence layer and retain the existing request-store tests as acceptance requirements/reference behavior during that adapter work. Keep the raw SQLite adapter for terminal demos until the Prisma equivalent passes the same revision/idempotency/isolation checks. Do not run two competing writers for the same user request. This PR combines the foundations; it does not claim the adapter migration is complete.

| Domain invariant | Prisma mapping / remaining gap |
| --- | --- |
| Saved identity and source revision | Request.id and recordVersion; define reviewRevision purpose explicitly before using decisions. Prefer recordVersion as the source snapshot revision. |
| Owner-bound access | No owner/workspace relation yet. Must add auth-derived ownership before shared routes. |
| Agent context timezone | Add stored coordinator timezone; do not assume one silently. |
| Append-only original messages | Message.body/id/recordedAt; add initial/reply kind and preserve original supplied date text if needed. occurredAt is not a substitute for received-at or ambiguous supplied text. |
| Confirmed fields/evidence | RequestField and FieldEvidence map to shared contract; enforce human attribution and N/A rules in services. |
| Proposals | ProposedChange/ProposalEvidence map to agent outputs; never write these directly into confirmed fields. |
| Analysis history and active result | AgentRun has stage/status/base version/output, but needs immutable input/prompt metadata, command replay semantics and an active run policy. |
| Issues | WorkflowIssue has lifecycle fields; add persisted source evidence and explicit resolution reason/revision. Preserve stable agent issue-ID mapping. |
| Idempotency | RequestEvent.idempotencyKey is globally unique; implement actor/request/action scoping plus payload hash and original response for safe command replay. |
| Audit and atomic mutation | Use Prisma transactions plus guarded source-revision updates. Retain exact messages; do not rely solely on schema comments. |
| Summary agent | No summary/snapshot model yet; build only after human-confirmation services exist. |
| Review decisions | ReviewerDecision exists but needs authenticated reviewer identity, summary linkage and stale-state enforcement for source changes. A display name is not authorization. |

## Next deliverable

Define a Prisma request-service adapter for create/read/append and trusted context projection, with owner checks and atomic revisions. Then port saved-analysis activation and confirmation commands. Add a Next server route only after its authentication/local-access boundary is explicit. Connect the actual form and show coordinator confirmation tasks before implementing internal summaries.

The existing /api/analyze handler is for unsaved new emails only. Adding an app form must not imply that analysis is saved or facts confirmed. Internal review tracking is not rights clearance or an executed licence.

## Reconciliation validation

- Frozen dependency lockfile installed; all scripts from main and app scripts from developer retained.
- Prisma client generation succeeded without touching database contents.
- ESLint: zero errors/warnings after removing one unused demo variable.
- TypeScript check and Next.js optimized production build passed. Built routes are /, /_not-found and /api/health.
- All 124 agent/storage tests pass; fixture contracts and frozen corpus integrity pass.
- CI now has an application job for client generation/lint/typecheck/build alongside the agent-contract job.
- .gitignore combines both branches' environment, generated output and SQLite sidecar exclusions. .env remains ignored; .env.example is tracked with placeholders only.

No browser journey, live model call, database migration, Prisma persistence behavior, auth or deployment was verified by this integration. The sample homepage still shows fictional records. Runtime/UI integration must be checked separately.
