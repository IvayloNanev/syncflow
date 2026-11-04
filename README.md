# SyncFlow

**One-line purpose:** An AI-assisted workspace for Sync & Licensing Coordinators to automate request intake, gap extraction, and workflow tracking.

## Core user stories

1. **Intake & Record Persistence:** As a Sync Coordinator, I need to save incoming client requests and message history into a database, so that I have a single source of truth that never gets lost.
2. **Review & Diff Workspace:** As a Sync Coordinator, I need to review proposed changes alongside confirmed details and explicitly accept or reject each edit, so that automated proposals never overwrite confirmed data without human approval.
3. **Clearance Status & Handoff Tracking:** As a Sync Coordinator, I need to see real-time status and active blockers for internal legal and catalog clearances, so that I can prevent requests from stalling and give accurate client updates.

Detailed acceptance criteria are in [the coordinator user stories](docs/user-stories.md).

A school prototype by Ivaylo Nanev and Mosiah James.

## Application development

The coordinator app uses Next.js App Router, TypeScript, Prisma 7, and a local SQLite database for the prototype. Node.js 24 and pnpm 11.25.0 are used by this branch.

```sh
pnpm install --frozen-lockfile
# Only if .env does not exist: copy .env.example to .env; preserve existing credentials.
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`. The sample requests in the initial workspace are fictional. No email is sent by the app.

## User stories

These stories are hypotheses derived from the job description and our proposed workflow, not validated user-research findings.

1. As a licensing coordinator, I want client emails converted into structured details so that I spend less time copying information into records.
2. As a licensing coordinator, I want missing or conflicting details flagged so that I can resolve them before an incomplete handoff.
3. As a licensing coordinator, I want editable clarification drafts so that clients receive specific questions without repeated writing.
4. As a licensing coordinator, I want to review proposed changes from replies so that confirmed information stays accurate as client plans change.
5. As a licensing coordinator, I want review decisions and blockers visible so that I know who needs to act before a request can advance.

## Agent pipeline and shared contracts

The repository provides framework-neutral JSON Schemas, fictional development and evaluation fixtures, and a callable Intake → Review → Follow-up workflow with mock and optional Claude providers. Agents return proposals and drafts; the application owns persistence and coordinator confirmation.

Requires Node.js 24 and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm validate:fixtures
pnpm validate:evaluation
```

See [agent contract documentation](docs/agent-contracts.md), [schemas and validator](contracts/), and [development fixtures](fixtures/development/).

- Ivaylo: agent contracts, pipeline and evaluation.
- Mosiah: application, persistence and workflow enforcement.
- Both: review integration contracts and end-to-end behavior.

Use fictional data only. Agents propose; the coordinator confirms. Internal review completion is not a music licence.

## Intake checklist and evaluation

See [evaluation protocol](docs/intake-evaluation.md), [versioned checklist](contracts/checklists/intake-v1.json), and [frozen case manifest](evaluation/manifest.json). The 20 expected-answer cases are separate from development fixtures; passing corpus checks is not a model score. Partner review remains pending.

## Callable Intake demo (mock only)

```sh
pnpm intake:demo
```

The callable runner validates context and proposed output, handles timeout/failure, and can check a repository's current record version. The explicitly labeled mock replays development fixtures only; it refuses arbitrary messages. No API key or network call is used. See [integration guide](docs/intake-interface.md) before connecting an application or live provider.

## Claude provider (requires your API credentials)

See [Claude setup](docs/claude-setup.md). Set `ANTHROPIC_API_KEY` and an enabled `ANTHROPIC_MODEL` in your ignored local `.env`, then run `pnpm intake:claude` for one fictional live example. This sends context to Anthropic and may incur API charges. Automated tests use fake transport. One fictional live call passed validation on November 4, 2026 after a schema-type fix; the 20-case live evaluation and follow-up regression results are recorded below. Never commit `.env` or a key.

## Review checklist

Run `pnpm review:demo` to inspect missing fields and ambiguous budget/deadline details after fixture Intake. This is a deterministic rule step, with no model call or saved changes. See [Review interface](docs/review-interface.md) for limitations and the callable function.

## Follow-up drafts

Run `pnpm followup:demo` for a template mock that turns Review questions into an unsent email. `pnpm followup:claude` uses your local Claude credentials for a real draft call. No email is sent. See [Follow-up interface](docs/follow-up-interface.md) for validation boundaries and live-test status.

## Connected workflow

Run `pnpm workflow:demo` for **Intake → Review → Follow-up** in one mock run, or `pnpm workflow:claude` for up to two real Claude calls using local credentials. Both return proposals and an unsent draft; neither saves records nor sends email. See [Workflow](docs/workflow.md) for the callable interface and live smoke-test findings.

## Local app API

`pnpm api:dev` starts the Claude-backed local API at `http://127.0.0.1:3001`. POST email and timezone to `/api/analyze` to return all three workflow stages. This is a local integration adapter, with no login or persistence. See [Local API](docs/local-api.md) for payloads, responses and frontend proxy setup.

## Verification report

See [agent handoff, prompt-injection and stress results](docs/agent-verification-report.md) and [repeatable bounded live probes](evaluation/adversarial/README.md). Automated stress tests use fake providers; live probes use fictional data and incur API charges.

The [20-case live evaluation report](docs/live-evaluation-report.md) records conservative extraction/issue scores, raw outputs and answer-key limitations. It is an exploratory baseline, not a release pass.

[Agent-quality fixes and fresh regression results](docs/agent-quality-fixes.md) document typed conflicts/split requests, clearer platform/budget questions, and routing answered issues to coordinator confirmation instead of repeating client questions.

## Agreed expansion (planned)

Saved requests/reply history, a third AI agent for internal summaries of confirmed facts, and manual revision-bound approval tracking are planned in the [expanded-scope design](docs/expanded-scope.md). These features are not implemented yet; invoice/payment tracking stays a stretch goal.

## Local saved-request foundation

Run `pnpm requests:demo` to see a fictional email/reply persist across a database close/reopen. The [SQLite request store](docs/request-store.md) supports revisions, idempotent commands and audit history. It is not connected to the HTTP API or UI and does not implement login/shared storage. Node 24+ is required.

Run `pnpm requests:analysis:demo` to persist/reopen a mock analysis against a saved revision and see a reply invalidate it. See [saved analysis](docs/saved-analysis.md): results stay proposals, and HTTP/login/confirmation integration remains unfinished.

## Branch reconciliation

The Next.js/Prisma application foundation from `developer` is combined with the latest agent and local request-store work. The home screen still uses fictional sample data. Prisma's application schema and `requests/store.js` are separate local SQLite mappings; do not point them at the same database or assume data is synchronized. See [integration reconciliation](docs/app-reconciliation.md) before wiring storage or agent routes.

## Connected browser demo

`pnpm dev` opens the local coordinator screen at http://127.0.0.1:3000. Paste a fictional email to see live proposed facts/source quotes, issues and an editable draft. It uses the existing server-only Claude credentials. Requests are unsaved; confirmation, login and saved-request integration remain unfinished. See [browser flow and verification](docs/browser-analysis.md).
