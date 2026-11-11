# Current architecture

## Production web path

Next.js route handlers authenticate through Supabase Auth and check workspace membership server-side. Hosted PostgreSQL is the durable source of truth. Requests are workspace-scoped aggregates stored as JSON plus a dashboard projection; version-checked RPC writes provide compare-and-swap updates.

`requests/shared-store.js` rehydrates one request into the SQLite domain engine in memory, applies the same validated commands used by tests, and commits its aggregate back to Postgres. It is not a second persistent production database. Read hydration is bounded to batches of eight requests; full history can still become expensive as aggregates grow.

## AI boundaries

Coordinator calls Intake, deterministic Review, then Follow-up as needed. Daily Brief selects order inside server-owned deadline groups. Internal Review reads correspondence and prepares a manager request. Provider schemas, exact quote checks and revision checks fail closed.

Every hosted provider attempt passes through `server/ai-usage.js` and an atomic PostgreSQL budget reservation. Cached/idempotent results make no provider attempt and consume no new reservation. Failed or interrupted attempts retain their reservation because the provider may already have processed them. See [usage limits](ai-usage.md).

## Development and tests

The local SQLite adapter exists for offline smoke checks, domain regression tests and CLI development. It is disabled as a fallback when shared configuration is present. Production routes do not silently switch to a local file after a database error. The unused Prisma scaffold has been removed.

## Reliability limits

Hosted model operations now use checkpointed background workflows. Completed steps and database writes can recover across request disconnects; uncertain paid calls require explicit retry. See [durable AI runs](durable-ai.md) for provider fencing, deployment prerequisites and verification.

The production domain still uses a temporary SQLite validation engine over Postgres aggregates. A native Postgres domain rewrite requires parity tests for revision ordering, idempotency, stale results and audit atomicity before a data migration. That remains separate architecture work.
