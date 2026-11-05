# Manual internal reviewer tracking

The single local coordinator assigns named reviewers and manually records externally received decisions, notes, timestamp and actor attribution. The four supported states are Pending, Approved, Changes requested and Declined. No notifications, invitations or permission grants occur. This does not authenticate a reviewer or grant music rights.

A separate reviewer version prevents lost concurrent edits without changing the request revision or invalidating the current analysis. Idempotent commands replay safely. Ownership checks use the existing server-owned coordinator identity. The SQLite table is added non-destructively when opening an existing store. Decision history retains prior entries.

Each decision is bound to the request revision reviewed. Any later request revision conservatively flags non-Pending decisions for reconfirmation and excludes them from current approvals; this intentionally over-flags harmless revisions rather than guessing materiality. Reconfirmation is an explicit manual action. No-reviewer state never claims review completion. Formal request readiness/completion gates are not part of this increment.

Validation: 169 automated tests passed, including reviewer assignment/replay, decision history, request isolation, invalid status, request/reviewer version conflicts, reconfirmation and API validation. Live browser verified saved assignment, persistence after reload, manual approval, and request-change warning with current approval count reduced to zero. Lint and production build passed.
