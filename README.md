# SyncFlow

**One-line purpose:** An AI-assisted workspace for Sync & Licensing Coordinators to automate request intake, gap extraction, and workflow tracking.

## Core user stories

1. **Intake & Record Persistence:** As a Sync Coordinator, I need to save incoming client requests and message history into a database, so that I have a single source of truth that never gets lost.
2. **Review & Diff Workspace:** As a Sync Coordinator, I need to review proposed changes alongside confirmed details and explicitly accept or reject each edit, so that automated proposals never overwrite confirmed data without human approval.
3. **Clearance Status & Handoff Tracking:** As a Sync Coordinator, I need to see real-time status and active blockers for internal legal and catalog clearances, so that I can prevent requests from stalling and give accurate client updates.

Detailed acceptance criteria are in [the coordinator user stories](docs/user-stories.md).

Built by Ivaylo Nanev and Mosiah James.

**Current backend:** Supabase sign-in and workspace-scoped PostgreSQL storage are wired for the web app. See [authenticated shared workspace](#authenticated-shared-workspace-current-web-backend) for setup, access rules and remaining release work. Earlier local-development notes below describe the fallback/CLI adapters.

## Setup guide

New checkout? Follow the [setup and collaborator guide](docs/setup-guide.md): environment variables, `pnpm smoke` (no API key), `pnpm data:reset`, what is live versus rule-based, and known gaps.

## Application development

The coordinator app uses Next.js App Router and TypeScript, with Supabase Auth/PostgreSQL in shared mode and the existing SQLite adapter in local mode. Prisma 7 is an unused application scaffold. Node.js 24 and pnpm 11.25.0 are used by this branch.

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

## Earlier interface iteration (superseded)

- `/`: landing page with customer and coordinator entry points.
- `/customer`: local customer submission form. Paste a brief; submit to the existing SQLite request queue and receive a reference. No model call is made at submission. Retries preserve an idempotency key until input changes.
- `/internal`: existing coordinator workspace, with saved requests, analysis, follow-up drafts and internal review.

The local `/api/customer/requests` endpoint accepts create only and returns a receipt without internal facts, analysis, notes or approvals. These pages are navigation separation, not authorization. The application still has one local operator, production-disabled request APIs, and no client accounts. Secure customer status/replies, tenant isolation and authentication remain unimplemented; no external portal is being published. Customer briefs use America/Toronto as the provisional coordinator timezone; explicit deadline timezone confirmation remains required. Submission does not send email, select a recording, confirm facts or grant music rights.

The project landing page uses a dark, warm-gold glass visual presentation. The Coordinator page contains an optional Play/Pause walkthrough with five selectable stages. The walkthrough uses fixed fictional examples, makes no agent calls, saves no records and grants no approvals. Its motion is user initiated; reduced-motion settings disable animated transitions. The operational customer and coordinator pages remain separate.

## Current page organization

The three active pages are Landing (`/`), Coordinator (`/coordinator`) and Internal review (`/internal`). Coordinator contains client email intake, the fictional music catalog, analysis, fact review and client follow-up drafts. Internal review contains saved-request selection, readiness, handoff summaries and manually recorded reviewer decisions. Links carry the saved request ID between both workspaces. The old `/customer` page redirects to Coordinator; an external client portal is no longer the chosen interface scope. The earlier customer submission endpoint remains local-only and unused by the active pages. Internal review is coordinator-managed tracking, not team chat or automatic messaging.

## UX logic safeguards

Coordinator and Internal review share a request-aware header. Opening a saved request updates the URL, and header links retain that ID. The selected request uses the same effective project/contact facts as the queue, with agent provenance, catalog recording/version, revision and status. Only Internal review exposes the completion action. There is one queue entry; return-to-request only appears with a selection.

Empty intake shows guidance rather than twelve missing fields. `Analyze & draft response` explicitly saves first and uses Claude credits. The summary shows provided, missing and clarification categories with source evidence; routine fields do not need per-field confirmation. Stored confirmed values remain primary during stale analysis; detected excerpts and proposed changes never inherit a confirmation badge.

Unsaved original briefs, client reply/draft edits, reviewer assignments/decision notes and generated/edited handoffs have tab-local sessionStorage recovery (not shared or durable database storage). Navigation/replacement warns about unsaved text where supported; browser reload/close warnings remain subject to browser behavior. Recovered draft text whose analysis is outdated is displayed separately and is never a current response or confirmed fact. Saving a handoff remains an explicit server operation. Use fictional data locally; closing the tab or clearing browser storage can remove recovery copies.

## Exception-driven intake (supersedes per-field confirmation)

Routine request fields now populate automatically from the current successful, schema/evidence-validated Intake result after deterministic Review. Fields with review issues, rejected proposals or no source evidence are excluded from automatic use. Failed/stale analysis cannot supply current agent fields. Agent fields are a read projection from persisted analysis, labeled `agent_extracted`; they never overwrite the human-confirmed history or grant rights.

The coordinator handles missing/conflicting details and recording identity, then reviews the drafted response. There is no required Confirm button for each routine field. Current agent fields feed the request display, dashboard, handoff summary and intake readiness; summaries retain quotes and mark agent provenance. All twelve required details must still be available without open checklist issues, and required reviewers must still manually approve before internal review completes. Previous handoff summaries are invalidated by the new policy token and must be regenerated. Earlier documentation describing a twelve-click confirmation gate is historical and superseded by this section.

## Live coordinator workflow

The coordinator uses the real client conversation, extracted record/checklist and response editor. The redundant five-step navigation strip and animated-example disclosure are removed. Status derives from saved messages and current validated analysis; there are no playback timers, simulated extraction results or claims of stage-level provider telemetry.

At wide desktop sizes, the live conversation, record/checklist and draft occupy three adjacent panels; smaller screens use two columns or a stacked layout. Original/reply history, automatic extraction, source evidence, category filters, draft editing/copy, reply-and-recheck, unsaved recovery and separate internal review still use the existing saved-request API. Copying does not send a message. The old standalone LandingStory component is no longer rendered in the working interface.

## Authenticated shared workspace (current web backend)

Setting `NEXT_PUBLIC_SUPABASE_URL` enables shared mode and disables the local fallback; `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and server-only `SUPABASE_SECRET_KEY` must also be configured. In shared mode, `/coordinator` and `/internal` require Supabase sign-in and an assigned workspace membership. `/api/requests` verifies the user at every request, obtains membership from the database, and uses that user ID for new audit events. Profile metadata and browser-supplied actor/workspace IDs never grant access. `/api/analyze` and the unused customer endpoint are disabled in shared mode; use the coordinator workflow. Without Supabase configuration, the existing local-only development mode remains available. Production additionally requires an explicit HTTPS `SYNCFLOW_APP_ORIGIN`; origin checks fail closed without it. Never expose or commit the secret key.

`db/shared-schema.sql` records the hosted schema. Workspace owners can invite verified-email accounts as members; initial ownership and other membership changes remain administrator-managed. Self-signup alone grants no request access. This first version supports one workspace per account; multiple memberships deliberately require a future workspace chooser rather than picking one silently. Team members can work on the same request; reviewer entries remain coordinator-recorded decisions with the authenticated recorder attributed, not digital signatures from the named reviewer.

PostgreSQL stores one versioned JSON aggregate per request, including structured messages, evidence, analysis runs, reviewer history, command receipts, and handoff versions. A compare-and-swap RPC commits each change atomically and verifies membership again at commit. The existing SQLite domain engine runs **in memory only** to validate and calculate changes to that one request; it is not the shared durable database. This transitional adapter preserves the tested lifecycle rules without maintaining two implementations. A native PostgreSQL domain implementation and large-history archival are future improvements; measure payload and memory costs before high-volume operation. Dashboard summaries are saved with the aggregate and paginated without loading full histories. Agent calls happen outside database transactions: save the run first, then reload before activation, so a concurrent reply makes older analysis stale.

Local `.syncflow-data/browser-requests.sqlite` records are left untouched and are **not automatically uploaded** to a shared team. New shared requests are stored in Supabase. A reviewed import is a separate operation. Unsaved editor recovery is scoped by verified user/workspace and retained in the same tab on sign-out. Sign-out warns before leaving unfinished edits; another account cannot restore those copies. Recovery remains tab-local, not shared storage.

### First account and team access

1. Start the app and open `/login`. Create an account, verify its email, and sign in.
2. A trusted administrator adds the verified Auth user ID to `syncflow_members` for the intended workspace. Do not grant access to every signup, match by editable metadata, or put the server key into a browser.
3. The workspace owner opens **Team**, creates a member invitation for the partner’s exact email, and shares its instructions. The partner verifies that email and accepts; both accounts then see the same saved requests.

The free hosted Auth email service is suitable for initial verification, but real delivery needs a configured SMTP provider and validated redirect URLs before rollout. Deployment, verified email delivery, operational backups/restore drills, durable agent jobs, load testing and broader live agent quality evaluation remain release work. Shared persistence and login alone do not make this a production-ready licensing system.

Run `node --test tests/shared-store.test.js tests/request-origin.test.js` for concurrency/isolation regression checks. `db/check-shared-isolation.sql` tests real PostgreSQL policies inside a transaction that rolls back all fixtures. For opt-in HTTP/Auth/storage integration tests, start the app and run `SYNCFLOW_LIVE_TEST=1 SYNCFLOW_TEST_APP_URL=http://127.0.0.1:3000 node scripts/check-shared-backend.mjs`; it creates temporary synthetic identities/workspaces and removes precisely those fixtures. It never lists real users or sends email. One team analysis at a time is enforced with a database lease, released on completion and expiring after 180 seconds after a crash. This is concurrency protection, not a complete spending quota or durable job queue.

### Seamless page transitions and recovery

Sign-in, signup, confirmation and team-access rechecks retain an allowlisted coordinator/internal request destination. The landing page offers **Open workspace** when signed in. **Forgot password?** requests a reset email; its callback opens a new-password form and then returns to the selected request. Keep the exact `/auth/callback` URL for each app origin in Supabase Auth redirect settings. Confirmation and recovery intent use a one-hour, HttpOnly, same-site cookie, so open the latest link in the same browser and on the same hostname. No wildcard redirect or relaxed email verification is needed.

A saved-request link shows a loading shell before editors mount. A failed load offers retry or request selection; queue loading/failure is distinct from a successfully empty queue. Reviewer editors retain recovery copies, warn on navigation/sign-out, and identify notes started against older reviewer records. Handoff and reviewer sections open by default, with completion after the work and its remaining blockers.

`SYNCFLOW_LIVE_TEST=1 SYNCFLOW_TEST_APP_URL=http://127.0.0.1:3000 node scripts/check-auth-journey.mjs` verifies real sign-in, request destination retention, membership rechecks, password validation/update, sign-out and expired recovery links using a disposable account/workspace that it removes. It sends no emails and calls no model. Actual reset-email delivery and following a delivered PKCE email link still require an email-delivery acceptance check.

## Owner-managed team invitations

Open **Team** (`/team`) from the workspace navigation. Only a verified workspace owner can create or revoke invitations. Enter the teammate’s exact email; invitations grant **member**, never owner, access after acceptance. Pending invitations expire after seven days. Creating the same pending invitation twice returns the same invitation. Expired/revoked history is retained; issuing another invitation creates a new record.

Invitees open `/invitations` (or sign in and see the invitation on `/no-access`), create/sign in to an account with the invited email, verify it, and explicitly accept. Shared access is added atomically with invitation acceptance. One account cannot join two workspaces, including simultaneous accept attempts. The inviter must still be an owner when acceptance occurs. Accepted invitations can be retried but cannot recreate membership that an administrator removed. Revoking a pending invitation does not remove existing memberships.

**Delivery:** invitations are stored by email and shown to the matching verified account. No invitation email is sent automatically. The owner can copy an email draft and share it themselves. The draft points to the app’s `/invitations` page; forwarding that address grants no access because the verified account email must match the private invitation record. A localhost address only works on that computer. External teammates need a deployed app origin; automatic notification delivery needs a separate configured mail provider. No real invitations or emails are sent by the tests.

**Access boundary:** the server obtains identity and verified email from Supabase `getUser()` and ignores browser-supplied actor, email-verification and role claims. `db/team-invitations.sql` records the hosted additions. The invitation table and mutation/list RPCs are service-role-only with RLS; server actions recheck owner/recipient authorization. Acceptance uses per-account and workspace locks to serialize competing joins and revocation. Owner actions are attributed, invitations are limited to 50 live pending entries and 100 new records per workspace per day, and owner history is limited to the latest 100 rows. Email matching is case-insensitive and exact otherwise; aliases are not guessed. Membership management beyond invitation acceptance and bootstrap ownership remains administrator-managed.

Run `SYNCFLOW_LIVE_TEST=1 SYNCFLOW_TEST_APP_URL=http://127.0.0.1:3000 node scripts/check-team-invitations.mjs` with the app running to verify owner-only creation/revocation, recipient visibility, wrong-email/unverified denial, expiry, duplicates/retries, member-only joins, client privilege denial and simultaneous workspace isolation. It creates and removes only disposable identities/workspaces. Hosted migrations are named `owner_managed_team_invitations` and `team_invitation_history_index`.

The existing Supabase security advisory for [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remains; the invitation additions produced no new security or performance advisories.


## Sign-in dashboard and client history

Ordinary sign-in and the landing page’s **Open workspace** action now open `/dashboard`. Explicit request, team and invitation destinations still survive authentication. **Dashboard** in the app navigation returns to the client overview; **New request** opens intake.

The dashboard loads the current workspace’s saved-request summaries through the authenticated API, offers client/project/song search, shows client/request/message counts, and groups requests by matching normalized contact labels. **View conversation history** reads the original email, appended replies and saved analysis/draft history on demand. **Continue request** reopens the same request in Coordinator; Internal review remains separate. Generated drafts do not prove an email was sent. Loading, failure, empty and no-search-match states are distinct.

Assumption: contact labels are case-insensitive display groupings, not stable customer IDs or verified CRM identities. Different contact strings remain separate; unidentified requests each stay separate. No synthetic client records are added and no existing histories are rewritten. The existing one-workspace access checks protect both the dashboard route and history API. History viewing makes no model calls and sends no messages.

## Coordinator brief sign-off

Agents populate request details automatically. Once the intake checklist is complete, the coordinator reviews the summary and selects **Approve brief for internal review** once. Individual extracted fields do not require manual confirmation. Approval records the authenticated coordinator, time, request revision and analysis run, and remains visible in approval history. This is approval of the brief for internal review, not rights clearance or permission to send an email.

A changed email, appended reply, changed recording or new analysis run requires fresh approval. Starting a newer analysis invalidates the previous approval even if the extracted values are unchanged; a failed run must be resolved with a successful analysis. Internal review cannot be completed without current approval and the required reviewer decisions. Existing requests receive no retroactive approval. Older saved dashboard summaries that previously indicated readiness are shown as needing coordinator review until opened and assessed under this policy.

This implements the approved aggregate sign-off decision from the closeout discussion. The external PRD still needs the corresponding policy update. Regression coverage includes persistence, actor attribution, ownership, retries, stale revisions, analysis replacement and reply invalidation in `tests/brief-approval.test.js`.

## Shared sign-in deployment (2026-11-08)

The merged `main` at `b379acf` is deployed at https://syncflow-one.vercel.app. Use `/login` from each teammate’s computer; localhost addresses remain local to that computer. Vercel’s project build command is `pnpm db:generate && pnpm build` so clean builds generate the Prisma client before TypeScript checks. Production has the existing Supabase public configuration, a server-only Supabase secret and `SYNCFLOW_APP_ORIGIN=https://syncflow-one.vercel.app`. The production callback is explicitly allowlisted in Supabase, alongside the two existing local callbacks; the Site URL uses the HTTPS deployment.

The hosted auth journey and invitation checks both passed against this deployment with disposable identities and workspaces, then removed their fixtures. These checks send no email and do not establish real confirmation-email delivery. Custom SMTP still needs a confirmed sender-domain decision and provider connection before general registration delivery is ready. Signup does not grant access to existing team requests: a verified account must accept an owner-issued invitation matching its email.

Production now has the existing server-only Claude key and model configuration. A real fictional request passed live intake, checklist review, persisted follow-up generation, reopening, same-key retry without duplicate generation, and reply-driven invalidation. The expanded hosted backend check also passed coordinator sign-off, attributed teammate review, handoff persistence, completion/reopening and scope-change invalidation. All disposable test records were removed; no email was sent. Existing API usage is billed by the model provider; no new hosting/email plan or domain was purchased.

Run `SYNCFLOW_LIVE_TEST=1 SYNCFLOW_LIVE_MODEL_TEST=1 SYNCFLOW_TEST_APP_URL=https://syncflow-one.vercel.app node scripts/check-live-backend.mjs` only when explicitly testing real model usage. It makes one workflow run (intake and follow-up), then verifies retry and reply behavior. Normal hosted persistence/review checks use `scripts/check-shared-backend.mjs` with only `SYNCFLOW_LIVE_TEST=1` and make no model calls.

Release boundary: the core coordinator backend has live acceptance evidence. General signup/recovery email delivery remains pending by owner choice; no domains were repurposed. Automatic outbound client email, durable background-job recovery, usage quotas, backup/restore drills and sustained production load/quality targets are not established by these checks. Analysis runs synchronously with bounded provider timeouts and a distributed lease; if a process dies, reopen the request and explicitly start a fresh analysis after the lease expires rather than assuming a background retry occurred.

## Coordinator usability pass

The working intake uses two panels: the conversation and the request summary. Analyze sits directly below the email input. The response editor appears only after a successful analysis, with a summary link to reach it and an explicit next step for pasting the client's reply. The catalog opens beside the recording selection. Coordinator sign-off appears after the summary only when approval is available or already recorded; internal review retains all readiness checks. The gold/glass styling and clickable Provided/Missing/Needs clarification boxes remain.

Browser checks covered blank intake, matching the example recording, filtering missing details, reopening a saved request, and inspecting the persisted draft/reply controls. No real client message, approval or reviewer decision was changed during this UI pass.

### Google account entry

`/login` and account creation show **Continue with Google** only when the configured Supabase project reports Google enabled in its public provider settings. Google OAuth uses the existing PKCE callback, preserves allowlisted workspace destinations, and routes cancellation/failure back to sign-in. Google identity does not create workspace membership: verified new users must accept an owner-issued invitation before accessing requests. The provider requests only email/profile identity, not Gmail or Drive access. The client secret belongs only in Supabase provider configuration, never in application source or public environment variables.

The separate Google Cloud project is `syncflow-514119` (SyncFlow, under `pursuit.org`); callback: `https://ajpowkglgorjqjekmqla.supabase.co/auth/v1/callback`. Basic-identity Google sign-in was verified locally with an account outside the test-user list, including the no-workspace boundary. Google branding currently displays the Supabase project hostname; custom branding verification is separate. Email/password confirmation and recovery still depend on the existing limited email sender.

Failed password-recovery resends preserve the browser's previous PKCE verifier and return intent so an earlier delivered link is not broken by a rejected request. Regression tests exercise the real Supabase SSR client with rejected and successful recovery responses.

### Fictional client-history workspace

`SYNCFLOW_SEED_TEST_HISTORY=1 node scripts/seed-client-history.mjs` creates the explicitly labelled `SyncFlow Test · Fictional Clients` workspace with eight domain-validated cases, replies, saved fixture analyses, coordinator approvals and reviewer histories. It is idempotent and checks that the original workspace request versions remain unchanged. Fixture analyses use mock providers; no emails or model calls run. The selected workspace is an HttpOnly cookie preference validated against live database membership on every server request. The dashboard selector opens only a workspace the signed-in user belongs to. Switching workspaces resets the client dashboard state.
