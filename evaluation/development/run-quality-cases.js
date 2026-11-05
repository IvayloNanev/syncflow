import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {runWorkflow} from '../../agents/workflow/run-workflow.js';
import {createClaudeProvider} from '../../agents/intake/providers/claude.js';import {createFollowUpClaudeProvider} from '../../agents/follow-up/providers/claude.js';
const bytes=readFileSync(new URL('./quality-fix-v1.json',import.meta.url));const digest=createHash('sha256').update(bytes).digest('hex');
if(digest!==readFileSync(new URL('./quality-fix-v1.sha256',import.meta.url),'utf8').trim())throw Error('Cases changed');
const path=process.argv[2];if(!path)throw Error('Provide output. Maximum 12 explicit live calls.');process.loadEnvFile('.env');
const providers={intakeProvider:createClaudeProvider(),followUpProvider:createFollowUpClaudeProvider()};
const report={kind:'targeted-new-wording-quality-check-not-global-acceptance',model:process.env.ANTHROPIC_MODEL,sha256:digest,started_at:new Date().toISOString(),cases:[]};
for(const f of JSON.parse(bytes)){
 const result=await runWorkflow(f.context,providers);const issues=result.stages?.review?.output?.issues||[];
 const conflict=issues.some(i=>i.type==='conflict'&&i.field_keys.includes('territories'));
 const missing=issues.some(i=>i.type==='missing'&&i.field_keys.includes('platforms'));
 const checks={workflow_ok:result.ok,territory_conflict:conflict===f.expect.conflict,platforms_gap:missing===f.expect.missing_platforms};
 report.cases.push({id:f.id,checks,result});writeFileSync(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id:f.id,checks}));
}
report.finished_at=new Date().toISOString();writeFileSync(path,JSON.stringify(report,null,2)+'\n');
