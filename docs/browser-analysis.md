# Browser analysis workspace

> Current integration: the local browser now saves/reopens requests and analyses through `/api/requests` and the RequestStore adapter. See [saved browser requests](saved-browser-requests.md). Earlier unsaved/unconnected limitations below describe the original deliverable. Prisma integration, authentication and human confirmation remain unfinished.


Run `pnpm dev` and open http://127.0.0.1:3000. The development server binds to loopback. Keep existing Claude credentials in the ignored local .env; never use NEXT_PUBLIC_ for credentials. No second server on port 3001 is needed for this screen.

The coordinator can paste an email or load a clearly fictional example, enter a timezone, and analyze. The screen POSTs email/timezone to the same-origin Next.js /api/analyze route, which reuses analyzeEmail and the existing Intake → Review → Follow-up workflow. Each submitted valid request may use up to two paid Claude calls. There is no implicit mock fallback and no automatic retry.

Results show unconfirmed proposed values with expandable exact source quotes, issues with type/severity, and an editable subject/body. Copy draft writes only to the user's clipboard when selected; it does not send email. Draft edits live in component memory and are lost on refresh. Editing input clears previous results so a different email is not displayed beside stale analysis.

Submission disables inputs and duplicate clicks; a server busy guard rejects overlapping requests within that process. Errors retain the source email. Browser timeout is 70 seconds; the server may finish an interrupted request, so retry is explicit and may incur more charges. No live progress streaming or server cancellation is claimed.

## Local-only route boundary

The new Next.js route is enabled only in development and rejects non-loopback Host/URL values and foreign browser Origins. Next.js may normalize its internal URL to localhost; the guard compares Origin to the validated loopback Host. JSON and 100KB body limits are enforced before model use; analyzeEmail separately enforces email length/timezone. No CORS access is granted to other origins. This is not user authentication or a production rate limiter. Production builds succeed but the analysis route returns 503 at runtime until an authenticated deployment design exists.

No database is used by this screen. Both local storage adapters remain separate; there is no request creation, saved-analysis activation, fact confirmation, issue resolution, summary generation or approval in this UI. The presence of the separate SQLite modules is not saved-request integration.

## Bundling fix

The CLI's dynamic filesystem schema loading failed when bundled into Next.js. Contract schemas, provider output schemas and the checklist now use static JSON imports, supported by our Node 24+ baseline. The same validators/providers continue to work in terminal tests. The JSON contract contents and frozen evaluation cases are unchanged. Prompts remain server-only. Next generated AGENTS.md is included with its local documentation guidance.

## Verification — November 4, 2026

| Boundary | Evidence |
| --- | --- |
| UI renders | Browser shows the email form, fictional example button and explicit unsaved state. |
| Input failure | Invalid timezone returned 400; UI displayed the error and kept the email. |
| Corrected retry | Correcting timezone and submitting made a live server call; server logged POST /api/analyze 200. |
| API to live agents | Fictional request completed live Intake, deterministic Review and live Follow-up; no mock fallback. |
| Response to UI | Eight proposed facts, five issues and a complete five-question draft rendered. |
| Evidence/editor | Source quote expanded; draft subject edit remained visible with facts/issues intact. |

129 automated tests pass, including bridge validation, foreign-origin/disabled-deployment rejection, body limits, overlap handling and Next's normalized-loopback URL regression. Lint, TypeScript, optimized production build, fixture contracts and frozen corpus integrity pass. The one live browser workflow made two Claude calls. Initial integration defects (schema bundling and loopback Host normalization) were fixed before the successful run.

Clipboard permissions, browser timeout, provider-auth failure and mobile layout were not exercised manually in this browser run. Provider-error safety is covered by automated tests. No database persistence, login, deployment or broader model-accuracy evaluation was performed for this UI change.
