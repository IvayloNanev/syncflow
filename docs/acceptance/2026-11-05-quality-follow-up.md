# Quality follow-up: territory conflicts and rejected Intake outputs

## Outcome

The reproducible explicit-territory contradiction now has a deterministic Review safeguard. Intake guidance was clarified for explicit later corrections. Safe rejection diagnostics were added. The original E11 validation failure did not reproduce in three development calls; its exact historical cause remains unknown and it is **not claimed fixed**. Full PRD acceptance remains open.

## Changes

- Review scans for repeated distinct `Territory:` statements accompanied by an explicit unconfirmed-correction marker, or multiple mutually exclusive `only` statements. It emits a blocking territory conflict with exact source excerpts even if Intake missed it.
- Compatible territory lists and repeated labels without explicit incompatibility are not automatically treated as conflicts. An explicit later correction can supersede earlier source conflicts. This is a narrow safety net, not a complete natural-language contradiction engine.
- Intake prompt revision `intake-v1.1` explains that an explicit correction replaces earlier values for that field without needing to name each superseded country. This fixes the observed tendency to treat the corrected country as a third competing scope. Unrelated confirmed facts remain protected.
- Rejected Intake results can include static validation categories such as SCHEMA_MISMATCH or EVIDENCE_QUOTE_MISMATCH. Raw ContractError text, quotes, provider bodies and unexpected diagnostic strings are not exposed. Malformed provider JSON/tool envelopes receive safe fixed categories. Validation is not loosened and there are no automatic retries.

## Evidence and unsuccessful checks retained

1. **185 automated tests pass.** New cases cover conflicting source statements with Intake silence, compatible territories, correction supersession, exact evidence and diagnostics that cannot echo a private canary. Existing preservation, failure, injection, revision and lifecycle checks still pass. Lint and production build pass.
2. **Original E11 development reproduction: 3/3 Intake calls passed.** These calls are explicitly a diagnostic reproduction, not replacements for the failed acceptance case. No invalid field/evidence category was observed. Original rejection remains in the published frozen-run score. [Diagnostic report](../../evaluation/results/development-e11-2026-11-05.json).
3. **First new-wording development suite: 6/6 workflows succeeded; 16/18 strict assertions passed.** V04 still treated an explicit correction as a conflict, prompting the guidance change above. V05 returned platforms=[online], so Review asked for specifics as an ambiguity rather than the key's expected missing-field classification. Its strict assertion remains failed, even though the product blocked for the correct clarification. No raw result was rewritten. [First suite](../../evaluation/results/quality-fix-2026-11-05.json).
4. **Post-guidance confirmation: 4/4 workflows; 12/12 checks passed.** New wording covers unresolved Portugal/Belgium, a later Finland correction, generic online media and named channels supplied in a reply. The platform check was declared before running this suite as any platform issue, consistent with requiring clarification; it is different from the earlier strict missing-type check. This is a small targeted confirmation, not an independent global accuracy benchmark. [Confirmation suite](../../evaluation/results/quality-confirmation-2026-11-05.json).

Case JSON and hashes are saved under `evaluation/development`. The frozen 20-case corpus, original raw acceptance result and six-case current-policy supplement remain unchanged. Model remains claude-haiku-5-5. Provider credentials are never written into these reports.

## Remaining work

Do not replace the prior 93.8% recall score with these targeted pass counts. A new independently reviewed current-policy benchmark is needed to assess global precision, recall and false discovery after the changes. Continue collecting safe error categories if rejection recurs; the old INVALID_OUTPUT envelope cannot establish which schema/evidence rule originally failed. Practitioner usability/timing work and the documented N/A, identity assurance and production-scope gaps also remain open.
