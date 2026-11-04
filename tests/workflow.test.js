import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runWorkflow } from '../agents/workflow/run-workflow.js';
import { createMockProvider, developmentContext } from '../agents/intake/providers/mock.js';
import { createFollowUpMockProvider } from '../agents/follow-up/providers/mock.js';
for (const scenario of ['complete','incomplete','partial-reply']) test(`workflow hands ${scenario} Intake issues to draft without saving`, async()=>{
  const context=developmentContext(scenario);const before=structuredClone(context);
  const r=await runWorkflow(context,{intakeProvider:createMockProvider(scenario),followUpProvider:createFollowUpMockProvider()});
  assert.equal(r.ok,true);assert.deepEqual(context,before);assert.equal(r.saved,false);assert.equal(r.sent,false);
  assert.equal(r.freshness,'not_checked');assert.equal(r.stages.intake.mode,'mock');
  assert.deepEqual(new Set(r.stages.follow_up.output.addressed_issue_ids),new Set(r.stages.review.output.issues.map(i=>i.issue_id)));
});
test('failed Intake prevents downstream generation',async()=>{
  let calls=0;
  const r=await runWorkflow(developmentContext('incomplete'),{intakeProvider:{id:'broken',mode:'mock',generate:async()=>({})},followUpProvider:{id:'test',mode:'mock',generate:async()=>{calls++;}}});
  assert.equal(r.failed_stage,'intake');assert.equal(calls,0);assert.equal(r.stages.review,undefined);
});
test('draft failure preserves validated stages but exposes no accepted draft',async()=>{
  const r=await runWorkflow(developmentContext('incomplete'),{intakeProvider:createMockProvider('incomplete'),followUpProvider:{id:'broken',mode:'mock',generate:async()=>({})}});
  assert.equal(r.failed_stage,'follow_up');assert.equal(r.stages.intake.ok,true);assert.equal(r.stages.review.ok,true);assert.equal(r.stages.follow_up.output,undefined);
});
test('saved revision change between agents rejects draft',async()=>{
  let checks=0;
  const r=await runWorkflow(developmentContext('incomplete'),{intakeProvider:createMockProvider('incomplete'),followUpProvider:createFollowUpMockProvider(),getCurrentVersion:async()=>checks++===0?0:1});
  assert.equal(r.failed_stage,'follow_up');assert.equal(r.error.code,'STALE_RESULT');
});
test('fully specified candidate skips draft but still requires human review',async()=>{
  const f=JSON.parse(readFileSync(new URL('../fixtures/development/complete.json',import.meta.url),'utf8'));
  const quote='November 6, 2026 at 17:00 America/New_York';f.context.messages[0].text+=` ${quote}`;
  const change=f.intake.proposed_changes.find(c=>c.field_key==='response_deadline');
  change.proposed_value={supplied_text:quote,date:'2026-11-06',time:'17:00',timezone:'America/New_York'};
  change.evidence=[{message_id:f.context.messages[0].message_id,exact_quote:quote}];
  const r=await runWorkflow(f.context,{intakeProvider:{id:'test',mode:'mock',generate:async()=>f.intake}});
  assert.equal(r.ok,true);assert.equal(r.stages.follow_up.skipped,true);assert.equal(r.status,'review_required');assert.equal(r.manual_review_required,true);
});
