# Expanded scope: saved requests, internal summaries and manual approvals

Status: implementation design for the agreed expansion. Existing agents/local API are implemented; the features below are not yet built. Invoice/payment tracking remains a stretch goal. This design does not change the original frozen agent evaluation or claim its accuracy targets are met.

## User journey

1. Coordinator creates a request and pastes the initial client email. Save the original message before running analysis so it can be recovered after a failed call.
2. Intake and Review propose facts and issues against that saved revision. The coordinator can accept individual proposals, edit values, or leave them unknown. Agent outputs never update confirmed fields automatically.
3. Coordinator reviews/copies the clarification draft and sends it manually. Record a follow-up note manually; copying a draft must not mark it sent.
4. Paste a client reply into the same request. Append the original reply, retain earlier messages and confirmed facts, and analyze the latest revision. Already-supplied answers become coordinator confirmation tasks, not repeated client questions.
5. Resolve each issue explicitly after reviewing evidence. Accepting a fact does not silently resolve every related conflict. Rejecting an agent proposal does not mark its source fact as confirmed.
6. Generate an internal summary only after required fields are confirmed or validly waived and blocking issues resolved. The summary states scope, budget, evidence and any advisory unknowns; it cannot grant rights or imply legal clearance.
7. Coordinator requests a human decision from a named internal reviewer. The prototype tracks assignment without sending notifications. The reviewer records an internal approved/changes_requested/rejected decision for the specific saved revision.
8. Dashboard shows the next action: analyze reply, confirm facts, resolve issues, review summary or await internal decision. Internal approval is not a signed licence or rights clearance.

## Saved-request aggregate

| Record | Fields and invariant |
| --- | --- |
| Request | id, owner/workspace id, revision integer, created/updated server timestamps. Server derives actor/ownership; never trusts actor IDs from the client. |
| Messages | id, kind initial/reply, exact text, optional client-supplied message date, server received_at, added_by. Append-only; corrections are new messages. |
| Confirmed fields | Existing shared confirmed_field contract: value/state, evidence, confirmed_by, confirmed_at, N/A reason. Unknown stays explicit. |
| Analysis runs | run_id, base_revision, provider/model/prompt version, stage outputs, execution status and safe errors. Proposals are kept separately from confirmed fields. |
| Issues | Stable issue id, type/severity/fields/question/evidence plus lifecycle open/resolved, resolved_by/at, resolution reason and revision. Agent proposals cannot author resolution. |
| Drafts | Subject/body, referenced issue IDs, base_revision, generated/edited attribution. No automatic sent flag. |
| Summaries | summary_id, exact source_revision, confirmed input snapshot/hash, generated sections, evidence/field references, human review attribution and lifecycle current/stale. |
| Review requests | review_id, request_revision, summary_id, assigned internal reviewer, requested_by/at and state pending/decided/stale. |
| Decisions | review_id, revision, reviewer identity, decision approved/changes_requested/rejected, reason, server timestamp. Immutable audit entries. |
| Audit events | Actor, action, previous/new revision and time for every mutation. No secrets or raw provider error bodies in operational logs. |

Use existing context.schema.json as the agent input projection of the aggregate, not as the entire database record. Expose only unresolved issues and original source messages needed by the stage. Retain rejected proposals/history without presenting them as active confirmed facts.

## Confirmation and revision rules

Every mutation requires expected_revision. The server checks ownership and commits state, audit event and incremented revision atomically. A stale request returns 409 without partial writes. Analyze operations read a snapshot; before storing results, compare base_revision atomically. A stale run can remain in history but cannot become the active result.

Accepting a proposal checks its run, previous_value and exact message references against the current record. Edits also require human attribution; manually supplied facts without source evidence are clearly marked as coordinator-entered. N/A follows existing permitted-field/reason rules. No agent-authored approval or confirmation is accepted.

For the first saved-request version, **every request mutation invalidates active summaries and pending/approved review requests**. This deliberately conservative rule includes appended replies and contact corrections. A new summary and decision are required for the new revision. Old decisions remain visible in history marked stale and never authorize the current revision. Editing summary wording creates a new summary revision and also requires a fresh review request. Later material-only invalidation is a separate optimization requiring its own policy/tests.

Use client-generated idempotency keys scoped to actor/request/action for save, append-message and decision commands. Store a payload hash with the key; same key/same payload returns original result, same key/different payload returns 409. Retries cannot append duplicate replies or decisions.

## Internal summary agent (third AI agent)

Input: source revision, coordinator-confirmed values, their evidence references, explicit N/A reasons and advisory issues. Exclude unaccepted proposals, raw client instructions and credentials. Output: structured sections for recording identity, project/use, platforms/territories, term/music length, budget/rights scope, response deadline, advisory concerns and source field references. All references must resolve to the input snapshot. Unknowns must stay unknown; the agent cannot calculate prices, assert ownership/clearance, approve a deal or manufacture a contract.

A deterministic eligibility gate blocks generation on unresolved blocking issues or missing/invalid required fields. A second validation checks output shape, revision and field references. Human review remains necessary for prose correctness. Summary becomes stale when its source changes. Provider failures preserve confirmed data and allow explicit retry; no automatic retries or sending.

## Planned API commands

These are design targets, not existing endpoints. /api/analyze currently accepts new unsaved emails only.

| Command | Expected outcome |
| --- | --- |
| Create/read/list request | Authorized saved record with revision and history |
| Append message | New immutable message; analyses/summaries/approvals invalidated |
| Analyze saved revision | Version-bound proposals and issues; no confirmed-field mutation |
| Confirm/edit field | Human-attributed field change with atomic revision check |
| Resolve issue | Human reason plus revision/audit entry |
| Generate/review summary | Eligibility gate, confirmed snapshot only, revision-bound output |
| Request/record decision | Named reviewer and explicit internal decision, never agent approval |

Authentication and ownership checks must ship before exposing persisted records to multiple users. The current loopback adapter is not an authenticated shared backend. Choose the shared storage/auth stack with the UI work before implementing public persistence; do not bolt a public JSON file store onto the existing endpoint.

## Small deliverables and proposed owners

| Deliverable | Proposed owner | Acceptance conditions |
| --- | --- | --- |
| Shared persistence/auth and request CRUD | Mosiah | Two authorized accounts can access only permitted requests; unauthorized reads/writes fail; revisions and audit updates are atomic. |
| Confirm/edit/resolve commands | Ivaylo | Stale writes rejected; no automatic confirmation/resolution; human attribution and N/A rules enforced. |
| Message history and confirmation screen | Mosiah | Original emails/replies visible; candidates distinct from confirmed facts; coordinator tasks remain visible when no client draft exists. |
| Saved-revision agent integration | Ivaylo | Provider results cannot activate against a newer saved revision; failed calls preserve state; idempotent commands do not duplicate records. |
| Internal summary agent and evals | Ivaylo | Only confirmed input; unknowns/evidence preserved; blocking issues gate generation; stale results rejected; new fixtures and live semantic review pass. |
| Summary/reviewer/decision UI | Mosiah | Named reviewer can record decision; current versus stale decisions clearly distinguished; no external messages sent. |
| Approval invalidation rules | Ivaylo | Every mutation stales current summary/review; previous decisions retained; approvals can never carry forward silently. |
| Joint browser acceptance | Both | Complete flow including partial reply, stale results, denied access, duplicate submission, failed model call and revision-changing approval invalidation demonstrated. |

Owners are proposed work allocation, not GitHub assignments or evidence of either partner starting work. Existing issues should be updated/extended rather than creating duplicates when implementation starts.

## Required acceptance scenarios

- Save/reopen a request with exact original message and confirmed facts intact.
- Accept one of several proposals without confirming the others.
- Append a partial reply; preserve unrelated facts and open unanswered issues.
- Accept an answered project proposal and explicitly resolve its issue; do not ask the client twice.
- Conflicting/multiple-recording scope blocks summary generation until human handling.
- Summary cannot reference unaccepted facts or a different revision.
- Concurrent edit and model completion cannot overwrite newer state.
- Duplicate reply/decision submission with same idempotency key produces one event.
- Append any reply after internal approval: previous approval remains historical/stale, current request is unapproved.
- Denied/changes-requested decisions never appear as approval; agent prose cannot modify decision state.
- Failed summary generation leaves saved facts and history unchanged.
- Unauthorized user cannot fetch messages, summaries or decisions belonging to another workspace.

## Implementation update

The local SQLite storage foundation now implements create/read/list, append-only replies, revision checks, command idempotency, audit events and agent-context projection (see docs/request-store.md). This is a local-development adapter, not the shared authentication/persistence deliverable. Confirmation commands, saved analysis activation, summary agent and approval workflows are still planned. The storage/auth choice for shared deployment remains open.
