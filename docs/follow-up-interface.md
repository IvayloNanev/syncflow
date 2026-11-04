# Follow-up drafting agent

`runFollowUp(context, review, { provider, timeoutMs, getCurrentVersion })` returns a proposed, unsent email. It validates both inputs and the draft contract, requires every unresolved issue ID to be covered, and rejects invented IDs. Empty issue sets skip generation. Existing issues and confirmed fields are never mutated or resolved. Timeout, provider errors and revision failures return safe error envelopes; there are no automatic retries.

`pnpm followup:demo` runs a clearly labelled template mock against the deterministic Review of the incomplete development sample. `pnpm followup:claude` makes one live Anthropic call using the ignored local .env. Only the live command loads credentials. It sends fictional context and review and may incur API charges. No email delivery capability exists.

The Claude prompt is versioned at agents/follow-up/prompts/follow-up-v1.txt. A forced submit_follow_up tool returns data only; it never executes an action. Transport follows the existing Intake provider's fixed endpoint, authentication, timeout signal and strict parsing conventions.

Issue-ID coverage proves references, not that the prose accurately asks every question or contains no unsupported promise. Human review remains required. Raw untrusted message/issue text is marked as data in the prompt; this is not a guarantee against prompt injection. No saved-record version is checked unless a server supplies getCurrentVersion; even then an atomic revision check is required when saving. No storage, sending, approvals or rights clearance is implemented.

Validation: automated fake-transport tests and mock demo pass. No live Follow-up call or accuracy evaluation has been run yet. End-to-end orchestration with live Intake is separate work.
