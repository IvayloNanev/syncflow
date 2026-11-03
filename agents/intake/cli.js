import { readFile } from 'node:fs/promises';
import { runIntake } from './run-intake.js';
import { createMockProvider, developmentContext, scenarios } from './providers/mock.js';

const usage = 'Usage: node agents/intake/cli.js --provider mock --scenario complete|incomplete|partial-reply [--context file.json] [--timeout-ms 30000]';
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') { console.log(usage); return; }
  const opts = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (!['--provider', '--scenario', '--context', '--timeout-ms'].includes(key)
        || opts[key] !== undefined || !args[i + 1] || args[i + 1].startsWith('--')) {
      throw new Error(usage);
    }
    opts[key] = args[i + 1];
  }
  if (opts['--provider'] !== 'mock' || !scenarios.includes(opts['--scenario'])) throw new Error(usage);
  const timeoutMs = opts['--timeout-ms'] === undefined ? 30000 : Number(opts['--timeout-ms']);
  const context = opts['--context']
    ? JSON.parse(await readFile(opts['--context'], 'utf8'))
    : developmentContext(opts['--scenario']);
  console.error('MOCK ONLY — fixed development answer; no model/API call. Output is a proposal, never a confirmed record.');
  const result = await runIntake(context, { provider: createMockProvider(opts['--scenario']), timeoutMs });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
main().catch(() => {
  // Do not dump malformed input, credentials, provider errors, or file contents.
  console.error(usage);
  console.error('Unable to run: check arguments and JSON context file. No confirmed record was changed.');
  process.exitCode = 2;
});
