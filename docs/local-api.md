# Local analysis API

Start with `pnpm api:dev`. It binds only 127.0.0.1:3001 and uses ANTHROPIC_API_KEY and ANTHROPIC_MODEL from the ignored local .env. Missing credentials prevent startup. POST requests make up to two chargeable Claude calls; there are no automatic retries or emails sent.

POST /api/analyze with Content-Type: application/json:

```json
{"email":"Your fictional client request here","timezone":"America/New_York"}
```

Only email (nonblank, max 20,000 characters) and timezone are accepted. The server generates request/run identity and revision zero; it does not trust client confirmation or approval fields. This route handles new unsaved requests only. GET /health returns local service availability, not provider readiness.

200 returns the workflow envelope with stages.intake.output.proposed_changes, stages.review.output.issues and stages.follow_up.output (or a skipped result). The app must show these as proposals requiring human review. 400 invalid input/JSON; 403 foreign origin/host; 405 wrong method; 413 body over 100KB; 415 wrong content type; 429 another analysis running; 502 workflow failure (inspect failed_stage and completed stages); 500 unexpected internal failure. Responses use no-store and safe errors. Request content is not logged.

This adapter has no login, ownership, database, reply/version history or idempotent persistence. It is NOT ready for internet exposure. No CORS access is granted to a separate frontend port; use a same-origin local development proxy to /api. Origin/host checks reduce browser cross-site misuse but are not authentication and cannot defend against other local programs. The single-process busy guard is not a production rate limiter.

Verification: 91 local tests pass, including real loopback HTTP requests with fake providers (no API charges). Existing workflow live smoke test is separate; this endpoint has not been tested with live Claude or a frontend yet. Deployment/auth/storage require a separate integration design.
