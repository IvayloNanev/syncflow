# Application persistence

Hosted web mode uses Supabase PostgreSQL request aggregates with compare-and-swap commits. The domain transition engine validates each command in temporary in-memory SQLite; there is no Prisma client or Prisma schema. Local development uses the separate file-backed SQLite harness. See [architecture](../docs/architecture.md).

For a new Supabase project, apply these scripts once, in order, through a trusted migration connection:

1. `shared-schema.sql`
2. `shared-analysis-lease.sql`
3. `daily-briefings.sql`
4. `internal-review-runs.sql`
5. `internal-review-routing.sql`
6. `email-forwarding.sql`
7. `email-inbox-external-senders.sql`
8. `email-inquiries.sql`
9. `team-invitations.sql`
10. `normalize-request-summary.sql`
11. `ai-usage.sql`

Scripts assume Supabase Auth and its standard roles. Inspect each script before applying; these are ordered schema scripts, not an automatically replayed migration runner. They are already applied to the linked SyncFlow project. Never reapply schema scripts as a reset. Configure memberships, inbox routing, Auth callbacks, and server environment variables separately. Run `check-shared-isolation.sql` as a trusted administrator after setup.

All mutations must use authenticated workspace membership, revision guards, and existing command services. Server-only storage and usage counters must never be granted to anonymous or authenticated browser roles.
