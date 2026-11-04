# Live frozen-corpus evaluation

```
node evaluation/run-live.js evaluation/results/run-name.json
```

Requires local Claude credentials. Maximum 40 paid calls, sequentially, with existing per-stage timeouts and no automatic retries. The corpus/checklist hashes are verified before any call. Only case context enters the workflow: expected proposals, labels and answers stay in the scorer. Failed cases stay in the denominator. Do not tune prompts against this run; create a new evaluation version and new unseen cases for future improvement work.

The report records commit, model, prompt hashes, timestamps, per-case latency, all validated stage results and scores. Inputs/outputs here are fictional; do not use private client requests in public reports. Credential values are never included.

Metrics: matched field values / proposed values (precision) and expected values (recall). Strings ignore case/repeated whitespace, arrays ignore order, structured objects ignore supplied_text but compare normalized components. No synonyms or contact punctuation aliases are automatically accepted; disagreements need human adjudication. Unexpected/missing/wrong values are listed individually. These conservative agreement scores are not independently reviewed semantic accuracy.

Issue matching uses deduplicated severity/type/field-set signatures, not generated IDs or wording. Field-only recall is also reported to distinguish recognizing a concern from correctly classifying it. Extra flags count against frozen-key precision even if current product rules legitimately require them. All key drift must be disclosed, never silently removed to improve scores.

Follow-up reference coverage is checked by the runtime harness; it does not prove the draft's wording covers every question or avoids extra questions. Human prose review is reported separately. Preservation violations count proposals to change fields labeled must_preserve_fields. They do not imply any stored state was modified.

See docs/intake-evaluation.md for original targets. The answer key is a public student-authored draft awaiting partner approval, not a secret independent benchmark. Complete-presence cases generally have date-only deadlines; newer Review code requires time/timezone. Retain the raw frozen-key results and document this policy mismatch.
