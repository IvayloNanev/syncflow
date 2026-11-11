# Readiness review — November 11, 2026

The README-only external review identified useful concerns, but its test count and some product descriptions were historical. Current behavior is described in the [user stories](user-stories.md) and [architecture](architecture.md).

## Changes completed

- Shortened README; archived the prior implementation log with a historical warning.
- Reconciled auto-populated agent facts with stored human confirmation and explicit decision/completion actions.
- Removed unused Prisma dependencies, scripts, schema, and client scaffold. Retained the tested SQLite domain engine and local development harness deliberately.
- Added shared, atomic hosted usage limits for every model attempt across the three agents, including retries. Added usage counters, byte caps, minute limits, and a server-only kill switch.
- Added the owners' selected proprietary/all-rights-reserved license.
- Re-ran the frozen live evaluation and published failures without replacing historical reports.
- Triaged all 18 open issues and verified current Supabase security findings.

## Verification

344 automated tests passed. ESLint, TypeScript, production build, development-fixture validation, frozen evaluation-corpus integrity, and all eight mock smoke checks passed. Frozen-lockfile installation succeeded after removing Prisma. Database tests used rolled-back isolated records; no paid calls were made by these quota checks. The separate synthetic live evaluation is reported below.

## Remaining release constraints

1. **Accuracy needs scoped interpretation.** The earlier full workflow run measured 92.7% field recall and one schema rejection. The subsequent strict Intake change achieved 98.3% recall and 12/12 validated responses on a new frozen synthetic set; see [Intake reliability](intake-reliability-2026-11-11.md). Two field misses remain and partner key review is pending. The older blocking-issue recall was 92%, meeting 90%, while unmatched flags exceeded the frozen-key limit. Subsequent [clarification fixes](clarification-quality-2026-11-11.md) pass 16 current-policy rule cases and four bounded live workflows. These checks do not establish full workflow acceptance or replace the old scores.
2. **Leaked-password protection is disabled.** The linked project is on Supabase Free. Supabase requires Pro or higher for this feature. A paid-plan decision and subsequent dashboard setting change are required; no subscription upgrade was performed. [Official password-security documentation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
3. **Execution is synchronous.** Leases, bounded calls, explicit recovery, and quotas constrain current runs. There is no durable job queue or automatic crash resumption. A queue migration needs durable job state, idempotent workers, cancellation, and deployment verification; it is not implied by the new quota tables.
4. **Persistence remains an aggregate adapter.** Postgres stores each request snapshot and CAS version; SQLite validates domain transitions in memory. A normalized native-Postgres rewrite remains architectural work, requiring command/replay parity and data migration tests.
5. **Human acceptance remains unrecorded.** Partner sign-off, paired timing, and fresh setup on both collaborator machines must be completed before their milestone issues can be closed.

The four `rls_enabled_no_policy` informational findings on briefing/demo/internal server tables were inspected: these tables grant access only to `service_role`. No client-access policies were added merely to silence an informational advisory.

The usage schema has been applied to the linked database. Application changes are local until reviewed and deployed. No client emails were sent and no case status was changed by this work.
