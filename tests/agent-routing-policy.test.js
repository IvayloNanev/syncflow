import test from 'node:test';
import assert from 'node:assert/strict';
import {caseHandoff,eligibleHandoffs,superviseCases} from '../agents/priority/supervisor.js';
import {eligibleLanes} from '../agents/internal/triage.js';
import {caseListing,assessmentResult} from '../agents/internal/lifecycle.js';
const now=new Date('2026-11-10T14:00:00Z');
const make=()=>({id:'case',storage_version:1,summary:{project:'Festival promo',deadline:{date:'2026-11-10',time:'17:00',timezone:'America/Toronto'}},workflow:{status:'Internal review pending',reasons:[],next_action:'Obtain reviewer decision'},analysis:{result:{stages:{review:{output:{issues:[]}}}}},messages:[],recording_id:'r',reviewers:{reviewers:[{name:'Alex Morgan',status:'Pending'}]}});
for(const [scenario,edit,destination] of [
 ['pending before deadline',()=>{},'coordinator'],
 ['no deadline',c=>{c.summary.deadline=null;},'coordinator'],
 ['reviewer refusal',c=>{c.reviewers.reviewers[0].status='Declined';},'internal'],
 ['conflicting decisions',c=>{c.reviewers.reviewers=[{status:'Approved'},{status:'Changes requested'}];},'internal'],
 ['rights exception',c=>{c.catalogue_assessment={blockers:[{code:'rights_conflict'}]};},'internal'],
 ['overdue pending decision',c=>{c.summary.deadline.date='2026-11-09';},'internal'],
 ['ordinary recording gap',c=>{c.recording_id=null;},'coordinator']
])test(`${scenario}: briefing, Cases and agent eligibility agree on exactly one owner`,()=>{
 const c=make();edit(c);
 assert.equal(caseHandoff(c,{now}).destination,destination);
 assert.equal(caseListing(c,null,{now}).destination,destination);
 assert.deepEqual(eligibleLanes(c,{now}).allowed,[destination==='internal'?'manager':'coordinator']);
 assert.equal(eligibleHandoffs(c,{now}).length,1);
 assert.equal(superviseCases([c],null,{now}).items[0].handoff.destination,destination);
});
test('manager draft contains a decision question, never an instruction to email the manager',()=>{
 const c=make();c.reviewers.reviewers[0].status='Declined';
 const result=assessmentResult(c,{lane:'manager',reason:'Reviewer declined.',next_action:'Send the manager an email.',escalation_trigger:'Reviewer refusal'},now);
 assert.match(result.recommendation.next_action,/\?$/);
 assert.ok(result.draft.body.includes(result.recommendation.next_action));
 assert.ok(!result.draft.body.includes('Send the manager an email'));
});
