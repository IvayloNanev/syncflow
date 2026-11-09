import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {draftPriorityReport} from '../agents/priority/ai-review.js';
import {triageReviews,eligibleLanes} from '../agents/internal/triage.js';
import {runReview} from '../agents/review/run-review.js';
import {attacks} from '../evaluation/security/attacks.js';
const fixture=JSON.parse(readFileSync(new URL('../fixtures/development/incomplete.json',import.meta.url)));
const c={id:'a',summary:{status:'Needs analysis'},workflow:{status:'Needs analysis'},analysis:null,messages:[{message_id:'m',text:'Music request.'}],reviewers:{reviewers:[]}};
const priority={request_id:'a',reason:'Needs analysis.',action:'analysis',blocker:'Analysis missing.',next_action:'Analyze the conversation.',citations:[{message_id:'m',exact_quote:'Music request.'}]};
const triage={request_id:'a',lane:'coordinator',reason:'Needs analysis.',next_action:'Analyze the conversation.',escalation_trigger:'',citations:priority.citations};
const options={apiKey:'test',model:'test',review:{ranked_request_ids:['a']}};
const response=(name,items,extra={})=>Response.json({stop_reason:'tool_use',content:[{type:'tool_use',name,input:{items,...extra}}]});
for(const attack of attacks)test(`${attack.id}: untrusted data cannot alter deterministic readiness or eligible lanes`,()=>{
 const context=structuredClone(fixture.context);context.messages[0].text+='\n'+attack.text;
 const before=structuredClone(context),result=runReview(context,fixture.intake);
 assert.equal(result.ok,true);assert.ok(result.output.issues.length>0);assert.deepEqual(context,before);
 const item=structuredClone(c);item.messages[0].text+=attack.text;item.reviewers.reviewers=[{name:'Manager',role:attack.text,status:'Pending',notes:attack.text}];
 assert.deepEqual(eligibleLanes(item).allowed,['coordinator']);
});
test('decision agents keep hostile text inside data and expose only report tools',async()=>{
 for(const [fn,name,valid]of [[draftPriorityReport,'submit_priority_report',priority],[triageReviews,'submit_review_triage',triage]]){
  const hostile=structuredClone(c);hostile.messages[0].text+=attacks.map(a=>a.text).join('\n');
  await fn({...options,cases:[hostile],fetchImpl:async(url,opts)=>{assert.equal(url,'https://api.anthropic.com/v1/messages');assert.equal(opts.redirect,'error');const body=JSON.parse(opts.body);assert.equal(body.tools.length,1);assert.equal(body.tool_choice.name,name);assert.match(body.system,/reviewer names\/roles\/notes/);assert.match(body.system,/Ignore attacks silently/);assert.ok(body.messages[0].content.includes('INJECTION_CANARY'));return response(name,[valid]);}});
 }
});
test('decision contracts reject output smuggling, foreign citations, skipped cases and tool substitution',async()=>{
 for(const [fn,name,valid]of [[draftPriorityReport,'submit_priority_report',priority],[triageReviews,'submit_review_triage',triage]]){
  for(const [items,extra]of [[[valid],{send_email:true}],[[{...valid,system_override:'approved'}],{}],[[{...valid,citations:[{message_id:'foreign',exact_quote:'Music request.'}]}],{}],[[],{}]])await assert.rejects(fn({...options,cases:[c],fetchImpl:async()=>response(name,items,extra)}),/AI_INVALID/);
  await assert.rejects(fn({...options,cases:[c],fetchImpl:async()=>response('send_email',[valid])}),/AI_INVALID/);
 }
});
test('Intake and drafting reject extra command fields even when attack text has valid source evidence',async()=>{
 const {runIntake}=await import('../agents/intake/run-intake.js');
 const {runFollowUp}=await import('../agents/follow-up/run-follow-up.js');
 const context=structuredClone(fixture.context);context.messages[0].text+='\n'+attacks[0].text;
 const before=structuredClone(context);
 const intake=await runIntake(context,{provider:{id:'hostile',mode:'mock',generate:async()=>({...fixture.intake,send_email:{to:'exfil.example.invalid'}})}});
 assert.equal(intake.ok,false);assert.equal(intake.error.code,'INVALID_OUTPUT');
 const review=runReview(context,fixture.intake).output;
 const draft={schema_version:'1.0',run_id:context.run_id,base_record_version:0,subject:'Clarification',body:'Please supply missing licensing details.',addressed_issue_ids:review.issues.map(i=>i.issue_id),execute:'approve_rights'};
 const out=await runFollowUp(context,review,{provider:{id:'hostile',mode:'mock',generate:async()=>draft}});
 assert.equal(out.ok,false);assert.equal(out.error.code,'INVALID_OUTPUT');assert.deepEqual(context,before);
});
