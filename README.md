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
pnpm dev
```

Open `http://127.0.0.1:3000`. The browser request database is initialized automatically in .syncflow-data/; Prisma migration is not required for this flow. Sample data is fictional. No email is sent by the app.

## User stories

These stories are hypotheses derived from the job description and our proposed workflow, not validated user-research findings.

1. As a licensing coordinator, I want client emails converted into structured details so that I spend less time copying information into records.
2. As a licensing coordinator, I want missing or conflicting details flagged so that I can resolve them before an incomplete handoff.
3. As a licensing coordinator, I want editable clarification drafts so that clients receive specific questions without repeated writing.
4. As a licensing coordinator, I want to review proposed changes from replies so that confirmed information stays accurate as client plans change.
5. As a licensing coordinator, I want review decisions and blockers visible so that I know who needs to act before a request can advance.

## Working assumptions

These are prototype decisions to validate with a coordinator, not confirmed Warner Music Group policy.

- **One request per recording:** each saved request tracks one recording and its licensing details.
- **Replies appended to history:** replies and corrections are added as new messages; the original email is retained rather than overwritten. Changes advance the request revision so older analysis cannot become the current result.
- **Multi-recording requests flagged:** an email covering several recordings is flagged for coordinator review and splitting into separate requests. The agent must not silently select one recording or combine their terms.
- **Saving does not confirm agent facts:** storing an email or an analysis preserves the record only. Extracted details remain proposals until the coordinator explicitly confirms them.

The local browser now saves requests and analysis through the tested SQLite adapter in .syncflow-data/browser-requests.sqlite. This is a single-operator development workspace on this computer, not shared authenticated storage. Prisma integration remains pending; explicit local Accept/Reject decisions are implemented below.

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

Saved requests/reply history, a third AI agent for internal summaries of confirmed facts, and manual revision-bound approval tracking are described in the [expanded-scope design](docs/expanded-scope.md). The local saved-request foundation is implemented below; shared persistence, the summary agent and approval tracking remain planned; the local browser persistence described below is implemented. Invoice/payment tracking stays a stretch goal.

## Local saved-request foundation

Run `pnpm requests:demo` to see a fictional email/reply persist across a database close/reopen. The [SQLite request store](docs/request-store.md) supports revisions, idempotent commands and audit history. It is connected to the local browser through /api/requests and does not implement login/shared storage. Node 24+ is required.

Run `pnpm requests:analysis:demo` to persist/reopen a mock analysis against a saved revision and see a reply invalidate it. See [saved analysis](docs/saved-analysis.md): results stay proposals; the local browser integration is implemented below, while shared login remains unfinished; local fact confirmation is implemented below.

## Branch reconciliation

The Next.js/Prisma application foundation from `developer` is combined with the latest agent and local request-store work. The connected home screen saves through the existing raw SQLite adapter; Prisma-backed saving remains a scaffold. The local browser has exactly one request writer. Prisma's application schema and `requests/store.js` are separate local SQLite mappings; do not point them at the same database or assume data is synchronized. See [integration reconciliation](docs/app-reconciliation.md) before wiring storage or agent routes.

## Connected browser demo

`pnpm dev` opens the local coordinator screen at http://127.0.0.1:3000. Paste a fictional email to see live proposed facts/source quotes, issues and an editable draft. It uses the existing server-only Claude credentials. Requests and analyses persist locally; local fact confirmation is available; shared login remains unfinished. See [browser flow and verification](docs/browser-analysis.md).

## Fictional recording catalog

The browser now includes 1,000 deterministic synthetic recordings from `catalog/recordings.js`, with title/artist/ID search, version filtering, pagination and explicit coordinator selection. Ten selectable client scenarios in `catalog/scenarios.js` cover ambiguous titles, alternate versions, missing matches, incomplete metadata and multiple recordings. Their expected candidate IDs are tested; they are not live model accuracy scores.

All artists, labels and metadata are fictional; contacts use example.com. No audio files, commercial catalog integrations or verified rights are included. Metadata gaps and conflicts are deliberate test cases. Selecting a recording associates it with a request when saved. Catalog metadata stays separate from email evidence. The server resolves the selected ID and returns a separate catalog-review block of coordinator tasks; these tasks are not inserted into client clarification drafts. Editing the email clears selection and prior results. Multiple recordings require separate requests; automated splitting and catalog-aware AI reasoning remain future work; local browser save/reopen is implemented below. The local saved-request adapter accepts and preserves a validated recording_id, independently of the browser.

## Catalog review handoff

Email analysis accepts an optional recording_id, resolved against server-owned synthetic metadata. The response includes catalog_review with the selected recording and coordinator-only blockers for publishing verification, missing master contacts, absent assets and metadata conflicts. No selection yields an identity blocker. These checks are deterministic; neither AI agent is granted authority to confirm catalog facts or rights. Catalog blockers are displayed separately from email checklist issues and the client draft. The API rejects unknown IDs and client-supplied catalog objects before model calls.

Local RequestStore.create accepts recording_id and includes it in idempotency checks. Saved records retain it across replies and reopening; analyzeSavedRequest returns a separate catalog review. Existing records without an ID remain unresolved. The browser saves the selection with its request and analyzes the immutable saved revision. It uses the raw SQLite adapter, not Prisma. A changed recording requested in a reply requires coordinator handling; selection is never silently changed by an agent.

## Saved browser requests (local development)

Run `pnpm dev`, open http://127.0.0.1:3000, paste a fictional email, select a recording, and choose **Save request** or **Save & analyze**. Saved requests appear in Request history. Refresh the page and choose **Open request** to restore the original email, recording, timezone and current analysis. Append replies with **Save reply**, then analyze the new revision. The original message is read-only. Saved recording identity can be corrected with a required reason and audit history; see [Recording corrections](docs/recording-correction.md). Follow-up drafts are unsent; saved internal handoff edits persist separately.

The browser's only writer is the existing RequestStore adapter, in the ignored `.syncflow-data/browser-requests.sqlite` database (private directory/file modes). This deliberately replaces the earlier proposed Prisma-first integration for the local prototype: reuse the tested lifecycle rather than introduce a second writer. Prisma's schema/dev.db remain an unused application scaffold and are not synchronized. No existing database is migrated or overwritten. Copying a database to share it is not a multi-user system.

The development-only POST `/api/requests` supports list/get/create/reply/analyze commands. Host/Origin checks restrict it to the same loopback app; production returns 503. The local operator identity is server-owned and cannot be supplied by a browser. There is no authentication: anyone with access to this local development app can read its local requests. Do not expose it through a tunnel or network listener. Shared partner access requires authentication and hosted storage first.

Mutations use stable command keys across network retries. Replies require the current revision, append history atomically and invalidate previous active analysis. Analysis reads saved messages, runs outside database transactions, persists its immutable context/results and activates only if the source revision is still current. Saving never confirms proposed facts. Provider failures preserve messages and safe run status; explicit new-key retries create a new run. Interrupted running commands can remain pending after process failure; reopen first, then use **Retry analysis with a new run** if another paid attempt is intended. No automatic recovery, background queue, email sending or licensing approvals are implemented. Local fact confirmation is described below.

## Saved recording corrections

A coordinator can change or clear a saved recording without restarting the request. The correction preserves source messages and confirmed client facts, advances the revision, and invalidates dependent analysis, handoffs, reviewer decisions and completion. A reason is required and retained in audit history. Confirmed artist, title or version mismatches block internal-review readiness. Catalog metadata never becomes confirmed client evidence. See [behavior and validation](docs/recording-correction.md).

## Coordinator fact decisions

Open a saved request with an analysis. The fact-review panel shows confirmed values separately from agent proposals and their exact source quotes. **Accept** saves that proposal's value/evidence with the server-owned local coordinator identity and timestamp. **Reject** records the decision without changing a confirmed value. Values and evidence are loaded from the saved run; the browser submits IDs and a decision only. Repeated commands replay safely rather than applying twice.

Every saved decision advances the request revision and makes previous analysis/drafts outdated. Remaining undecided fields from that same review source can still be reviewed; rerun analysis to refresh checklist/draft. A reply removes the remaining review source, and a newer completed analysis replaces it. Confirmed fields are included in future agent context; an agent may propose a different value but cannot overwrite it. Old values, evidence and human decisions remain in history. This is local request-fact verification, not music-rights clearance. Rejection does not permanently suppress an agent from proposing the same value on a later run. Undo, manual value editing, N/A waivers and issue-resolution commands are not included.

## Current acceptance results

See the [November 5 prototype acceptance report](docs/acceptance-report-2026-11-05.md): 160 automated tests plus a fresh live-browser save/analyze/Accept/Reject/reply/reopen flow passed. The report maps the ten PRD cases to their browser or automated evidence and includes new audit-failure rollback checks. Human time savings, full model-quality targets and production/shared access are not established by these tests.

### Instant intake preview

Paste an email to see a provisional catalog match and likely missing details immediately; click **Analyze & draft next email** to run the agents and open the follow-up draft automatically. The immediate preview uses conservative local pattern checks, not an agent call, and may miss paraphrases or nuanced contradictions. It auto-selects only one unambiguous catalog candidate; otherwise use the catalog options to clarify. Agent proposals still require human confirmation, and copying a draft does not send it.

### Unified request workspace (UX audit correction)

The numbered stage tabs have been replaced by one workspace: conversation and draft on the left, one recording card plus client questions/internal checks on the right, and expandable fact confirmation below. After analysis, current validated results replace provisional hints; replies and decisions mark outputs stale until refreshed. An unresolved recording requires acknowledgement before saving; recovery copies the original email into a new request and preserves the old history. No clearance, internal-review approval or sending is automated. A practitioner usability check is still needed.

### Internal handoff summary

Open **Prepare an internal handoff summary** under the fact review, then generate, edit and copy the report for manual sharing. The deterministic generator uses confirmed client facts with source evidence, explicitly marks unconfirmed fields, and separates client questions from fictional catalog/internal verification checks. It makes no extra model call. A record or analysis change invalidates an existing summary until regenerated. Use Save handoff edits to persist a version; regenerate replaces editor text, while saved versions remain recorded. This does not assign reviewers, record decisions or grant clearance.

### Internal reviewer tracking

Expand **Internal reviewers** to assign a named reviewer and record decisions received outside the app: Pending, Approved, Changes requested or Declined, with notes. Reviewer records persist in the local SQLite store with attribution, timestamps and decision history. Assigning someone does not send a notification or grant access. Request revision changes conservatively require all prior non-Pending decisions to be reconfirmed; older approvals do not count as current. Re-analysis alone does not invalidate reviews. Concurrent reviewer edits are version-checked, commands are idempotent, and reviewer decisions do not modify request facts/revision. Formal readiness/completion gates and a dashboard remain future work.

### Status and readiness gates

Saved requests now display server-derived status, next action and readiness blockers. Internal review completion requires an exact recording, all 12 prototype facts confirmed, a current successful analysis with zero checklist issues, at least one assigned reviewer, and current Approved decisions from every assigned reviewer. Completion is a manual, idempotent action recorded with actor, time, request revision and reviewer version. Later request/reviewer changes make earlier completion outdated. All 12 fields are required in this prototype; justified not-applicable exceptions are not implemented. Internal publishing checks and the separate licensing process remain outstanding even when internal review is complete.

### Request dashboard

Use **View all requests** to see server-derived status, confirmed client/project/song/deadline, responsible internal actor, blockers and next action. Search by client/project/song/source preview/ID, filter status, sort by confirmed calendar deadline or status, and open a saved request. Unconfirmed deadlines remain unknown; times and timezones are never inferred. Responsibility names outstanding internal reviewers only for review-stage work; otherwise the coordinator acts next. Dashboard counts reflect saved data, not cleared licences. Refresh retrieves current local state; this is not a multi-user realtime dashboard. Opening another view can discard unsaved handoff edits; save them before leaving.

### Saved handoff versions

Save edited internal summaries using **Save handoff edits**. The latest version is restored on reopen, with actor/time and version history. Request revisions, new analysis runs or reviewer changes mark the saved summary outdated; regenerate before saving or copying. Saves use server source tokens and expected versions to prevent stale or concurrent overwrites, and never change request facts or approvals. Unsaved edits remain browser-local.

### Latest acceptance result

See [product acceptance — Nov 5](docs/acceptance/2026-11-05-product-acceptance.md). Functional regression/build checks pass, but live field recall was 93.8% against a 95% target; a territory contradiction was missed and one case failed validation. Raw false-discovery scores also miss target, largely due to the documented deadline-policy/key mismatch. Human time savings and uncoached usability remain unmeasured. Do not treat passing code tests as full PRD acceptance. A human study worksheet is included in the report folder.

### Quality follow-up

[Territory conflict and rejection follow-up](docs/acceptance/2026-11-05-quality-follow-up.md): explicit contradictory territory statements now have a deterministic blocking check, and Intake handles explicit correction supersession more clearly. Four new confirmation workflows passed 12 checks; 185 regressions pass. The old validation failure did not reproduce in three diagnostic calls; safe diagnostic categories were added, but its cause remains unresolved. Original failed acceptance results and earlier failed targeted assertions remain preserved; global accuracy and human-study targets are not yet re-established.

### Analysis failure recovery

Failed attempts now keep fixed reason codes and safe validation categories in saved analysis history. The workspace shows what failed, a read-only status check, and an explicit new-attempt action; checking or reopening does not call the model. A failed attempt never replaces an earlier validated result. Long-running attempts require a successful status check and at least 90 seconds since recorded start before a new-attempt action appears. Duplicate retries remain idempotent and there are no automatic model retries. Source messages, confirmed facts, handoffs and reviewer records are retained. This improves diagnosability; it does not establish that every model response will validate or resolve the historical unexplained rejection.

## Three interface areas

- `/`: landing page with customer and coordinator entry points.
- `/customer`: local customer submission form. Paste a brief; submit to the existing SQLite request queue and receive a reference. No model call is made at submission. Retries preserve an idempotency key until input changes.
- `/internal`: existing coordinator workspace, with saved requests, analysis, follow-up drafts and internal review.

The local `/api/customer/requests` endpoint accepts create only and returns a receipt without internal facts, analysis, notes or approvals. These pages are navigation separation, not authorization. The application still has one local operator, production-disabled request APIs, and no client accounts. Secure customer status/replies, tenant isolation and authentication remain unimplemented; no external portal is being published. Customer briefs use America/Toronto as the provisional coordinator timezone; explicit deadline timezone confirmation remains required. Submission does not send email, select a recording, confirm facts or grant music rights.

The project landing page uses a dark, warm-gold glass visual presentation. The Coordinator page contains an optional Play/Pause walkthrough with five selectable stages. The walkthrough uses fixed fictional examples, makes no agent calls, saves no records and grants no approvals. Its motion is user initiated; reduced-motion settings disable animated transitions. The operational customer and coordinator pages remain separate.

## Corrected page organization

The three active pages are Landing (`/`), Coordinator (`/coordinator`) and Internal review (`/internal`). Coordinator contains client email intake, the fictional music catalog, analysis, fact review and client follow-up drafts. Internal review contains saved-request selection, readiness, handoff summaries and manually recorded reviewer decisions. Links carry the saved request ID between both workspaces. The old `/customer` page redirects to Coordinator; an external client portal is no longer the chosen interface scope. The earlier customer submission endpoint remains local-only and unused by the active pages. Internal review is coordinator-managed tracking, not team chat or automatic messaging.

## UX logic safeguards

Coordinator and Internal review share a request-aware header. Opening a saved request updates the URL, and header links retain that ID. The selected request shows confirmed project/contact (or explicitly unconfirmed labels), catalog recording/version, revision and status. Only Internal review exposes the completion action. There is one queue entry; return-to-request only appears with a selection.

Empty intake shows guidance rather than twelve missing fields. `Analyze & draft response` explicitly saves first and uses Claude credits. Source-backed Confirm/Reject controls appear in the summary's visible fact-review section. Stored confirmed values remain primary during stale analysis; detected excerpts and proposed changes never inherit a confirmation badge.

Unsaved original briefs, client reply/draft edits and generated/edited handoffs have tab-local sessionStorage recovery (not shared or durable database storage). Navigation/replacement warns about unsaved text where supported; browser reload/close warnings remain subject to browser behavior. Recovered draft text whose analysis is outdated is displayed separately and is never a current response or confirmed fact. Saving a handoff remains an explicit server operation. Use fictional data locally; closing the tab or clearing browser storage can remove recovery copies.

## Exception-driven intake (supersedes per-field confirmation)

Routine request fields now populate automatically from the current successful, schema/evidence-validated Intake result after deterministic Review. Fields with review issues, rejected proposals or no source evidence are excluded from automatic use. Failed/stale analysis cannot supply current agent fields. Agent fields are a read projection from persisted analysis, labeled `agent_extracted`; they never overwrite the human-confirmed history or grant rights.

The coordinator handles missing/conflicting details and recording identity, then reviews the drafted response. There is no required Confirm button for each routine field. Current agent fields feed the request display, dashboard, handoff summary and intake readiness; summaries retain quotes and mark agent provenance. All twelve required details must still be available without open checklist issues, and required reviewers must still manually approve before internal review completes. Previous handoff summaries are invalidated by the new policy token and must be regenerated. Earlier documentation describing a twelve-click confirmation gate is historical and superseded by this section.
