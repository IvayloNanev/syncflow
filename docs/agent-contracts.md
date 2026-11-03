# Agent handoff contracts v1

Issue #1 establishes the shared boundary between Ivaylo's agents and Mosiah's application. It does not implement model calls, storage, approvals, authentication, or the complete state machine.

## How to use

```js
import { validateContract } from '../contracts/validate.js';

validateContract('context', context);
const proposal = validateContract('intake', modelOutput, context);
// Return proposal to the coordinator UI; do not write confirmed fields here.
```

The JSON Schemas use draft-07. Register `shared.schema.json` (ID `urn:syncflow:shared:1.0`) in your JSON Schema implementation before compiling the four entrypoint schemas. The executable JavaScript adapter uses Ajv plus context/reference checks. No runtime framework or model provider is selected by this package.

| Stage | Input | Output schema |
| --- | --- | --- |
| Intake | `context` with immutable messages, confirmed state and checklist version | `intake.schema.json` |
| Review | Same context, original messages, validated Intake output and deterministic checklist results | `review.schema.json` |
| Follow-up | Same context, coordinator-confirmed context and validated unresolved issues; proposals labeled tentative | `follow_up.schema.json` |

All outputs include `schema_version`, `run_id` and `base_record_version`. Every object rejects unknown properties. There is no approval, send, confirmed-write, or status-update capability in an agent response. Capabilities must also be excluded from the runtime, not just the schema.

## Field conventions

Twelve keys are shared with the UI: client_contact, project, artist, track_title, recording_version, intended_use, platforms, territories, campaign_term, music_length, budget, response_deadline.

- Platforms/territories are nonempty arrays; worldwide is explicit.
- Monetary amounts are decimal strings; no floating-point currency conversion. Currency is an explicit three-letter code or null; unsupported/ambiguous currency needs review.
- Dates retain supplied text. Normalized dates must be real calendar dates; timezone is null unless supported by the message. Calendar validation does not prove a model normalized the text correctly.
- Campaign duration may exist without a supplied start date. Start/end dates remain null rather than invented.
- Unknown field: null value, no confirmation, no waiver or source evidence.
- Confirmed field: typed value and human confirmation attribution. Empty evidence can represent a manual entry; application history must distinguish that from source-backed extraction.
- N/A: null value, allowed checklist key, nonblank coordinator reason and attribution. Contact/project/recording identity/use/platforms/territories cannot be waived.
- Development IDs are readable opaque strings. The application will generate UUIDs; agents copy received IDs and never invent them.

## Evidence and updates

Proposed facts require at least one exact source quote from a message in the current context. Review issues about missing information can have empty evidence. Quote matching is case-sensitive substring matching against immutable message text.

Validation rejects nonexistent sources, invented quotes, duplicated IDs/field changes, a mismatched run ID, a stale base version, or a previous value that disagrees with confirmed state. Validation never mutates context. In a partial reply, propose only changed fields; unchanged fields remain in confirmed state.

Matching a quote is not proof of semantic correctness. For example, quoting “Canada” while proposing “worldwide” needs semantic review/evaluation even if the quote exists. Similarly, structure alone cannot prove a draft asks all the right questions or contains no unsupported commercial promises. Those checks belong to the Review stage, coordinator confirmation and evaluation suite.

`follow_up: null` in fixtures means skip drafting when there are no unresolved questions; null is not a valid model response. Otherwise `addressed_issue_ids` must refer to unresolved issues in the supplied context or validated review. After confirmation changes a record, create a fresh context/run and regenerate or explicitly review a draft against the latest version. The application owns issue resolution and must not pass resolved issues as unresolved.

## Fixtures

`fixtures/development/` contains three fabricated examples, each with context and expected stage outputs:

1. **complete:** every v1 checklist field supplied, no Follow-up output. No inferred start date.
2. **incomplete:** project, platforms, campaign term and music length missing; four blocking questions.
3. **partial-reply:** confirmed Canada/three-month campaign, then “Actually worldwide; duration unchanged.” Only territory is proposed; duration remains confirmed.

These are development examples, not the 20 held-out evaluation cases in Issue #3. Fixture outputs were authored as expected answers; passing them does not establish model accuracy.

## Application integration responsibilities

- Obtain trusted context and authenticated confirmation identity server-side; do not trust browser-supplied identity/version.
- Re-read persisted record_version when accepting a proposal. Adapter checks alone cannot prevent a race after validation.
- Maintain review_revision separately and invalidate all required approvals after a material change.
- Commit confirmed changes and history atomically with idempotency keys.
- Validate deterministic required fields/conflicts before completion; an agent's `checks: pass` is not authoritative.
- Preserve confirmed records on model failure, invalid outputs and rejected proposals.

## Partner review checklist

- [ ] Mosiah agrees field names/types and can render the three fixtures.
- [ ] Mosiah can validate an output and display `ContractError.errors` without exposing secrets.
- [ ] Both agree the application, not agents, performs confirmation, persistence and review transitions.

Issue #1 remains open until partner review. Future breaking changes need a schema version bump and updated fixtures/tests.
