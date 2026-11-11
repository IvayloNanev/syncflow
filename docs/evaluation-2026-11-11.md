# Live evaluation — November 11, 2026

A new run used the existing frozen 20-case synthetic evaluation corpus and the configured `claude-haiku-5-5` provider. Historical reports and the answer key were preserved. No prompt or scoring changes were made to fit this run.

| Measure | Result | Target / conclusion |
| --- | ---: | --- |
| Field precision | 98.2% (165/168) | Meets 95% |
| Field recall | 92.7% (165/178) | Misses 95% |
| Blocking issue recall | 92.0% (23/25) | Meets 90% |
| Issue precision | 39.0% (23/59) | 61.0% unmatched-flag rate; misses ≤10% |
| Complete validated pipelines | 19/20 | One rejected intake response |
| Confirmed-data preservation violations | 0 | Pass |
| Validated follow-up drafts | 19 | Failed intake did not produce an accepted draft |

One case, E15, failed intake schema validation (`SCHEMA_MISMATCH`). Its output was rejected and manual review was required. Validation protects storage; rejection still represents a reliability failure. A prior unexplained validation failure cannot be declared solved on this evidence.

The [machine-readable result](../evaluation/results/readiness-live-2026-11-11.json) contains per-case results. Extra flags count against the frozen answer key even when newer product rules legitimately require them. The unmatched-flag rate is conservative key agreement, not independently adjudicated semantic error. Key drift needs human review and a new evaluation version; no flags were silently removed.

This is a fresh measurement, not evidence that the recall gap is closed. Do not tune prompts against the frozen held-out cases. Improvements need independently authored development examples and a separately versioned evaluation for subsequent tuning.

There was no partner-scored paired time study, usability acceptance, or production load test in this run. Those claims remain unverified.
