import { analyzeEmail } from './analyze.js';
import { createClaudeProvider } from '../agents/intake/providers/claude.js';
import { createFollowUpClaudeProvider } from '../agents/follow-up/providers/claude.js';

/** Development-only bridge. No persistence or user authentication. */
export function createBrowserAnalysisHandler({ enabled = () => process.env.NODE_ENV === 'development',
  providers = () => ({ intakeProvider: createClaudeProvider(), followUpProvider: createFollowUpClaudeProvider() }) } = {}) {
  let busy = false;
  const json = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  return async function POST(request) {
    if (!enabled()) return json(503, { error: { code: 'LOCAL_DEVELOPMENT_ONLY', message: 'Analysis is available through the local development server only.' } });
    const url = new URL(request.url);
    const host = request.headers.get('host');
    const authority = host || url.host;
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !/^(127\.0\.0\.1|localhost)(:\d{1,5})?$/.test(authority)
        || (request.headers.get('origin') && request.headers.get('origin') !== `http://${authority}`))
      return json(403, { error: { code: 'ORIGIN_REJECTED', message: 'Use the same local address as the app.' } });
    if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
      return json(415, { error: { code: 'JSON_REQUIRED', message: 'Send JSON request data.' } });
    if (busy) return json(429, { error: { code: 'BUSY', message: 'An analysis is already running. Wait before trying again.' } });
    busy = true;
    try {
      const reader = request.body?.getReader(); let size = 0; const chunks = [];
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read(); if (done) break;
            size += value.byteLength;
            if (size > 100000) { await reader.cancel(); return json(413, { error: { code: 'BODY_TOO_LARGE', message: 'The request is too large.' } }); }
            chunks.push(Buffer.from(value));
          }
        } finally { reader.releaseLock(); }
      }
      let input;
      try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { return json(400, { error: { code: 'INVALID_JSON', message: 'Request data is not valid JSON.' } }); }
      // Validate input before constructing providers, which require server-only credentials.
      let configured;
      const lazy = {
        intakeProvider: { id: 'server:claude', mode: 'live', async generate(args) { configured ??= providers(); return configured.intakeProvider.generate(args); } },
        followUpProvider: { id: 'server:claude', mode: 'live', async generate(args) { configured ??= providers(); return configured.followUpProvider.generate(args); } },
      };
      const result = await analyzeEmail(input, lazy);
      return json(result.status, result.body);
    } catch {
      return json(500, { error: { code: 'ANALYSIS_FAILED', message: 'Unable to analyze. Your email is unchanged; retry explicitly or review it manually.' } });
    } finally { busy = false; }
  };
}
