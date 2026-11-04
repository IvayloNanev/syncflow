# Coordinator application user stories

Initial stories for Mosiah's application and persistence work. These describe the coordinator workflow; the agent contracts remain in `contracts/` and agent output remains proposed until a coordinator acts.

## 1. Intake & Record Persistence

As a Sync Coordinator, I need incoming client requests and their message history saved in one durable record, so I can rely on a single source of truth.

Acceptance criteria:

- A request and its inbound message are saved together with stable identifiers and timestamps.
- Later messages are added to the request history without replacing earlier messages.
- A failed save does not leave a request without its corresponding initial message.

## 2. Review & Diff Workspace

As a Sync Coordinator, I need to compare each proposed field change with the current confirmed value and accept or reject it, so automated proposals never overwrite confirmed data without my approval.

Acceptance criteria:

- Each proposal shows its field, proposed value, current confirmed value, and supporting evidence when available.
- Accepting or rejecting a proposal records the coordinator's decision and attribution.
- An approval based on an outdated record version is rejected and must be reviewed against current data.
- Confirmed data changes only after an authorized coordinator accepts the proposal.

## 3. Clearance Status & Handoff Tracking

As a Sync Coordinator, I need to see real-time status and active blockers for internal legal and catalog clearances, so I can prevent requests from stalling and give accurate client updates.

Acceptance criteria:

- The request view shows the current status of internal legal and catalog clearances, active blockers, and next action.
- Status and next-action changes follow documented workflow rules and are recorded in history.
- The dashboard does not present an agent's suggestion as a confirmed status change.

## Scope mapping

These stories span the even-numbered issues assigned to Mosiah. The ownership list maps status and next-action rules to Issue #12 and dashboard/recovery to Issue #16; confirm final issue mapping with the team before expanding scope.
