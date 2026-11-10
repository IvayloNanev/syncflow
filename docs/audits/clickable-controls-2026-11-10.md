# Clickable control audit — November 10, 2026

Scope: source audit of every page under `app/` and shared interactive components under `components/`. The pulse is defined once in the root stylesheet, loaded by the root layout, so new controls inherit it too.

| Surface | Covered controls |
| --- | --- |
| Landing | Login, Sign-up, workspace entry and home links |
| Authentication | Sign in, account creation, Google entry, recovery and confirmation actions, navigation links |
| Workspace | Refresh with AI, filters, client cards, history, retry and case destinations |
| New Inquiries | Received-email selection, receiving-address disclosure and copy, Save as a case, confirmation Dismiss |
| Cases | Status filters, case titles, agent destinations, details actions |
| Case glass panel | Hide details, saved-fact disclosure, Close case, Reopen Case, Delete case |
| Coordinator | Recording selection, analysis, drafts, copy, reply, completion, evidence disclosures, manager handoff |
| Internal Review | Assessment, copy draft, save manager decision, Coordinator handoff, completion and disclosures |
| Customer request | Request submission and navigation |
| Invitations / no-access | Available invitation, account and navigation actions |
| Shared chrome | Workspace, New Inquiries, Cases, Sign out, home and workspace switching |
| Redirect-only routes | Completed cases and Team use the destination page's controls |

Enabled native buttons, links with destinations, disclosure summaries, button roles, and button-type inputs receive a gentle repeating gold glow. Hover and keyboard focus increase the glow. No sizing, positioning, click handler, destination, or saved state changes.

Disabled, aria-disabled, aria-busy and explicitly inert controls do not receive the pulse. Text-entry fields, checkboxes and selectors retain their existing form affordances. Existing visible focus outlines remain. The pulse only runs when `prefers-reduced-motion: no-preference`; reduced-motion users retain static controls.

The source scan found action handlers on native controls rather than clickable generic containers. The shared selectors also cover dialog controls outside the regular page panels. This document records source coverage, not a claim that every authenticated state was exercised live.

Completion actions use the filled gold primary-button style so they are visibly actionable even between pulse cycles. Reopen retains the secondary style; disabled completion still uses native disabled semantics and muted opacity.

Palette follow-up: removed 421 green-dominant color values across 13 stylesheet/component files. Backgrounds, fields, cards, muted text, borders and shadows use neutral tones; positive-state accents use gold. Glass surfaces retain blur and transparency. Source scan found no remaining green-dominant hex colors in app/components CSS or TSX.
