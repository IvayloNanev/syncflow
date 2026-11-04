import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyCorpus, manifest, directory } from './verify.js';
import { runWorkflow } from '../agents/workflow/run-workflow.js';
import { createClaudeProvider } from '../agents/intake/providers/claude.js';
import { createFollowUpClaudeProvider } from '../agents/follow-up/providers/claude.js';
import { scoreCase, summarize } from './score.js';
const output=process.argv[2];
if (!output) throw Error('Supply report output path. Up to 40 paid model calls.');
verifyCorpus();
try { process.loadEnvFile('.env'); } catch(e) { if(e.code!=='ENOENT') throw e; }
const providers={intakeProvider:createClaudeProvider(),followUpProvider:createFollowUpClaudeProvider()};
const hash=path=>createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex');
const report={evaluation_version:manifest.version,answer_key_status:manifest.authoring_status,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),model:process.env.ANTHROPIC_MODEL,started_at:new Date().toISOString(),max_model_calls:40,
  prompt_sha256:{intake:hash('../agents/intake/prompts/intake-v1.txt'),follow_up:hash('../agents/follow-up/prompts/follow-up-v1.txt')},
  scoring:'Case/whitespace normalized strings, order-insensitive arrays, object supplied_text ignored; no synonym adjudication. Strict type+field-set issue signatures. Manual prose review required.',cases:[]};
for(const entry of manifest.cases) {
  const f=JSON.parse(readFileSync(new URL(entry.file,directory),'utf8'));
  // Only request context is sent to agents. Expected answers stay in the scorer.
  const start=performance.now();const result=await runWorkflow(f.context,providers);
  const record={case_id:f.case_id,name:f.name,elapsed_ms:Math.round(performance.now()-start),score:scoreCase(f,result),result};
  report.cases.push(record);report.summary=summarize(report.cases);writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({case:f.case_id,ok:result.ok,matched:record.score.facts.matched,expected:record.score.facts.expected,missing_issues:record.score.issue_signatures.missing,extra_issues:record.score.issue_signatures.extra,error:record.score.error_code}));
}
report.finished_at=new Date().toISOString();writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.summary));
