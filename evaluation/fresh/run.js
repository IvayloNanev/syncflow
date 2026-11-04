import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {runWorkflow} from '../../agents/workflow/run-workflow.js';
import {createClaudeProvider} from '../../agents/intake/providers/claude.js';import {createFollowUpClaudeProvider} from '../../agents/follow-up/providers/claude.js';
const bytes=readFileSync(new URL('./quality-v1.json',import.meta.url));const digest=createHash('sha256').update(bytes).digest('hex');
if(digest!==readFileSync(new URL('./quality-v1.sha256',import.meta.url),'utf8').trim())throw Error('Fresh cases changed');
const path=process.argv[2];if(!path)throw Error('Supply output report path. Up to 12 paid calls.');
try{process.loadEnvFile('.env');}catch(e){if(e.code!=='ENOENT')throw e;}
const providers={intakeProvider:createClaudeProvider(),followUpProvider:createFollowUpClaudeProvider()};
const report={suite_sha256:digest,model:process.env.ANTHROPIC_MODEL,started_at:new Date().toISOString(),cases:[]};
for(const f of JSON.parse(bytes)){
 const result=await runWorkflow(f.context,providers);const changes=result.stages?.intake?.output?.proposed_changes||[];const issues=result.stages?.review?.output?.issues||[];const draft=result.stages?.follow_up?.output;const e=f.expectations;
 const checks={workflow_ok:result.ok,contact_retained:changes.some(c=>c.field_key==='client_contact'&&c.proposed_value.includes(e.contact_contains))};
 if(e.no_issues)checks.no_issues=issues.length===0;
 if(e.issue_field)checks.field_flagged=issues.some(i=>i.field_keys.includes(e.issue_field));
 if(e.issue_type)checks.typed_issue=issues.some(i=>i.type===e.issue_type);
 if(e.coordinator_issue){checks.coordinator_routed=result.coordinator_review_issue_ids?.includes(e.coordinator_issue)===true;checks.issue_preserved=issues.some(i=>i.issue_id===e.coordinator_issue);checks.not_asked_again=!draft?.addressed_issue_ids.includes(e.coordinator_issue);}
 if(e.budget_components_in_draft)checks.budget_components=/amount/i.test(draft?.body||'')&&/currenc/i.test(draft?.body||'')&&/master|publishing|rights scope/i.test(draft?.body||'');
 report.cases.push({case_id:f.case_id,checks,result});writeFileSync(path,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({case:f.case_id,checks}));
}
report.finished_at=new Date().toISOString();writeFileSync(path,JSON.stringify(report,null,2)+'\n');
