# Agent-quality fixes — November 4, 2026

The original 20-case baseline, frozen cases and scores remain unchanged. These changes address its failure modes using new examples; they do not retroactively turn that evaluation into a pass.

- Intake now checks all supplied fields explicitly, including sender name/organisation without requiring an email address, and prefers original contact wording.
- Generic online/internet/digital/web alone is not treated as a specific channel. Review also catches proposals containing only these generic labels.
- Intake ambiguity records support optional issue_type: ambiguous, conflict or split_request. Legacy records remain valid and default to ambiguous. Review carries the type through rather than losing it; conflict/split signals require at least one valid source quote. This additive contract extension needs no changes to old fixture payloads, but clients should handle the new classification.
- Missing-budget questions ask for amount, currency and rights scope. Follow-up instructions require these components and avoid internal timezone/message metadata.
- Review retains every stored unresolved issue. Answered missing-field issues with sufficiently complete candidates and no conflicting/ambiguous flags are listed in coordinator_issue_ids. The workflow excludes those issues ONLY from the temporary Follow-up view and returns coordinator_review_issue_ids. No stored issue is resolved and no candidate becomes confirmed. The app must present these IDs for human confirmation, even when Follow-up is skipped.

## Verification

106 automated tests pass, including generic platforms, typed issues, evidence guards, budget scope, partial candidate budgets and already-answered issue routing. Development fixtures and the original frozen corpus still validate.

Six new fictional cases and their targeted expectations were written and SHA-256 frozen before the first live run in evaluation/fresh/quality-v1.json. Only their contexts were sent to agents. One live run per case used ten provider calls (up to twelve allowed; two Follow-up calls skipped). All targeted checks passed:

| Case | Target | Observed |
| --- | --- | --- |
| Q01 | Fully specified new request and sender | Contact retained; zero issues; no draft |
| Q02 | Generic online platform | Contact retained; asks for specific channels |
| Q03 | Explicitly incompatible exclusive territories | Typed conflict; no silent territory selection |
| Q04 | Two distinct recordings | Typed split_request; asks for separate requests |
| Q05 | Reply answers pending project issue | Stored issue preserved, routed to coordinator, no repeated client question/draft |
| Q06 | Entire budget missing | Draft asks amount, currency and master/publishing scope |

I manually inspected the six outputs/drafts for these targeted behaviors. Expected assertions are not a full semantic score and are not independently reviewed. Reproduction: `node evaluation/fresh/run.js /tmp/fresh-quality.json` (up to 12 paid calls). Raw result: evaluation/results/fresh-quality-2026-11-04.json.

The evidence guard was added after this live run and all recorded Intake payloads were revalidated against it without further calls. Prompts were not changed after seeing fresh results. No live injection suite or original benchmark was rerun after these fixes. A new partner-approved, independently authored suite and repeated live runs remain required before declaring accuracy targets met. Typed classification is still model-dependent; the system does not guarantee detection of all conflicts. The local API still lacks authentication and storage, and the browser UI is not connected.
