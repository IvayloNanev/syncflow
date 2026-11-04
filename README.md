# SyncFlow

Multi-agent sync licensing intake and internal review workspace. A school prototype by Ivaylo Nanev and Mosiah James.

## User stories

These stories are hypotheses derived from the job description and our proposed workflow, not validated user-research findings.

1. As a licensing coordinator, I want client emails converted into structured details so that I spend less time copying information into records.
2. As a licensing coordinator, I want missing or conflicting details flagged so that I can resolve them before an incomplete handoff.
3. As a licensing coordinator, I want editable clarification drafts so that clients receive specific questions without repeated writing.
4. As a licensing coordinator, I want to review proposed changes from replies so that confirmed information stays accurate as client plans change.
5. As a licensing coordinator, I want review decisions and blockers visible so that I know who needs to act before a request can advance.

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

## Claude provider (requires your API credentials)

See [Claude setup](docs/claude-setup.md). Set `ANTHROPIC_API_KEY` and an enabled `ANTHROPIC_MODEL` in your ignored local `.env`, then run `pnpm intake:claude` for one fictional live example. This sends context to Anthropic and may incur API charges. Tests use fake transport only; the provider has not yet been verified against a real account. Never commit `.env` or a key.
