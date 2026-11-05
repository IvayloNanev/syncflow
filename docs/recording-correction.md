# Saved recording corrections

The coordinator can inspect the catalog on a saved request, stage a different recording (or clear selection), provide a reason, and save the correction. Cancel discards the staged choice. Sample scenario loading is unavailable on saved requests.

Corrections retain the request ID, source conversation, confirmed client facts and historical records. The transaction checks ownership and expected revision, increments the revision, invalidates active analysis and the proposal review head, and records previous/new IDs, reason, actor and time. Handoffs, reviewer decisions and completion become outdated through their revision checks. The coordinator must reanalyze and reconfirm dependent review decisions. A recording selection never confirms catalog data as client facts.

The change_recording API requires an explicit recording_id (null clears selection), a reason and an idempotency key. Unknown IDs, same-ID changes and stale revisions are rejected. A replay does not create a second correction. An audit-write failure rolls back the entire correction.

Readiness also compares confirmed artist, title and recording version against the selected fictional catalog record. A mismatch blocks internal-review completion. Comparison normalizes case, accents and punctuation; version comparison also strips the words recording and version. This is a conservative text consistency check, not semantic matching, audio fingerprinting or rights clearance.

Validation: all 193 automated tests pass, plus ESLint and production build/TypeScript checks. Tests cover preservation, replay, stale revisions, ownership, rejected payloads, audit transaction rollback and readiness mismatch. The browser walkthrough changed a fictional saved request from instrumental to original and back, verified both audit entries, preserved its conversation and confirmed territory, and invalidated its old analysis. The intended instrumental selection was restored after the check.

This increment does not change the earlier live-agent acceptance scores or resolve hosted authentication, shared storage, backups or the remaining extraction-quality gaps. The application remains local development software.
