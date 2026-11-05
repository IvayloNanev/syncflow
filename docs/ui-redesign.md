# Coordinator workspace redesign

The existing intake, saved-request and fact-review behavior is retained while its presentation is reorganized around the coordinator's tasks.

## Information architecture

- Persistent request sidebar: start a request, refresh/open saved requests and see the selected record.
- Request: paste the initial email, save/analyze, inspect the preserved conversation and append replies.
- Recording: search the fictional catalog, compare artist/version and select before saving. Saved recording identity stays locked; unresolved identity is visible.
- Review: compare confirmed values with source-backed proposals, Accept/Reject, and distinguish client questions from internal catalog tasks.
- Follow-up: edit/copy the current unsent clarification draft, with a clear empty/outdated state.

The working context and status remain visible while moving between stages. Switching stages does not reset the composed email, reply or draft. Request mutations still use the existing server commands, idempotency keys, source revisions and coordinator decision rules.

## Design constraints

Use real saved data and derived counts only. Catalog entries remain fictional. No automatic sending, approval claims, invented activity or placeholder navigation to unbuilt features. Keep the local single-operator limit visible without overwhelming the main task. Agent-proposed values and confirmed facts must stay visually distinct.

No backend schema, agent prompt, model credential or database changes are part of the redesign. The raw SQLite request store remains the app's sole writer.

## Validation

- 160 automated regression tests passed; production build, lint and TypeScript passed.
- Live browser: pasted a fictional email, selected TRACK-0002, saved and analyzed it. The workflow returned nine proposals, three client questions and one catalog blocker.
- Edited draft subject survived stage navigation; Copy draft included the edited subject.
- Accepting Canada persisted revision 1 and invalidated the old checklist/draft. Follow-up correctly displayed a fresh-analysis requirement.
- Mobile layout checked at 390 × 844 with document width equal to viewport width; desktop checked at the default viewport. Temporary viewport override reset.
- No browser console errors observed during this walkthrough.

These checks cover the redesigned prototype workflow, not production readiness or model accuracy across all possible emails.

## PRD-style email-to-record intake

The Request screen now keeps the email beside a fixed 12-field record matching the PRD intake checklist. Clicking **Fill request from email** saves the request and runs the existing real agent pipeline, then stays on Request so the populated boxes are immediately visible. Each box shows its proposed/confirmed/missing state and expandable exact source evidence. Field questions remain visible even when a partially specified value exists (for example, a deadline date without time or timezone).

Empty boxes are visible before analysis, show Reading email while processing, and become Unknown—ask client only after a current successful analysis. Rejected proposals do not populate the record. Old proposals after a decision remain labeled as previous analysis, and replies remove obsolete proposals. Confirmation still uses the existing Review screen; no automatic fact confirmation, invented values or new model calls on typing.

Validation: live fictional Trailbound email filled all 12 fields with evidence and flagged the absent deadline time/timezone. Lint and production build passed; all 160 regression tests passed (HTTP tests require a local listener outside the restricted sandbox).

## Simplified paste → preview → Analyze → draft flow

Pasting an email immediately runs conservative local catalog matching and presence checks beside the email. A single exact catalog candidate is selected automatically for saving; ambiguous versions, conflicting IDs and multiple recordings remain unresolved and offer catalog browsing. The preview is explicitly provisional: its pattern checks are not semantic extraction and can miss paraphrases, conflicts or incomplete dates. No provider call runs on each keystroke. Analyze runs the existing validated agent workflow, then automatically opens the editable follow-up email. Detailed extracted fields remain available under a disclosure and human fact decisions remain in Review.

Live verification: an Alex Demo email instantly matched TRACK-0002 and listed project, platforms, music length and response deadline as likely missing. One Analyze click saved that recording, extracted eight proposals and automatically opened a real agent-generated email asking those four questions. No message was sent. Added regression cases for exact match, missing version, conflicting ID/version, multiple IDs, invalid IDs and empty/adversarial text.

## UX audit corrections: one request workspace

Replaces the four numbered stages with one workspace. The email and generated next-step draft occupy the left column; one recording card, current client questions, internal checks and explicitly labeled fact counts occupy a sticky right summary. Catalog inspection is contextual and fact confirmation has one expandable location with source evidence and changed-value comparisons. No duplicate detailed-field screen is rendered.

Before analysis, provisional hints inspect the full saved conversation. After analysis, current validated questions replace those hints; a reply or decision hides obsolete questions and drafts until refreshed. Explicitly clearing a provisional recording now suppresses the automatic match. An unresolved match requires acknowledgement before the record is created; saved unresolved identity has a copy-original-email recovery action, preserving the old record/history. Recording reassignment on a saved record remains out of scope.

Acceptance checks: saved fictional request showed four client questions, one internal check and eight facts awaiting confirmation alongside the draft; appended reply invalidated and hid the old draft/questions. Regression suite: 163 passed. Production build, TypeScript and lint passed. Real-practitioner usability testing remains outstanding; browser verification does not substitute for it.

Reply walkthrough completed: after supplying project, platforms, music length and a full response deadline, refreshed analysis showed zero client questions, one internal publishing check, twelve facts awaiting confirmation and no unnecessary clarification draft. Expanded the single fact review location to verify proposal values and evidence controls. Responsive check at 390px showed document width equal to viewport width; temporary overrides were reset.

## Visual email detail coverage

“What needs attention?” now shows a twelve-segment detail coverage bar, explicit counts and value rows for Provided, Missing/Not detected and Needs clarification. Each status has text and an icon as well as color. Immediate preview shows only detected excerpts (not inferred catalog facts) and labels absence as Not detected. Current agent outputs and confirmed facts drive the view after analysis; partially supplied fields with client questions become Needs clarification. Counts describe information coverage, not model confidence or licensing readiness. Internal checks remain separate.

Verified the Alex Chen email before analysis: eight provided values and four not-detected details, with artist, recording version, territory, term and budget visible. Added an extraction regression case; suite now has 164 passing tests.
