import { validateContract } from '../../contracts/validate.js';

const messages = {
  INVALID_CONTEXT: 'Request context is invalid. Correct it before analysis.',
  INVALID_PROVIDER: 'Select an explicitly configured Intake provider.',
  INVALID_OPTIONS: 'Timeout must be an integer between 1 and 30000 milliseconds.',
  PROVIDER_FAILED: 'Intake provider failed. Retry explicitly or continue with manual review.',
  UNSUPPORTED_MOCK_INPUT: 'Mock input does not match the selected development scenario. No extraction was performed.',
  INVALID_OUTPUT: 'Provider output failed schema or evidence validation. No proposal was accepted.',
  STALE_RESULT: 'The saved request changed during analysis. Reanalyze using its latest version.',
  VERSION_CHECK_FAILED: 'Current request version could not be verified. Do not accept this result.',
  TIMEOUT: 'Intake timed out. Retry explicitly or continue with manual review.',
};
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
class RunFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}

/**
 * Provider port: { id, mode: 'mock'|'live', generate({ context, signal }) }.
 * Returns proposals only. Never writes records or retries automatically.
 * getCurrentVersion is an optional server-side freshness check, not a write lock.
 */
export async function runIntake(context, { provider, timeoutMs = 30000, getCurrentVersion } = {}) {
  const meta = { stage: 'intake', provider: null, mode: 'unconfigured', run_id: null,
    base_record_version: null, freshness: 'not_checked' };
  const fail = code => ({ ok: false, ...meta, error: {
    code, message: messages[code], retryable: ['PROVIDER_FAILED', 'TIMEOUT', 'VERSION_CHECK_FAILED'].includes(code),
    manual_review_required: true,
  } });
  let snapshot;
  try {
    snapshot = structuredClone(context);
    validateContract('context', snapshot);
  } catch { return fail('INVALID_CONTEXT'); }
  meta.run_id = snapshot.run_id;
  meta.base_record_version = snapshot.base_record_version;
  if (!provider || typeof provider.id !== 'string' || !provider.id.trim()
      || !['mock', 'live'].includes(provider.mode) || typeof provider.generate !== 'function')
    return fail('INVALID_PROVIDER');
  meta.provider = provider.id;
  meta.mode = provider.mode;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000
      || (getCurrentVersion !== undefined && typeof getCurrentVersion !== 'function'))
    return fail('INVALID_OPTIONS');
  freeze(snapshot);
  const controller = new AbortController();
  let timer;
  const operation = async () => {
    let output;
    try { output = await provider.generate({ context: snapshot, signal: controller.signal }); }
    catch (error) {
      throw new RunFailure(error?.code === 'UNSUPPORTED_MOCK_INPUT' ? 'UNSUPPORTED_MOCK_INPUT' : 'PROVIDER_FAILED');
    }
    // No provider-owned objects survive into a caller's result.
    try {
      output = structuredClone(output);
      validateContract('intake', output, snapshot);
    } catch { throw new RunFailure('INVALID_OUTPUT'); }
    if (getCurrentVersion) {
      let current;
      try { current = await getCurrentVersion(snapshot.request_id, { signal: controller.signal }); }
      catch { throw new RunFailure('VERSION_CHECK_FAILED'); }
      if (!Number.isInteger(current) || current < 0) throw new RunFailure('VERSION_CHECK_FAILED');
      if (current !== snapshot.base_record_version) throw new RunFailure('STALE_RESULT');
      meta.freshness = 'checked';
    }
    return output;
  };
  try {
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(new RunFailure('TIMEOUT'));
        controller.abort();
      }, timeoutMs);
    });
    const output = await Promise.race([operation(), timeout]);
    return { ok: true, ...meta, output };
  } catch (error) { return fail(error instanceof RunFailure ? error.code : 'PROVIDER_FAILED'); }
  finally { clearTimeout(timer); }
}
