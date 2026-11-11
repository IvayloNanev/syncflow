# Current coordinator workflow

Updated November 11, 2026. These are implemented product decisions, not validated user-research findings. Earlier stories requiring acceptance of every extracted field are superseded.

## 1. Receive and preserve a request

As a coordinator, I can receive or paste an email subject and body, save a case, and find it in Cases.

- Save preserves the source message with stable identifiers and timestamps.
- The confirmation identifies where to find the case; it does not send mail or approve facts.
- Replies append to the same conversation. Earlier messages remain intact.
- Cases and correspondence are scoped to authenticated workspace membership.

## 2. Review automatically extracted details and exceptions

As a coordinator, I review source-backed extracted values, resolve missing or conflicting details, and review the response draft without accepting twelve routine fields individually.

- Only validated, current-revision agent outputs contribute effective extracted values. Blocked or rejected proposals are excluded.
- Agent values remain labelled as automatically extracted and retain exact evidence.
- Human-confirmed records and decisions remain stored. A later current, unblocked correction may replace the **effective displayed value**, while remaining agent-derived; this is not a write to the human-confirmed record.
- Explicit accept/reject commands remain available to domain integrations and tests. Only authorized acceptance changes stored confirmed facts; the main UI uses exception-driven review.
- Material source changes invalidate analysis and revision-bound approvals; stale results cannot become current.

## 3. Choose the responsible agent

As a coordinator, I choose Coordinator for client clarification and routine coordination, or Internal Review for a manager decision.

- Agent assignment is exclusive and saved; opening details alone does not change ownership.
- The Coordinator opens a case using current saved analysis, or runs analysis when needed.
- Internal Review receives full saved correspondence, including unsent draft labels and recorded decisions. Oversized input fails explicitly, without truncation.
- The manager email requests a decision; its creation is not that decision. A person records the actual response and conditions.

## 4. Track and complete work

- Daily Brief: overdue → due today → upcoming → undated, with AI ordering inside each group.
- Case details show status, deadline, current responsibility, evidence and next action.
- Copying a draft never sends it or marks it sent.
- Completion is an explicit case action, separate from rights approval. Internal Review supports explicit closure without a manager decision only with acknowledgement.
- Reopening restores the case to Pending cases and shows a confirmation. Hiding details only collapses the view.
- Delete moves a case into recoverable deleted storage; it is not a hard deletion.

## Evidence

Domain regression tests cover current extraction, persistence, revision checks, routing and lifecycle behavior. See the dated readiness report for checks actually run and remaining human acceptance work.
