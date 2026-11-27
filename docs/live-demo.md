# Live guest demo

`/demo` starts a private two-hour guest session and opens the same `/dashboard`, `/inquiries`, `/cases`, `/coordinator` and `/internal` routes used by signed-in users. There are no mock AI results in this mode. `/demo/preview` remains the optional no-AI sample.

## Setup

1. Apply `db/live-demo.sql` after the shared and durable AI migrations. The migration defaults to disabled and grants no public database access.
2. With server-only Supabase credentials, run `SYNCFLOW_SETUP_LIVE_DEMO=1 pnpm exec node scripts/setup-live-demo.mjs`. This creates a dedicated, banned-from-login service identity, verifies it has no team memberships, and enables the guest settings. It sends no email and creates no visitor accounts.
3. Deploy the code to Vercel with the existing Anthropic, Supabase and canonical app-origin configuration. Production admission trusts only Vercel's overwritten client-IP header. Local testing uses the development server and loopback app origin.
4. Test two separate browser sessions. Each must have different seeded case IDs. Neither may read a case or AI-run token from the other session or a team workspace.

The server issues a random 256-bit HttpOnly, SameSite=Lax cookie, Secure on HTTPS. Only its SHA-256 digest is stored. While the cookie is present, workspace selection always uses that guest workspace; an invalid or expired guest cookie never falls through to team data. Exit demo revokes the guest session and clears only the guest cookie, preserving any real sign-in.

## Limits and permissions

- 20 new sessions per UTC day globally; 3 per network.
- 12 provider attempts and 8 durable AI runs per guest session; 60 provider attempts per UTC day globally and 24 per network.
- 64 KB maximum provider input, with the existing 8,192-token output ceiling and workspace budgets still enforced.
- Three seeded source-only cases, plus at most six user-created cases and 100 mutation commands per session. Seeded cases have no fabricated analysis; one is explicitly assigned to Internal Review.
- Public RPC/table access is revoked. The service identity can only be provisioned into reserved guest workspaces. Domain validation, source citations, revisions, idempotency and durable recovery are unchanged.
- Pasted inquiries, recording lookup, reviewer/manager decisions, completion, reopening and soft deletion use the existing application handlers. External email receiving and team administration require a signed-in team workspace.

Guest inputs should be fictional. They are saved in the database and sent to the configured AI provider when an agent is run. Session expiry revokes browser access; it does not erase the stored audit records. Guest records need a separate retention/cleanup policy before long-term public operation. No automatic deletion of database records is introduced by this change.

To stop admission and provider calls, set `syncflow_demo_settings.enabled=false` using the service-role connection. Existing team workspaces do not use the demo budget path.
