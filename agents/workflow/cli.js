import { readFileSync } from 'node:fs';
import { runWorkflow } from './run-workflow.js';
import { createMockProvider, developmentContext, scenarios } from '../intake/providers/mock.js';
import { createClaudeProvider } from '../intake/providers/claude.js';
import { createFollowUpClaudeProvider } from '../follow-up/providers/claude.js';
import { createFollowUpMockProvider } from '../follow-up/providers/mock.js';
const usage = 'Usage: node agents/workflow/cli.js --provider mock|claude --scenario complete|incomplete|partial-reply [--context file.json]';
async function main() {
  const args = process.argv.slice(2); const opts = {};
  for (let i=0;i<args.length;i+=2) {
    if (!['--provider','--scenario','--context'].includes(args[i]) || opts[args[i]] || !args[i+1] || args[i+1].startsWith('--')) throw Error();
    opts[args[i]]=args[i+1];
  }
  if (!['mock','claude'].includes(opts['--provider']) || !scenarios.includes(opts['--scenario'])) throw Error();
  const context = opts['--context'] ? JSON.parse(readFileSync(opts['--context'],'utf8')) : developmentContext(opts['--scenario']);
  const live = opts['--provider']==='claude';
  if (live) { try { process.loadEnvFile('.env'); } catch(e) { if(e.code!=='ENOENT') throw e; } }
  console.error(live ? 'LIVE workflow: up to two Claude calls; sends context to Anthropic and may incur charges. No automatic retry, save or email send.' : 'MOCK workflow: fixture Intake → rule Review → template draft. No model calls, saves or sends.');
  const result = await runWorkflow(context, { intakeProvider: live ? createClaudeProvider() : createMockProvider(opts['--scenario']),
    followUpProvider: live ? createFollowUpClaudeProvider() : createFollowUpMockProvider() });
  console.log(JSON.stringify(result,null,2));
  if(!result.ok) process.exitCode=1;
}
main().catch(()=>{console.error(usage);console.error('Unable to run. Check configuration and context; no record or email changed.');process.exitCode=2;});
