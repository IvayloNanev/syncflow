# SyncFlow prototype acceptance report — November 5, 2026

Result: all executed functional checks passed. This verifies the current **single-operator local prototype**, not production readiness, shared authentication, model-wide accuracy or human time savings.

Tested application commit: `0561c49ad1ea91df98f6571aa24246b2aa1c3fc9`, matching the contents of main merge `0900c46` when testing began. Node 24; Next development app at `http://127.0.0.1:3000`; ignored local SQLite browser store. Two additional test cases were added during this run; no application behavior was changed.

## Complete story and boundaries

A coordinator pastes a fictional licensing email → selects a recording → `/api/requests` saves it to RequestStore → the live Intake/Review/Follow-up workflow reads the saved revision → the UI displays proposals, source evidence, catalog blockers and a draft → explicit fact decisions/replies persist with revision guards → refresh/reopen restores the record.

| Boundary | Result | Evidence |
| --- | --- | --- |
| UI and catalog | Pass | Northern Lights returned eight recordings; selected TRACK-0001, with no automatic disambiguation or clearance. |
| Browser to API | Pass | Save, analyze, Accept, Reject, append and reopen rendered successful outcomes; original inputs were retained. |
| API to data | Pass | Read-only database inspection verified one new request, two messages, five audit events, three fact decisions and two immutable analysis runs. |
| Data to response | Pass | Revalidated both stored successful analysis envelopes against their original persisted contexts and exact evidence contracts. |
| Response to UI | Pass | Initial five missing fields, four catalog blockers, confirmed/proposed territory comparison and durable reopened decisions were visible. |
| Refresh persistence | Pass | Reopened before analysis, after decisions and after final replacement; selected recording, source messages and confirmed facts persisted. |

## Ten PRD acceptance cases

“Automated” below means deterministic provider/fault injection or storage tests, not paid live provider stress. Browser coverage uses one fresh fictional conversation, not ten independent real-world participants.

| Case | Result and method | What was verified |
| --- | --- | --- |
| T1 Save/reopen | Pass — browser + automated | Saved initial email and TRACK-0001; refreshed/reopened exact email, timezone and recording; no implicit confirmed facts. |
| T2 Append reply | Pass — browser + automated | Two messages retained in order. Reply advanced revision and removed old current proposals/analysis; new run contained both messages. |
| T3 Accept | Pass — browser + automated | Accepted Canada with source evidence and local coordinator/time; durable across refresh. |
| T4 Reject | Pass — browser + automated | Rejected project proposal, preserved accepted Canada and unrelated source data, retained decision across refresh. |
| T5 Changed scope | Pass — browser + automated | New reply proposed North America while Canada remained confirmed. Explicit acceptance, not analysis, replaced Canada; reopened replacement persisted. Automated tests also reject the replacement and preserve Canada. |
| T6 Catalog | Pass — browser + automated | Browser showed eight same-title candidates and four metadata blockers. Catalog tests cover all 1,000 unique IDs, version-specific matching, absent tracks, missing contact/assets and conflicts. |
| T7 Draft | Pass — browser + automated | Edited subject, clicked Copy, UI reported “Draft copied. Nothing was sent.” Stored run envelopes retained sent:false. System clipboard bytes were not independently read. Generated original draft persists; edits remain browser-only. |
| T8 Failure | Pass — automated | Existing timeout, malformed-output, invalid-evidence and provider-failure checks preserve state; explicit retry paths pass. No deliberate live provider outage or credential changes. |
| T9 Retry/concurrency | Pass — automated, browser state checks | Duplicate command replay, changed-input conflicts, stale revision rejection, in-flight reply/decision invalidation and superseded proposal checks pass. No browser network-disconnection simulation was performed. |
| T10 Local boundary and atomic history | Pass — automated + database inspection | Production/foreign-origin/forged-actor restrictions and trusted-owner isolation pass. New injected audit failures roll back reply/decision, revision, invalidation and idempotency writes; same-key retry commits once. This is not shared-account authentication. |

## Fresh live browser case

Initial email:

> Contact: Casey Demo. Project: Aurora Launch. We want Northern Lights for an advertising campaign in Canada for six months. Budget CAD 5,000 for both rights.

Manually selected Maya Rivers / Northern Lights / Original, TRACK-0001. Expected seven supplied fields and five absent fields were identified correctly in this case. Artist and version were not invented from the selected catalog entry. Five questions covered artist, version, platforms, music length and deadline. Four internal catalog blockers covered publishing verification, missing master contact, absent assets and conflicting metadata; none granted rights or replaced email evidence.

Accepted territories=Canada and rejected project. Refreshed/reopened; confirmed Canada and both decisions persisted. Then appended:

> Artist is Maya Rivers. Use original recording TRACK-0001. Platforms: YouTube and Instagram. Music cue: 30 seconds. Response deadline: November 12, 2026 at 5 pm America/Toronto. Correction: territory is North America, replacing Canada. Project remains Aurora Launch.

New run used confirmed Canada as context, proposed North America with previous_value=Canada, and found zero remaining email checklist gaps. Confirmed Canada remained unchanged until the explicit Accept click. Final revision 4 retained North America, two messages, three decisions and five audit events. Both previous analysis runs were stale after decisions; no stale active result remained. Catalog clearance remained false with four internal blockers.

Three live Claude calls total: initial Intake + Follow-up, then reply Intake (Follow-up skipped). No email sent. This is one successful semantic example, not a revised held-out accuracy score.

Raw fictional inputs, contexts, outputs and state: [acceptance evidence](../evaluation/results/acceptance-2026-11-05.json). Screenshots are local user-facing artifacts outside the repository.

## Automated verification

- **160 tests passed, zero failed**, including two new audit-failure rollback tests in [atomic-storage.test.js](../tests/atomic-storage.test.js).
- Existing tests exercise 50 concurrent mock workflows, 20 simultaneous mock timeouts, schema privilege rejection, API overload/body recovery, evidence validation, command replay, owner isolation and stale activation. These do not measure live Anthropic throughput or comprehensive prompt-injection resistance.
- ESLint, TypeScript, development fixtures, frozen 20-case corpus integrity and production build passed. Corpus integrity is not model evaluation. Production build does not enable the development-only endpoints.
- New fault tests use temporary databases and SQLite triggers that fail an audit insertion after a request/decision mutation. They verify rollback of **all** associated changes, then remove the temporary trigger and verify exactly-once retry. The user's browser database was not fault-injected or deleted.

Reproduce with Node 24 and the repository's pinned pnpm:

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm validate:fixtures
pnpm validate:evaluation
pnpm build
```

## Issues and limits

No functional failure was observed in the executed scenarios. An untested atomic rollback failure path was found in coverage and is now covered by two passing tests; no application fix was needed.

Not established by this report: 25% preparation-time improvement, coordinator usability, full held-out precision/recall targets, comprehensive injection resistance, accessibility/mobile compatibility, real network-loss browser recovery, database corruption/backup recovery, production capacity, shared user access or a complete licensing workflow. The prior exploratory 20-case model baseline still missed some quality targets and was not rerun here. Local operator attribution is not authentication. A running analysis may remain pending after process interruption and needs explicit recovery.

Next: Ivaylo and Mosiah run the five matched manual/assisted timing pairs and record accuracy plus completion time. Keep known shortcomings visible rather than treating 160 structural/lifecycle tests as proof of model accuracy or time savings.
