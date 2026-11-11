# Review v3 — current-policy rule verification

Sixteen synthetic cases declare issue type, fields and audience before evaluation. Cases cover complete briefs, missing components, date-only deadlines, catalogue coverage versus missing identity, prior unanswered issues, contradictory territories, separate recordings, and exact source durations with omitted normalization.

The inputs, Intake outputs and expected issue labels are bound by `cases.sha256`. Source construction was corrected from an invalid earlier draft (`../review-v2/`), which remains retained and excluded from accuracy claims. Missing fields are absent from the source; changed budget/deadline components replace their old source statements. The source-duration case intentionally retains an exact duration whose normalized component was omitted, testing the source-backed safeguard.

Run without model calls:

```sh
node evaluation/review-v3/run.js evaluation/results/review-v3-new-run.json
```

The scorer separately reports client questions and all audiences, including internal blockers. Duplicated signatures fail the case. No internal issue disappears merely to improve client precision. This measures deterministic Review on supplied, validated Intake outputs. It does not measure Intake recall, model-generated ambiguity quality, draft prose, or real-world false discovery. The key is author-scored; partner review is pending. Do not edit the key to fit an output.

Four selected cases can be run through live Intake → Review → Follow-up, at most eight paid calls without retries:

```sh
node evaluation/review-v3/run-live.js evaluation/results/review-v3-live-new-run.json
```

Only context reaches the agents. Labels remain in the scorer. The runner also validates the successful analysis with the activation validator. Prose still needs human inspection: addressed issue IDs do not prove that the body asks each question exactly once.
