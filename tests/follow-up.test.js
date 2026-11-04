import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runReview } from '../agents/review/run-review.js';
import { runFollowUp } from '../agents/follow-up/run-follow-up.js';
import { createFollowUpClaudeProvider } from '../agents/follow-up/providers/claude.js';
const setup = () => {
  const f = JSON.parse(readFileSync(new URL('../fixtures/development/incomplete.json', import.meta.url), 'utf8'));
  const review = runReview(f.context, f.intake).output;
  const draft = { schema_version:'1.0',run_id:f.context.run_id,base_record_version:0,subject:'Clarification',body:'Please clarify the missing request details.',addressed_issue_ids:review.issues.map(i=>i.issue_id) };
  const provider = { id:'test',mode:'mock',generate:async()=>draft };
  return {context:f.context,review,draft,provider};
};
test('draft covers all issues without mutating context or review', async()=>{
  const s=setup();const before=structuredClone(s.review);const r=await runFollowUp(s.context,s.review,{provider:s.provider});
  assert.equal(r.ok,true); assert.deepEqual(s.review,before); assert.deepEqual(r.output.addressed_issue_ids,s.review.issues.map(i=>i.issue_id));
});
test('missing and unknown issue IDs fail closed', async()=>{
  const s=setup();s.draft.addressed_issue_ids.pop(); assert.equal((await runFollowUp(s.context,s.review,{provider:s.provider})).error.code,'INVALID_OUTPUT');
  s.draft.addressed_issue_ids.push('invented'); assert.equal((await runFollowUp(s.context,s.review,{provider:s.provider})).error.code,'INVALID_OUTPUT');
});
test('skip without provider call when there are no unresolved issues',async()=>{
  const s=setup();s.review.issues=[];
  const r=await runFollowUp(s.context,s.review,{provider:{...s.provider,generate:()=>{throw Error('must not call');}}});
  assert.equal(r.skipped,true);assert.equal(r.output,null);
});
test('stale review and stale current revision are rejected',async()=>{
  const s=setup(); s.review.base_record_version++;
  assert.equal((await runFollowUp(s.context,s.review,{provider:s.provider})).error.code,'INVALID_REVIEW');
  s.review.base_record_version--;
  assert.equal((await runFollowUp(s.context,s.review,{provider:s.provider,getCurrentVersion:async()=>1})).error.code,'STALE_RESULT');
});
test('provider failure is sanitized and timeout aborts without retry',async()=>{
  const s=setup(); let calls=0;
  const r=await runFollowUp(s.context,s.review,{provider:{...s.provider,generate:async()=>{throw Error('secret');}}});
  assert.equal(r.error.code,'PROVIDER_FAILED');assert.ok(!JSON.stringify(r).includes('secret'));
  const timed=await runFollowUp(s.context,s.review,{timeoutMs:5,provider:{...s.provider,generate:()=>{calls++;return new Promise(()=>{});}}});
  assert.equal(timed.error.code,'TIMEOUT');assert.equal(calls,1);
});
test('Claude transport sends review with forced draft-only tool and validates output',async()=>{
  const s=setup();let request;
  const provider=createFollowUpClaudeProvider({apiKey:'fake-key',model:'fake-model',fetchImpl:async(url,opts)=>{
    request=JSON.parse(opts.body);assert.equal(url,'https://api.anthropic.com/v1/messages');
    return {ok:true,json:async()=>({stop_reason:'tool_use',content:[{type:'tool_use',name:'submit_follow_up',input:s.draft}]})};
  }});
  assert.equal((await runFollowUp(s.context,s.review,{provider})).ok,true);
  assert.deepEqual(JSON.parse(request.messages[0].content).review.issues,s.review.issues);
  assert.equal(JSON.parse(request.messages[0].content).review.checks,undefined);
  assert.equal(request.tool_choice.name,'submit_follow_up');assert.match(request.system,/untrusted data/);
});
test('prompt requires deduplicated questions while preserving issue IDs',()=>{
  const prompt=readFileSync(new URL('../agents/follow-up/prompts/follow-up-v1.txt',import.meta.url),'utf8');
  assert.match(prompt,/ask each distinct information need once/);
  assert.match(prompt,/retaining all corresponding issue IDs/);
  assert.match(prompt,/flag it to the coordinator/);
});
