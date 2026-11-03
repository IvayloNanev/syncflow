# Callable Intake interface (pre-live integration)

This increment prepares Issue #5's application boundary. It is not a live Intake agent and does not complete that issue. No model SDK, API key, endpoint, authentication or database is included.

## Try it

```sh
pnpm intake:demo
node agents/intake/cli.js --provider mock --scenario complete
node agents/intake/cli.js --provider mock --scenario partial-reply
```

The CLI prints `MOCK ONLY` to stderr and a result envelope with `mode: "mock"` to stdout. Success exits 0, analysis/validation failure exits 1, and usage/JSON-file failure exits 2. `--help` prints usage. To pass an app-shaped context, use `--context context.json` (the context object alone, not an entire fixture). Timeout is configurable from 1 to 30000 ms.

The mock is a fixed development-fixture replay, not a text parser or model. It accepts only the selected scenario's exact messages, confirmed fields, unresolved issues and checklist version. Run/request IDs and base version may differ. A new email is deliberately refused with `UNSUPPORTED_MOCK_INPUT`. Held-out evaluation cases are never loaded by the runtime.

## Application integration

```js
import { runIntake } from '../agents/intake/run-intake.js';
import { createMockProvider, developmentContext } from '../agents/intake/providers/mock.js';

const context = developmentContext('incomplete');
const result = await runIntake(context, {
  provider: createMockProvider('incomplete'),
  timeoutMs: 30000,
  // In a server endpoint: query authorized storage, never browser-supplied state.
  // getCurrentVersion: async requestId => repository.getVersion(requestId),
});
if (result.ok) {
  // Display result.output as proposals requiring coordinator confirmation.
  // result.freshness is 'not_checked' without the repository callback.
} else {
  // Show result.error.message and offer explicit retry or manual review.
}
```

A result includes stage, provider ID, mode, run ID, base record version and freshness. Success includes only a validated Intake output. Failure includes code, safe message, retryable and manual_review_required, never a partially accepted output. Raw provider exceptions and invalid output are not returned.

`INVALID_CONTEXT`, `INVALID_PROVIDER`, `INVALID_OPTIONS`, `UNSUPPORTED_MOCK_INPUT` and `INVALID_OUTPUT` require correction or manual review. `TIMEOUT`, `PROVIDER_FAILED` and `VERSION_CHECK_FAILED` offer explicit retry. `STALE_RESULT` requires rebuilding context from current saved data rather than retrying against the same stale version.

## Provider port

A provider has:

```js
{
  id: 'configured-provider-id',
  mode: 'mock', // A future actual model adapter uses 'live'.
  async generate({ context, signal }) {
    // Return a parsed Intake JSON object, not markdown or a confirmed record.
  }
}
```

`mode` is selected by trusted application configuration, not client input or proof of a real call. This repository currently implements only a mock provider; the CLI rejects `--provider live`.

The runner validates context, clones and freezes it before invoking the provider, validates the returned schema and exact evidence, and optionally rechecks persisted record_version before returning. Caller-owned context is never mutated. The total operation (generation, output validation, freshness callback) has a timeout; the provider receives an AbortSignal. There are no automatic retries. Cancellation is cooperative: a provider ignoring its signal might continue consuming resources, but its late result is not accepted by the timed-out call.

Without getCurrentVersion, freshness is explicitly not_checked. Even with the check, the application must compare base_record_version again in the confirmation write transaction. This adapter is not a database lock and cannot authenticate the coordinator or prevent a later race on its own. The application owns idempotency, persistent run history, approval invalidation, and confirmed writes.

## What is next

1. Agree model provider and server-only credentials.
2. Implement a live adapter using the same provider port and schema boundary.
3. Add versioned Intake instructions and test with development examples first.
4. Mosiah wraps the function in an authenticated, workspace-scoped application endpoint.
5. Run live evaluation separately; passing mock tests is not a model accuracy result.

No UI or hosted demo has been changed by this increment.
