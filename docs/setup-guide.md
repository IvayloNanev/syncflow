# Setup and collaborator guide

How to set up the local development fallback or the authenticated shared backend. The app is not deployed. Catalog data remains fictional; no music rights are granted.

## 1. Fresh checkout

Requires Node.js 24 and pnpm 11.25.0.

```sh
git clone https://github.com/IvayloNanev/syncflow.git && cd syncflow
pnpm install --frozen-lockfile
cp -n .env.example .env     # never overwrite an existing .env
pnpm db:generate            # generates the unused Prisma client so typecheck/build pass
pnpm smoke                  # no API key needed
pnpm dev                    # http://127.0.0.1:3000
```

With `pnpm dev` running, http://127.0.0.1:3000/api/health returns `{"status":"ok"}`.

## 2. Environment variables

| Variable | Needed for | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Live analysis in the browser and `*:claude` scripts | Server-side only. Never commit it, paste it in chat or expose it to the browser. Each collaborator uses their own key. |
| `ANTHROPIC_MODEL` | Same | A model enabled on your account. See [Claude setup](claude-setup.md). |
| `DATABASE_URL` | Prisma scaffold only | Not used by the running app. |
| `NEXT_PUBLIC_SUPABASE_URL` | Enables shared web mode | Project URL; when set, local fallback is disabled. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Shared sign-in | Publishable key, never a secret key. |
| `SUPABASE_SECRET_KEY` | Shared request persistence | Server-only, in ignored `.env.local`; never expose to clients. |
| `SYNCFLOW_APP_ORIGIN` | Production shared mode | Explicit HTTPS deployment origin; required before hosting. |

## 3. Data and migrations

- Without a Supabase URL, the local writer is `requests/store.js` at `.syncflow-data/browser-requests.sqlite`; it initializes itself.
- With Supabase configured, web requests use hosted PostgreSQL request aggregates and authenticated workspace membership. Apply `db/shared-schema.sql` and `db/shared-analysis-lease.sql` once to a new project using the migration tools; both are already applied to the connected SyncFlow project. Do not reapply them as a reset. Local records remain untouched and are not uploaded automatically.
- Create and verify an Auth account at `/login`; a trusted administrator must assign it to a workspace before it can see requests. Self-signup grants no team access. See the [shared-backend section](../README.md#authenticated-shared-workspace-current-web-backend).
- `prisma/` and `pnpm db:migrate` belong to an unused scaffold. Do not point it at the browser database or add a second writer.
- **Reset the synthetic dataset:** stop `pnpm dev`, then run `pnpm data:reset`. It lists the files, asks you to type `reset`, and deletes only the request database and its SQLite sidecar files. This cannot be undone.

## 4. Checks

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm validate:fixtures
pnpm validate:evaluation
pnpm build
pnpm smoke
```

`pnpm smoke` runs the real request handler against a temporary database with mock agents: save, duplicate-save retry, analyze, reply and dashboard listing, checking the server-derived status at each step. It calls no model and sends nothing. CI runs it after the tests.

Both collaborators should run sections 1 and 4 on a fresh clone and record the result on issue #18.

## 5. What is live and what is rule-based

| Part | How it works |
| --- | --- |
| Intake (proposed facts and quotes) | **Live Claude** in the browser and `*:claude` scripts. Mock replays fixtures in tests, `*:demo` and `pnpm smoke`. |
| Follow-up draft | **Live Claude** in the browser. Template mock in tests and smoke. |
| Review checklist | Deterministic code (`agents/review`). Not AI. |
| Catalog search and blockers | Deterministic, 1,000 synthetic recordings. No real rights data. |
| Status, readiness and dashboard | Deterministic server rules. See [readiness](readiness.md) and [dashboard](dashboard.md). |
| Reviewer records and internal summary | Manual coordinator records. See [reviewer tracking](reviewer-tracking.md) and [internal handoff](internal-handoff.md). |
| Sending email | **Never.** Copy the draft and send it yourself. |

## 6. Deployment

Not deployed. The local fallback still rejects production use. Shared mode supports authenticated storage, but hosting also needs explicit `SYNCFLOW_APP_ORIGIN`, deployment credentials, Auth redirect settings and mail configuration, backups and release validation. Do not expose the local fallback through a tunnel.

## 7. Known gaps

- Shared authentication and workspace storage are implemented; initial memberships are administrator-managed. No invitation-management UI, workspace chooser or external client portal yet.
- No record of when a clarification was sent outside SyncFlow (#10). Deferred in the current PRD.
- No hosted deployment (#18).
- Model-quality targets and the ≥25% preparation-time target are not yet measured. See the [acceptance reports](acceptance/).
