# Deterministic Review step

`runReview(context, intake)` consumes the same immutable context and a validated Intake payload. It checks candidate values without accepting or saving them. Existing confirmed fields remain available for partial replies; proposed values overlay them only in the temporary review view.

Run `pnpm review:demo` for a fictional incomplete request. It reports four absent fields (project, platforms, campaign term, music length) plus an incomplete deadline (time and timezone). This deliberately improves on the older authored fixture review, which checked field presence only.

Budget amount, currency and rights scope are checked independently. Campaign duration alone is sufficient; the missing start date does not block. Allowed human-attributed N/A values pass presence checks. All existing unresolved issues remain open, even when a reply supplies candidate answers: resolution requires a human workflow still to be built.

Intake ambiguity reasons become blocking questions. The rules do not independently interpret raw emails or prove that the extractor found every conflict or recording. Single-recording and conflict-free checks remain unknown without affirmative evidence. `evidence_valid` means quote/reference validation, not semantic truth. A successful Review envelope means the checks ran, never that a licence is approved or the request is ready.

The output follows `contracts/review.schema.json`. Invalid context/Intake returns a safe failure. Freshness remains not_checked: a future server must enforce the current revision before persisting or using results. No provider calls, storage, issue resolution, rights clearance or sending are included.
