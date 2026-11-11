# SyncFlow

An AI-assisted music licensing workspace by **Ivaylo Nanev and Mosiah James**.

[Open SyncFlow](https://syncflow-one.vercel.app) · [Setup](docs/setup-guide.md) · [Current workflow](docs/user-stories.md) · [Product requirements](docs/prd.md) · [Architecture](docs/architecture.md)

## What it does

1. Receive or paste a client email in **New Inquiries**, then save it as a case.
2. Open **Cases** to review the preserved conversation and choose Coordinator or Internal Review.
3. **Coordinator** extracts source-backed details, flags gaps and contradictions, and drafts a client response.
4. **Internal Review** reads the saved correspondence and prepares a manager decision request. A person records the manager’s reply.
5. Complete, reopen, or soft-delete cases through explicit controls.

The **Daily Brief** groups overdue cases first, then cases due today, upcoming deadlines, and undated cases. AI prioritizes within those groups.

## Human control

Agent-extracted details populate automatically and retain their source evidence and agent provenance. They are **not human-confirmed facts**. A current, unblocked correction can change the effective display while preserving the stored human-confirmed record and audit history. Coordinators review exceptions and drafts; automatic extraction is not acceptance or rights clearance.

Drafts are never sent automatically. Copying an email does not mark it sent. Manager decisions and completion are explicit human actions. No agent grants music rights.

## Run locally

Requires Node.js 24+ and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
cp -n .env.example .env
pnpm smoke
pnpm dev
```

Preserve existing environment files. Follow the [setup guide](docs/setup-guide.md) for Supabase sign-in, membership, schema scripts, and server-only provider credentials. Local fallback is a development/test harness, not a second production backend.

## Verify

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm validate:fixtures
pnpm validate:evaluation
pnpm build
```

Tests and mock smoke checks do not call a paid model. A live evaluation requires Claude credentials and may make up to 40 paid calls using synthetic cases only.

## Release evidence and limitations

- [Readiness review and remaining work](docs/readiness-2026-11-11.md)
- [AI usage limits](docs/ai-usage.md)
- [Evaluation methodology](evaluation/README.md) and [latest Intake verification](docs/intake-reliability-2026-11-11.md) and [earlier full workflow evaluation](docs/evaluation-2026-11-11.md)
- [Clarification routing and quality checks](docs/clarification-quality-2026-11-11.md)
- [Issue triage](docs/issue-triage-2026-11-11.md)

Passing automated tests does not establish human usability, production capacity, or licensing accuracy. Historical evaluation failures remain published; new results are reported separately. Catalog fixtures are synthetic.

## Ownership

Proprietary. All rights reserved. See [LICENSE](LICENSE).

Historical implementation notes live in [docs/history](docs/history/readme-before-readiness-2026-11-11.md).
