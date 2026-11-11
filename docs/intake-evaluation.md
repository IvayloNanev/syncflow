> Historical/contract reference: per-field confirmation and local-browser descriptions below are superseded for the current web UI by [current user stories](user-stories.md) and [architecture](architecture.md). Dated evaluation criteria remain unchanged for reproducible scoring.

# Intake checklist and frozen evaluation cases

Issue #3 supplies checklist `intake-v1` and 20 authored expected-answer cases. This is specification and corpus validation, not a live-agent evaluation. Mosiah must review the expected answers before the pair accepts this baseline.

## Checklist decisions

All twelve fields in `contracts/checklists/intake-v1.json` must be confirmed or explicitly waived under its rules. Waivers require a human reason; identity, project, use, media and territory cannot be waived. Budget components and relative deadlines must not be guessed. Campaign duration can be supplied without an exact start date; missing start date alone is advisory in v1. Multiple recordings must be split, not silently reduced to one.

A Review agent may examine proposed fields and flag unresolved questions, but candidate completeness does not authorize intake advancement. The application still requires coordinator confirmation, issue resolution and current-record checks. In the partial-reply answer key, the newly supplied project is no longer missing in the candidate record; its stored issue must remain unresolved until the coordinator confirms it.

## Cases

| ID | Scenario |
| --- | --- |
| E01–E04 | Complete advertising, film, game trailer and TV requests |
| E05 | No budget |
| E06 | Dollar amount with unspecified currency |
| E07 | Currency/amount supplied but rights scope unclear |
| E08 | Relative Friday deadline |
| E09 | Recording version missing |
| E10 | Territory missing |
| E11 | Online use without platforms |
| E12 | Conflicting territory; no silent selection |
| E13 | Deadline time without timezone |
| E14 | Client text attempts to force approval/sending |
| E15 | Multiple recordings require split |
| E16 | Partial reply resolves only project |
| E17 | Worldwide scope change; duration preserved |
| E18 | Contact correction is nonmaterial |
| E19 | Acknowledgement proposes no changes |
| E20 | Sparse request: no invented facts |

Each file contains original context, expected Intake/Review outputs, a representative follow-up and expected preservation/safety behavior. Follow-up wording need not match the sample literally; issue coverage and factual consistency matter. Exact message IDs and quotes are validated. Expected normalized facts are reviewed separately for semantic correctness.

## Freeze and fair use

- `fixtures/development/` is for prompt development. `evaluation/held-out/` is not.
- Do not send expected answers, issue annotations or scoring metadata to a model. A future runner should send only `context` and the required runtime instructions/checklist.
- Evaluate Intake, then Review using the actual Intake output. Do not substitute expected Intake output to inflate end-to-end performance; stage-isolated evaluation may be reported separately.
- Manifest SHA-256 values detect changes to cases and checklist. A deliberate correction requires partner review, a new manifest version and a written reason. Hashes detect accidental drift, not secrecy or cryptographic enforcement against editors.
- Since this is a public, small student-authored corpus, it is a regression/hold-out-from-prompt-development set, not an independent or secret production benchmark.
- No model score or real-world time saving is claimed by passing corpus validation.

## Scoring protocol for the later evaluation runner

Extraction precision = correct proposed field values / all proposed field values. Recall = correct expected proposed field values / all expected extractable field values. On replies, already-confirmed unchanged facts are not recall targets. Extra unchanged proposals count as unnecessary proposals, not successful recall. Proposed values must agree with previous confirmed state and original evidence.

Target precision and recall are each >=95%. Evidence IDs must exist and exact quotes must match in 100% of references. Correct reference matching alone does not establish semantic support. List order is irrelevant for platforms/territories; preserve spelling/value meaning. Use only equivalences agreed before the run; currently no additional value aliases are approved.

Blocking-issue recall = correctly identified labeled issues / all labeled issues, target >=90%. Match issues by type, field-key set and severity, not invented issue IDs or exact question wording. Deduplicate repeated predicted issue signatures. False discovery proportion = incorrect predicted flags / all predicted flags, target <=10%. No flags means undefined ratio, never an automatic pass; recall still applies.

Follow-up samples are examples, not exact-match targets. Human review checks that unresolved questions are covered without repeated confirmed questions or promises about prices/clearance. Sparse and adversarial cases must never gain approval/send capabilities.

See Issue #15 for the scoring runner and timed study. Backend acceptance tests remain separate from this message/answer corpus.

## Partner review

- [ ] Mosiah checks all 20 expected answers against the source text.
- [ ] Both agree which ambiguous fields block intake and the permitted N/A fields.
- [ ] Both approve the manifest baseline/version before prompt tuning begins.
