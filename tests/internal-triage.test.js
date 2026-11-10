import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleLanes,triageReviews} from '../agents/internal/triage.js';
const now=new Date('2026-11-09T18:00:00Z');
const make=(id,status='Needs analysis')=>({id,summary:{contact:id,status,project:'Campaign'},workflow:{status},messages:[{message_id:`m-${id}`,text:'Please review this music request.'}],recording_id:'r',analysis:status==='Needs analysis'?null:{result:{stages:{review:{output:{issues:[]}}}}},reviewers:{reviewers:[]}});
const item=(id,lane='coordinator',trigger='')=>({request_id:id,lane,escalation_trigger:trigger,reason:'This request needs a decision.',next_action:'Review the saved request.',citations:[{message_id:`m-${id}`,exact_quote:'music request'}]});
const provider=items=>async()=>Response.json({stop_reason:'tool_use',content:[{type:'tool_use',name:'submit_review_triage',input:{items}}]});
const args={now,apiKey:'test',model:'test'};
test('incomplete work returns to coordinator; ordinary catalogue gaps do not justify escalation',()=>{
 const c=make('a');assert.deepEqual(eligibleLanes(c,{now}).allowed,['coordinator']);
 c.catalogue_assessment={status:'not_found',blockers:[{code:'recording_missing'}]};assert.deepEqual(eligibleLanes(c,{now}).escalation,[]);
});
test('manager eligibility requires recorded refusal, conflict, policy exception or overdue pending decision',()=>{
 const c=make('a','Internal review pending');c.reviewers.reviewers=[{status:'Declined'}];assert.ok(eligibleLanes(c,{now}).escalation.includes('Reviewer refusal'));
 c.reviewers.reviewers=[{status:'Approved'},{status:'Changes requested'}];assert.ok(eligibleLanes(c,{now}).escalation.includes('Conflicting reviewer decisions'));
 c.reviewers.reviewers=[{status:'Pending'}];c.summary.deadline={date:'2026-11-08',time:'17:00',timezone:'America/Toronto'};assert.ok(eligibleLanes(c,{now}).escalation.includes('Overdue client commitment with unresolved review'));
});
test('real report contract supports only Coordinator and manager escalation with exact source evidence and server-owned destinations',async()=>{
 const a=make('a'),b=make('b','Internal review pending'),c=make('c','Declined');c.reviewers.reviewers=[{status:'Declined'}];
 const result=await triageReviews({...args,cases:[a,b,c],fetchImpl:provider([item('c','manager','Reviewer refusal'),item('a'),item('b')])});
 assert.deepEqual(result.items.map(i=>i.lane),['manager','coordinator','coordinator']);assert.equal(result.items[0].anchor,'manager-escalation');assert.equal(result.items[1].destination,'coordinator');assert.equal(result.items[2].destination,'coordinator');
});
test('rejects unsafe escalation, premature human review, omissions, duplicates and fabricated evidence',async()=>{
 const c=make('a');
 for(const items of [[item('a','manager','Reviewer refusal')],[item('a','human')],[],[item('a'),item('a')],[{...item('a'),citations:[{message_id:'m-a',exact_quote:'approved'}]}]])await assert.rejects(triageReviews({...args,cases:[c],fetchImpl:provider(items)}),/AI_INVALID/);
});
test('finished cases are excluded without a provider call',async()=>{
 const result=await triageReviews({...args,cases:[make('a','Internal review complete')],fetchImpl:()=>assert.fail('No AI call')});assert.deepEqual(result.items,[]);
});

test('bounded explanatory text over 300 characters remains valid; oversized output is rejected',async()=>{
 const c=make('long');const output=item('long');output.reason='Saved case evidence supports this explanation. '.repeat(10);output.next_action='Review the saved case details. '.repeat(12);
 const fetchImpl=async()=>Response.json({stop_reason:'tool_use',content:[{type:'tool_use',name:'submit_review_triage',input:{items:[output]}}]});
 const result=await triageReviews({cases:[c],now,apiKey:'test',model:'test',fetchImpl});assert.equal(result.items[0].reason,output.reason);
 output.reason='x'.repeat(2001);await assert.rejects(triageReviews({cases:[c],now,apiKey:'test',model:'test',fetchImpl}),/AI_INVALID_OUTPUT:TEXT_LENGTH/);
});
