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
