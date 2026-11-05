# Setup and collaborator guide

Issue #18. How to set up, check and reset the **single-operator local prototype** from a fresh checkout. It is not a shared or production deployment. Use fictional data only.

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

## 3. Data and migrations

- The app's only writer is `requests/store.js` (raw SQLite) at `.syncflow-data/browser-requests.sqlite`. It creates its tables on first use, so **no migration command is needed** for the app.
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

Not deployed. `/api/requests` returns 503 outside `NODE_ENV=development` and accepts loopback requests only. Deployment needs hosted storage, real authentication and workspace membership first (PRD Gate 5). Do not expose the local app through a tunnel or network listener.

## 7. Known gaps

- No authentication or workspaces (#4). Requests belong to one server-owned local operator.
- No record of when a clarification was sent outside SyncFlow (#10). Deferred in the current PRD.
- No hosted deployment (#18).
- Model-quality targets and the ≥25% preparation-time target are not yet measured. See the [acceptance reports](acceptance/).
