# Current product requirements

SyncFlow assists a music licensing coordinator with inbound requests, source-backed intake, clarification drafts, prioritization, and manager escalation. Its catalog is synthetic. It does not send mail, grant rights, infer budget authority, or record approval from an unsent draft.

The [current user stories](user-stories.md) define the shipped journey. Historical milestone issues and acceptance reports describe earlier versions; their per-field confirmation UI is superseded.

## Data authority

Agent extraction automatically populates the effective case view with provenance and exact source evidence. It does not write human-confirmed facts. A current unblocked correction can change the effective display while preserving the stored confirmed record and audit trail. Coordinators review exceptions, recording identity, drafts, and internal checks. Brief sign-off is an explicit workflow action; it does not confirm every extracted field or grant rights. Manager decisions and case completion require human commands.

## Scope

- Receive client emails or paste subject/body in New Inquiries and explicitly save a case.
- Browse pending/completed cases, inspect full correspondence, select Coordinator or Internal Review, reopen and soft-delete through explicit controls.
- Run source-backed Intake, deterministic Review, and Follow-up drafting for Coordinator. Invalidate stale results when source revision changes.
- Rank overdue, due today, upcoming, then undated cases; AI ranks within each group.
- Read full historical correspondence for Internal Review, distinguishing drafts from received messages and recorded decisions. Reject oversized context rather than claim full review of a partial history.
- Enforce workspace membership, revision checks, idempotency, and shared provider usage limits.

## Acceptance gates

- Automated domain, transport, security, and regression checks pass; malformed or unsupported output never activates.
- Frozen-key extraction precision and recall each reach 95%; issue recall reaches 90%; unmatched-flag proportion is at most 10%. Key drift is disclosed and independently adjudicated before a new benchmark version is frozen.
- No silent mutation of stored human confirmation, automatic external sending, or automatic rights approval.
- Paired human testing demonstrates at least 25% lower median preparation time including review, with collaborator acceptance recorded.
- Fresh collaborator setup and deployment verification complete; unresolved operational/security limitations remain visible.

The [current readiness report](readiness-2026-11-11.md) records which gates remain unmet. Passing software tests alone is not full product acceptance.
