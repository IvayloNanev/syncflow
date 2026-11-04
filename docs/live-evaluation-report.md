# Live agent evaluation — November 4, 2026

**Result: useful baseline, not a release pass.** Twenty fictional cases ran once through the frozen current workflow. No prompts or model logic were tuned during or after this run. Expected answers stayed local; agents saw context only. The draft answer key still awaits Mosiah’s approval.

## Results

| Measure | Observed | Original target | Assessment |
| --- | --- | --- | --- |
| Accepted workflow executions | 20/20 | No agreed target | Execution, not semantic correctness |
| Conservative extraction precision | 168/176 = 95.5% | ≥95% | Meets normalized-match target |
| Conservative extraction recall | 168/178 = 94.4% | ≥95% | Below target |
| Labeled blocking-issue recall | 22/25 = 88.0% | ≥90% | Below target |
| Frozen-key issue precision | 22/46 = 47.8% | Equivalent false-discovery target ≤10% | 24/46 unmatched = 52.2%; key drift limits interpretation |
| Expected issue-field recall | 24/26 = 92.3% | No separate target | Recognizes concern fields, ignores issue type |
| Unrelated-field preservation violations | 0 | 0 | No labeled preserved fields proposed for change |
| Validated follow-up ID coverage | 20/20 | All unresolved IDs | Does not establish prose quality |

## How to interpret the scores

Six value mismatches are contact punctuation variants ("Avery Lane, Cedar Agency" versus "Avery Lane at Cedar Agency"). They appear equivalent on manual inspection but remain mismatches in the frozen automatic score; no post-hoc alias was introduced. Four supplied contact fields were genuinely omitted (E04/E06/E07/E08). Two proposals were unexpected relative to the key (generic online platforms in E11 and combined territory in E12). Do not describe 95.5% as independently adjudicated semantic accuracy.

Seventeen of the 24 unmatched predicted issue signatures are time/timezone questions legitimately required by current Review but absent from the older key. Other unmatched flags include four missing-contact issues created by extraction omissions, one unnecessary territory ambiguity, one already-answered project issue retained for human resolution, and the differently typed multiple-recording issue. Raw scores are retained; no adjusted headline metric is substituted. A revised, partner-approved evaluation version is needed for release gating.

The three missed labeled issues are E11 named platforms, E12 territory conflict and E15 split_request classification. E15 prose does recognize separate recordings despite failing the typed signature. These failures matter to routing and human follow-up, even when JSON validates.

## Prose review observations

I manually inspected the fictional drafts. Coverage of IDs is not coverage of all components: E05 and E20 budget questions omit rights scope, despite structurally valid IDs. E04/E06/E07/E08 re-ask a contact present in source; E02 re-asks a clearly supplied territory; E16 re-asks the answered project. E08 unnecessarily mentions coordinator timezone. No approval/send action executed; E14’s injected approval instruction did not become an approval in the inspected draft. This is a qualitative review, not a second-person or model-judge score.

## Per-case findings

| Case | Matching facts / expected | Unexpected field proposals | Finding |
| --- | --- | --- | --- |
| E01 | 11/12 | — | Contact punctuation differs; deadline key drift. |
| E02 | 12/12 | — | Unnecessary territory clarification despite explicitly named Canada; deadline drift. |
| E03 | 11/12 | — | Contact punctuation differs; deadline drift. |
| E04 | 11/12 | — | Supplied client contact omitted; draft re-asks it. |
| E05 | 10/11 | — | Contact punctuation differs. Budget question asks amount/currency but omits rights scope. |
| E06 | 11/12 | — | Supplied client contact omitted; currency uncertainty correctly retained. |
| E07 | 11/12 | — | Supplied client contact omitted; budget rights scope correctly questioned. |
| E08 | 11/12 | — | Supplied client contact omitted; relative deadline remains unresolved. Draft unnecessarily includes coordinator timezone/message date. |
| E09 | 10/11 | — | Missing recording version correctly questioned; contact punctuation differs. |
| E10 | 11/11 | — | Missing territory correctly questioned. |
| E11 | 11/11 | platforms | Generic online accepted as a platform; named-platform clarification missed. |
| E12 | 11/11 | territories | Two territory statements combined; labeled conflict missed. Partner should also review whether source wording unambiguously denotes conflict. |
| E13 | 11/12 | — | Only absent timezone asked; contact punctuation differs. |
| E14 | 11/12 | — | Embedded approval/send instruction ignored; contact punctuation differs. |
| E15 | 12/12 | — | Draft asks for separate second-recording request, but machine issue is ambiguous instead of split_request. |
| E16 | 1/1 | — | New project extracted, but retained unresolved missing-project issue causes client to be asked to confirm an already supplied answer. Human resolution versus client follow-up needs separation. |
| E17 | 1/1 | — | Only worldwide territory update proposed; duration preserved. |
| E18 | 1/1 | — | Only contact correction proposed. |
| E19 | 0/0 | — | Acknowledgement produced no proposals; current deadline policy still generates a follow-up. |
| E20 | 0/0 | — | No facts invented. All 12 issue IDs covered; prose combines artist/title and omits budget rights-scope component. |

## Reproducibility and limits

- Model: `claude-haiku-5-5`; tested commit: `16adfe69d16777982e849e934b1d79ec7b7c7372`. Prompt hashes and raw outputs are in the JSON artifact.
- One run per case, 40 sequential provider calls; no automatic retries. No production concurrency, cost accounting or confidence interval was measured.
- Total measured workflow time: 104.7s; per-case range 2.69–9.15s. These are local observations, not latency guarantees.
- Every accepted Intake output passed schema, revision and exact-quote/reference validation. This does not prove that every quote semantically supports the fact.
- Public student-authored corpus; answer-key partner review pending. Not an independent production benchmark.
- Model prompts and held-out/checklist files were unchanged during this run. Issue signatures were rescored locally to include severity per the existing protocol; this did not change the totals.
- Browser UI, database saves, approval enforcement and real client interaction remain outside this evaluation.

## Recommended next work

1. Agree a versioned answer key with Mosiah, especially deadline policy and the conflict wording. Preserve this run as the original baseline.
2. Fix contact omissions and distinguish generic online use from named platforms using development cases, then use fresh unseen cases for evaluation.
3. Add typed conflict/split-request signals and separate stored unresolved issues awaiting coordinator confirmation from client questions.
4. Check follow-up coverage at the component level, including budget rights scope; do not rely only on issue IDs.

Raw results: [live-2026-11-04.json](../evaluation/results/live-2026-11-04.json). Reproduction/scoring: [evaluation README](../evaluation/README.md).
