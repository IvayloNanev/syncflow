# Intake recall and validation — November 11, 2026

## What changed

Intake now uses strict provider output with compact typed groups, then decodes into the unchanged local business contract. The server supplies proposal identifiers and previous values from the validated snapshot; these are not extraction tasks and no longer need to be repeated by AI. Missing optional structured components become null, never inferred facts. Proposed values and evidence still come from the model and must pass local validation.

New ambiguity output must specify ambiguous, conflict, or split_request. Historical stored outputs remain readable under the existing business contract. Local validation still rejects unsupported types, malformed dates, invalid currencies, duplicate fields, forged metadata, nonexistent message IDs, invented quotes, stale run IDs and stale revisions. There are no automatic retries or weakened evidence checks. Hosted provider usage limits still apply to each attempt.

The prompt is versioned as `intake-v1.3`; transport is `strict-groups-v1`. Provider IDs and live reports record the new version. The earlier prompt and historical result files remain unchanged.

## Why

The earlier 20-case report's 13 unmatched field values included twelve fields lost when one entire intake response failed schema validation. The thirteenth was the conservative comparison of “cinema screenings” with “cinema”. The original rejected response was not retained, so its exact schema violation cannot be reconstructed; it would be inaccurate to assert a specific malformed field as its cause.

The previous provider tool supplied a schema without strict generation. Simply enabling strict mode failed: the existing union schema exceeded the provider's union/grammar limits. Compact typed groups, reused evidence definitions, and optional structured components produced an accepted strict schema. Unsupported generation bounds stay in descriptions and remain enforced locally. [Anthropic's strict tool documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use) and [schema limitations](https://platform.claude.com/docs/en/build-with-claude/structured-outputs#json-schema-limitations) describe these constraints.

## Measured results

| Run | Fields matched | Precision | Recall | Validated responses |
| --- | ---: | ---: | ---: | ---: |
| New frozen Intake v2, 12 cases | 119/121 expected | 99.2% (119/120 proposed) | 98.3% | 12/12 |
| Final development probes, 6 cases | 33/34 expected | 97.1% | 97.1% | 6/6 |

The new Intake v2 set clears the 95% field precision/recall targets on that set. It is a separately versioned, synthetic, author-scored key awaiting partner review, not an independent production accuracy guarantee. It is a different corpus from the earlier 20-case run; these are not directly paired improvement percentages. The old 92.7% recall report is not replaced or rescored.

Two misses remain in v2 case V207: the instrumental version was omitted, and a supplied duration was preserved in supplied_text but omitted from duration_text. A similar duration-component miss occurred in one final development probe. They remain in the denominator and are not repaired in the scorer. No prompt tuning was performed against v2 results.

Final development checks passed conflict classification, refusing to select a conflicting territory, explicit correction handling, multiple-recording splitting, and ignoring a malicious instruction to invent a budget. This is bounded evidence, not comprehensive adversarial coverage.

## Reproduce and inspect

- [Frozen Intake v2 inputs and policy](../evaluation/intake-v2/README.md)
- [Intake v2 raw report](../evaluation/results/intake-v2-2026-11-11.json)
- [Final development raw report](../evaluation/results/intake-reliability-final-2026-11-11.json)
- [Earlier full workflow report](evaluation-2026-11-11.md)

Reports include input/key hash, prompt hash, exact tool-schema hash, model, transport version, per-case outputs and scores. Earlier strict-schema compilation probes are retained under evaluation/results/development; those rejected requests are configuration experiments, not accuracy benchmarks. An earlier development pass omitted conflict classification; making that field mandatory corrected the transport contract and the final conflict check passed.

351 automated tests, lint, TypeScript, and production build pass. Development fixtures, corpus integrity and mock journey smoke checks are verified separately. These changes are local; deployment has not been performed and no saved case was changed by the probes.
