# Clarification routing and redundant questions — November 11, 2026

## Findings and changes

The earlier full-workflow report contained 36 unmatched issue signatures: 18 catalogue-coverage checks, 16 deadline component ambiguities, one platform classification difference, and one missing-project flag. These are conservative differences from a frozen historical key, not independently adjudicated false statements. The earlier result is preserved without rescoring.

Catalogue absence is a coordinator verification task when artist, title, and version are already supplied. Review now retains this blocking issue internally, preserves the source-backed identity in the effective view, and skips a client draft when no client information is needed. Missing identity still produces a targeted client question: for example, supplied artist/title with missing version asks for version, not all three details. A recording link is requested as helpful supporting material, not claimed mandatory or already absent.

Historical generic missing-field issues remain in the audit record. When a partial answer is present, the old generic question is routed to coordinator review and the current missing-component question reaches the client. A supplied amount and currency therefore produce a rights-scope question without repeating the full budget request.

A source-backed conflict or split request no longer also labels the same field as missing. The required-field check remains failed and the genuine conflict/split blocker remains. Exact simple campaign durations such as “six months”, supported by matching source evidence, do not generate another duration question just because Intake omitted duration_text. No value or human confirmation is changed by this check. Uncertain or unsupported duration text still blocks.

The catalogue notice formatter now moves an existing catalogue paragraph forward rather than inserting the same client question a second time. If a notice is absent, the server adds a factual notice without repeating the question.

## Policy retained

The current prototype requires deadline date, time and timezone. A date-only request still asks only for missing time/timezone; it does not ask for the date again. This differs from the original evaluation key. No timezone or deadline time is invented to silence a flag. Budget currency/scope checks, real conflicts, recording selection, catalogue verification and rights-review blockers remain required.

Review policy metadata is `review-v2`. Stored historical analyses are retained; rechecking a case applies the current rules. These changes do not automatically resolve historical issues, approve a brief, complete a case, send mail, or grant rights.

## Verification

- [Current-policy Review v3](../evaluation/review-v3/README.md): 16/16 deterministic rule cases pass; all 18 expected issue/audience signatures match. All 13 expected client-question signatures match, with no extra signatures on this set.
- [Final live workflow report](../evaluation/results/review-v3-live-final-2026-11-11.json): four synthetic Intake → Review → Follow-up workflows pass, including activation validation. Complete outside-catalogue identity produces no client draft. Partial identity, partial budget and date-only deadline produce targeted questions.
- The first live report's catalogue draft repeated a version question because the server added it before an AI paragraph that already asked it. That report is retained. The formatter correction has a dedicated regression test and final live verification.
- The earlier Review v2 draft had source/normalized-value inconsistencies. It is retained and excluded from accuracy claims; Review v3 corrects the source construction without changing expected labels to fit behavior.

This is bounded synthetic verification. It does not establish a global 0% false-discovery rate or replace the earlier full-workflow benchmark. Independent key review and broader human evaluation remain pending.
