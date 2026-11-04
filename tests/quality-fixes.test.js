import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {runReview} from '../agents/review/run-review.js';import {runWorkflow} from '../agents/workflow/run-workflow.js';import {createFollowUpMockProvider} from '../agents/follow-up/providers/mock.js';
const sample=()=>JSON.parse(readFileSync(new URL('../fixtures/development/incomplete.json',import.meta.url),'utf8'));
test('generic web platforms need specific channels',()=>{
 const f=sample();f.intake.proposed_changes.push({proposal_id:'web',field_key:'platforms',previous_value:null,proposed_value:['online'],evidence:[{message_id:'msg-1',exact_quote:'online'}]});
 assert.ok(runReview(f.context,f.intake).output.issues.some(i=>i.type==='ambiguous'&&i.field_keys.includes('platforms')));
});
test('typed conflict and split signals retain types in Review',()=>{
 for(const type of ['conflict','split_request']){
 const f=sample();f.intake.ambiguities=[{issue_type:type,field_keys:['artist','track_title'],reason:'Two incompatible or separate recordings require human handling.',evidence:[{message_id:'msg-1',exact_quote:'Artist A / Track X'}]}];
 const r=runReview(f.context,f.intake);assert.equal(r.ok,true);assert.ok(r.output.issues.some(i=>i.type===type));
 if(type==='split_request')assert.equal(r.output.checks.find(c=>c.rule_id==='single_recording').result,'fail');
 }
});
test('unknown ambiguity classification is rejected',()=>{
 const f=sample();f.intake.ambiguities=[{issue_type:'approved',field_keys:['project'],reason:'x',evidence:[]}];assert.equal(runReview(f.context,f.intake).error.code,'INVALID_INTAKE');
});
test('missing budget question explicitly asks for rights scope',()=>{
 const f=sample();f.intake.proposed_changes=f.intake.proposed_changes.filter(c=>c.field_key!=='budget');
 assert.match(runReview(f.context,f.intake).output.issues.find(i=>i.issue_id==='missing-budget').question,/amount, currency and rights scope/);
});
test('answered stored issue stays open but is excluded from client draft',async()=>{
 const f=sample();f.context.messages.push({message_id:'reply',kind:'reply',text:'Project: Northern exhibition.',supplied_message_date:null});
 f.context.unresolved_issues=[{issue_id:'old-project',type:'missing',severity:'blocking',field_keys:['project'],question:'What is the project?',evidence:[]}];
 f.intake.proposed_changes.push({proposal_id:'project',field_key:'project',previous_value:null,proposed_value:'Northern exhibition',evidence:[{message_id:'reply',exact_quote:'Northern exhibition'}]});
 const before=structuredClone(f.context);
 const r=await runWorkflow(f.context,{intakeProvider:{id:'test',mode:'mock',generate:async()=>f.intake},followUpProvider:createFollowUpMockProvider()});
 assert.equal(r.ok,true);assert.deepEqual(f.context,before);
 assert.ok(r.stages.review.output.issues.some(i=>i.issue_id==='old-project'));
 assert.deepEqual(r.coordinator_review_issue_ids,['old-project']);
 assert.ok(!r.stages.follow_up.output.addressed_issue_ids.includes('old-project'));assert.ok(!r.stages.follow_up.output.body.includes('What is the project?'));
});
test('partial budget candidate is not routed away from client clarification',()=>{
 const f=sample();f.context.unresolved_issues=[{issue_id:'old-budget',type:'missing',severity:'blocking',field_keys:['budget'],question:'Budget?',evidence:[]}];
 f.intake.proposed_changes.find(c=>c.field_key==='budget').proposed_value.currency=null;
 assert.ok(!runReview(f.context,f.intake).coordinator_issue_ids.includes('old-budget'));
});
test('conflict/split classification requires source evidence',()=>{
 const f=sample();f.intake.ambiguities=[{issue_type:'split_request',field_keys:['artist','track_title'],reason:'More than one recording.',evidence:[]}];assert.equal(runReview(f.context,f.intake).error.code,'INVALID_INTAKE');
});
