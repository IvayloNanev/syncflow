import { createAnalysisServer } from './http.js';
import { createClaudeProvider } from '../agents/intake/providers/claude.js';
import { createFollowUpClaudeProvider } from '../agents/follow-up/providers/claude.js';
try {
  try { process.loadEnvFile('.env'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const server = createAnalysisServer({ intakeProvider: createClaudeProvider(), followUpProvider: createFollowUpClaudeProvider() });
  server.requestTimeout = 75000;
  server.on('error', () => { console.error('Unable to start local API. Check whether port 3001 is in use.'); process.exitCode = 1; });
  server.listen(3001, '127.0.0.1', () => console.log('SyncFlow local API: http://127.0.0.1:3001 — POST /api/analyze makes up to two paid Claude calls. No saves or sends.'));
} catch { console.error('Configure ANTHROPIC_API_KEY and ANTHROPIC_MODEL in the ignored local .env.'); process.exitCode = 1; }
