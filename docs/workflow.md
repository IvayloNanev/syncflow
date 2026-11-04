# Connected agent workflow

`runWorkflow(context, { intakeProvider, followUpProvider, timeoutMs, getCurrentVersion })` runs Intake → deterministic Review → Follow-up sequentially. Every stage uses the same copied context and revision. Candidate facts are reviewed without becoming confirmed facts. Failures stop subsequent work and retain validated stage results for inspection. No automatic retries, writes, approval or sending occur.

- `pnpm workflow:demo`: fictional incomplete fixture → rule Review → template draft. No network.
- `pnpm workflow:claude`: same fictional request with live Claude Intake and Follow-up. Uses ignored local .env; up to two chargeable calls.
- `node agents/workflow/cli.js --provider claude --scenario incomplete --context path.json`: custom context matching contracts/context.schema.json. Context is sent to Anthropic. Mock mode refuses unfamiliar Intake data.

The CLI prints all stage envelopes as JSON. Success means execution and validation succeeded, never rights clearance or readiness. `draft_ready_for_review` requires coordinator review; no-issue cases skip Follow-up and still return `review_required`, because unresolved semantic checks may remain unknown. Timeout is per provider stage (up to 30 seconds each), not a whole-workflow deadline.

Without getCurrentVersion, freshness is not_checked. With it, Intake and generated Follow-up each verify their base revision; persistence still needs an atomic revision guard. There is no database, auth, UI, retry endpoint, run persistence or idempotent save implementation here.

Verification on November 4, 2026: 84 local tests pass; all development contracts and 20 held-out expected-case integrity checks pass (not model accuracy). One fictional live workflow passed: eight Intake proposals, ten Review issues including overlapping ambiguity questions, and an unsent Claude draft referencing all issues. Manual inspection found an unnecessary recording-version clarification despite the original recording being supplied. Issue-ID coverage validates references, not semantic quality; prompt/ambiguity evaluation and question deduplication remain needed. No production accuracy claim.
