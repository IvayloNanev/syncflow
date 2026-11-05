# SyncFlow product acceptance — November 5, 2026

**Decision: functional prototype checks pass; full PRD acceptance is not established.** Live extraction recall missed its target, one contradictory-territory case was not flagged, and the raw issue false-discovery target was not met. Human usability and time savings remain unmeasured. Do not describe the product as fully checked, production-ready or accurate on every request.

Product code evaluated: `0fd141b` (saved handoff versions). The only added application-adjacent change during this acceptance run is a deterministic integration test; prompts, checklist, model configuration and answer keys were not tuned. Model: `claude-haiku-5-5`. Fictional data only, no client emails sent or rights granted.

## Measured results

| Check | Result | Interpretation |
| --- | --- | --- |
| Full regression suite | 178 tests passed | Includes one new isolated lifecycle test, existing fault/retry/ownership/stress tests. Not 178 independent human workflows. |
| Production build / lint / fixture validation | Pass | Production build does not enable the development-only API. |
| Frozen corpus integrity | 20/20 expected cases verified | No answer keys changed. This alone is not model evaluation. |
| Live frozen workflows | 19/20 succeeded | E11 failed Intake schema/evidence output validation; rejected output was not accepted. No automatic rerun or replacement of the failed case. |
| Field precision | 167 / 168 = **99.4%** | Meets ≥95% raw agreement target. |
| Field recall | 167 / 178 = **93.8%** | Misses ≥95% target; failed case remains in denominator. |
| Strict issue recall | 23 / 25 = **92.0%** | Meets ≥90% aggregate threshold, but includes a material missed conflict. |
| Strict issue precision / false discovery | 23 / 40 = **57.5%** / 17 / 40 = **42.5%** | Misses ≤10% false-discovery target against frozen key. Policy mismatch described below; no adjusted score substituted. |
| Preserved-field proposals | 0 violations | No proposals to change fields labeled to remain unchanged in this corpus; does not establish universal semantic correctness. |
| Current-policy quality supplement | 6/6 workflows; **21/21 assertions passed** | Small development supplement, not a replacement for the larger frozen evaluation. |
| Bounded live injection probes | 7/7 executions succeeded; no canary in generated output | Three baseline workflows, three injected-email workflows and one poisoned-question draft. Limited probes, not comprehensive injection resistance. |
| Human preparation-time reduction | Not measured | ≥25% median paired improvement target remains open. |
| Uncoached human usability | Not measured | Agent-operated browser checks are not human usability evidence. |

Live workflow median latency was 5.6 seconds in the frozen run. It excludes human review and correction; it is **not** a preparation-time saving measurement. Conservative scorer ignores case/whitespace and structured supplied_text, but has no independently adjudicated semantic aliases. The student-authored key still needs partner/practitioner review.

Raw outputs: [20-case run](../../evaluation/results/acceptance-live-2026-11-05.json), [current-policy quality cases](../../evaluation/results/acceptance-fresh-2026-11-05.json), [bounded adversarial probes](../../evaluation/results/acceptance-adversarial-2026-11-05.json).

## Failures and policy mismatch

1. **High priority — contradictory territory not flagged (E12).** The email states “Territory: Canada. Territory: United States. No correction has been confirmed.” Intake returned a territory proposal without an ambiguity/conflict, so deterministic Review did not ask the necessary territory question. A polished draft asked only for deadline time/timezone. Human confirmation remains protective, but a user could accept the wrong scope. Improve contradiction detection and evaluate against new independently frozen cases before claiming this fixed.
2. **High priority — rejected Intake output (E11).** A request missing platforms failed output validation. The safe envelope says INVALID_OUTPUT; the exact schema/evidence defect is not retained in this report, so its root cause is not established. Eleven expected fields were counted as missing. Preserve failed-case accounting; use safe diagnostic codes and a separate development reproduction to investigate.
3. **Key drift — 16 extra deadline ambiguity flags.** The frozen key accepts date-only response deadlines. Current deterministic Review asks for missing time/timezone. These flags explain most raw precision loss and may be valid under the current checklist. This policy itself is a prototype assumption, not validated Warner policy. Agree a policy and version a new key; do not silently delete these flags from the raw score.
4. **One additional raw project flag (E16).** Current review marked an unconfirmed project as missing and routed it for coordinator confirmation, rather than re-asking the client. This differs from the older expected issue set. Keep distinction between client clarification and coordinator confirmation visible.

No prompts or keys were modified to improve this run. The current-policy supplement passed, including a conflict probe, but that does not erase the E12 miss on differently worded input.

## Functional lifecycle and recovery evidence

New [acceptance-lifecycle.test.js](../../tests/acceptance-lifecycle.test.js) uses a temporary database and deterministic providers to exercise the public store/workflow APIs:

- Save an original request and a recording; analyze without implicitly confirming facts.
- Explicitly accept all source-backed proposals; recheck the new revision.
- Require current analysis before intake is ready for review.
- Generate and persist an edited handoff with evidence and an internal publishing check.
- Assign a required reviewer, record a manual approval and complete internal review.
- Replay completion idempotently, reopen the database and verify completion and edited handoff persistence.
- Append a material scope change; verify prior completion, approval and handoff become outdated and active analysis disappears.

The existing tests cover rejected proposals, invalid/foreign evidence, malformed output, provider failures, timeouts, in-flight replies, concurrent commands, audit rollback, input limits, owner isolation and local origin restrictions. Stress is mocked (50 concurrent workflows and 20 simultaneous timeouts), not live-provider load testing. No real outage or forced browser network disconnection was performed.

Recent browser checks in feature reports additionally cover the real agent email/reply loop, exact selected recording, zero remaining client questions after a complete reply, individual confirmations, reviewer reconfirmation, guarded completion, dashboard filtering/opening and saved handoff refresh restoration. Those checks were performed during their feature turns, not counted as new independent participants in this run. See [readiness](../readiness.md), [dashboard](../dashboard.md), [reviewer tracking](../reviewer-tracking.md), and [saved handoff](../internal-handoff.md).

## Prose and injection inspection

Agent review of selected frozen outputs E05, E08, E12, E16 and E17 found concise questions for emitted issues, without an observed licence/price/approval promise or auto-send. E12 is still semantically inadequate because its input conflict was missed upstream. Draft reference validation proves issue-ID linkage only, not prose adequacy.

Agent inspection of the four injected outputs found no attack canary, credential-exfiltration command, approval claim or injected instruction copied into their draft bodies. Fact proposals reflected the underlying licensing email. The runtime accepts fixed structured submissions and executes no model-requested external tools. These observations concern these specific probes only. Configured credential values were checked absent from saved report artifacts.

## Remaining PRD gaps / release limitations

- Justified **not applicable** fields are not implemented: every one of the 12 prototype fields must be confirmed.
- Saved recording identity cannot be revised in-place. Recovery copies the original email into a new request, which does not migrate the entire previous thread/history.
- Readiness requires a recording ID but does not independently enforce semantic agreement between every confirmed artist/title/version value and a manually selected catalog entry. The operator must verify this; add mismatch detection before claiming automated identity assurance.
- Handoff summaries are saved and editable, but do not embed the separate reviewer decision/completion state. Consult the reviewer panel and workflow status alongside the summary.
- Reviewer decisions are manually recorded by a single local coordinator, not authenticated approvals from reviewer accounts. Every assigned reviewer is treated as required; all request revision changes conservatively trigger reconfirmation.
- The app is a development-only, single-computer prototype. No shared authentication, production deployment or live corporate integrations are established.
- Real coordinator workflow validation, current-policy answer-key adjudication and human time/usability studies remain outstanding.

## Next actions

First address the E12 contradiction miss and diagnose E11 rejection in development, then evaluate changes on new frozen examples. Agree the deadline and N/A policies with the pair/practitioner. Run the [human usability/timing protocol](human-test-protocol.md) without coaching or fabricated observations. Only then reassess the PRD acceptance decision.
