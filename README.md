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
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000`. The sample requests in the initial workspace are fictional. No email is sent by the app.

## First milestone: shared agent contracts

This branch provides framework-neutral JSON Schemas, three fictional development fixtures, and an executable JavaScript validator. Live agents and the application backend are subsequent issues.

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
