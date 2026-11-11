# Setup and collaborator guide

How to set up the local development fallback or the authenticated shared backend. The deployed app is https://syncflow-one.vercel.app. Catalog data remains fictional; no music rights are granted.

## 1. Fresh checkout

Requires Node.js 24 and pnpm 11.25.0.

```sh
git clone https://github.com/IvayloNanev/syncflow.git && cd syncflow
pnpm install --frozen-lockfile
cp -n .env.example .env     # never overwrite an existing .env
pnpm smoke                  # no API key needed
pnpm dev                    # http://127.0.0.1:3000
```

With `pnpm dev` running, http://127.0.0.1:3000/api/health returns `{"status":"ok"}`.

## 2. Environment variables

| Variable | Needed for | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | Live analysis in the browser and `*:claude` scripts | Server-side only. Never commit it, paste it in chat or expose it to the browser. Each collaborator uses their own key. |
| `ANTHROPIC_MODEL` | Same | A model enabled on your account. See [Claude setup](claude-setup.md). |
| `NEXT_PUBLIC_SUPABASE_URL` | Enables shared web mode | Project URL; when set, local fallback is disabled. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Shared sign-in | Publishable key, never a secret key. |
| `SUPABASE_SECRET_KEY` | Shared request persistence | Server-only, in ignored `.env.local`; never expose to clients. |
| `SYNCFLOW_APP_ORIGIN` | Production shared mode | Explicit HTTPS deployment origin; required before hosting. |

## 3. Data and migrations

- Without a Supabase URL, the local writer is `requests/store.js` at `.syncflow-data/browser-requests.sqlite`; it initializes itself.
- With Supabase configured, web requests use hosted PostgreSQL request aggregates and authenticated workspace membership. Follow the ordered scripts in [database setup](../db/README.md) for a new project. They are already applied to the connected SyncFlow project. Do not reapply them as a reset. Local records remain untouched and are not uploaded automatically.
- Create and verify an Auth account at `/login`; a trusted administrator must assign it to a workspace before it can see requests. Until then, signing in opens `/no-access`, which shows the account, an explanation and sign-out. Self-signup grants no team access. See the [architecture](architecture.md).
- Confirmation emails link back to `<app origin>/auth/callback`, for example `http://127.0.0.1:3000/auth/callback`. An administrator must allow that URL under Supabase Auth redirect URLs, or the link falls back to the project's Site URL.
- Prisma is no longer part of the application. The SQLite engine remains the shared domain validation harness; see [architecture](architecture.md).
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
| Internal Review | Live Claude assessment of full correspondence; manager decisions are recorded by a person. |
| Sending email | **Never.** Copy the draft and send it yourself. |

## 6. Deployment

The hosted app is https://syncflow-one.vercel.app. The local fallback rejects production use. New deployments need `SYNCFLOW_APP_ORIGIN`, server credentials, Auth redirect settings and mail configuration, backups and release validation. Do not expose the local fallback through a tunnel.

## 7. Known gaps

- Shared authentication, workspace membership, workspace selection and team invitations are implemented. There is no external client portal.
- No record of when a clarification was sent outside SyncFlow (#10). Deferred in the current PRD.
- Live model-quality results do not meet every target; see the [latest evaluation](evaluation-2026-11-11.md). The ≥25% paired preparation-time target remains unmeasured.

## AI limits

Apply `db/ai-usage.sql` before deploying the budgeted provider wrappers. Missing quota storage blocks model calls. Limits are server-managed, with no browser-controlled override; see [AI usage](ai-usage.md).
