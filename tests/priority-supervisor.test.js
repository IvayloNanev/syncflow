import test from 'node:test';
import assert from 'node:assert/strict';
import {superviseCases,caseHandoff} from '../agents/priority/supervisor.js';
import {deadlineInstant,reviewPriorities} from '../agents/priority/review.js';
const now=new Date('2026-11-09T17:00:00Z');
const make=(id,status='Needs analysis')=>({id,summary:{id,contact:id,status,updated_at:'2026-11-08'},messages:[{message_id:'m',text:'Client request'}],confirmed_fields:[],recording_id:'recording',analysis:{run_id:'run',result:{stages:{review:{output:{issues:[]}}}}},workflow:{status,reasons:['Recorded blocker'],next_action:'Next saved action'},reviewers:{reviewers:[]}});
test('handoffs cover analysis, catalogue, draft, signoff, waiting, internal completion and finished',()=>{
 const expected={'Needs analysis':'analysis','Recording unresolved':'catalogue','Needs clarification':'response','Needs coordinator review':'response','Ready for coordination':'response','Internal review pending':'follow_up','Ready to complete internal review':'follow_up','Internal review complete':'finished'};
 for(const [status,stage] of Object.entries(expected)){const c=make('one',status);assert.equal(caseHandoff(c).stage,stage);}
 const c=make('one','Needs clarification');c.recording_id=null;assert.equal(caseHandoff(c).stage,'catalogue');
 assert.equal(caseHandoff(make('one','Internal review pending')).state,'action');
 assert.equal(caseHandoff(make('one','Changes requested')).state,'action');
});
test('saved briefing survives serialization, tracks every change source, and drops stale AI advice',()=>{
 const c=make('one','Needs coordinator review');
 const initial=superviseCases([c],null,{now});
 const saved=JSON.parse(JSON.stringify({generated_at:now.toISOString(),snapshots:initial.snapshots,report:{items:[{request_id:'one',blocker:'AI blocker',next_action:'AI next',citations:[{exact_quote:'Client request'}]}]}}));
 const restored=superviseCases([c],saved,{now});assert.equal(restored.changed_count,0);assert.equal(restored.items[0].explanation_source,'saved_state');
 for(const key of ['messages','analysis','confirmed_fields','catalogue_assessment','reviewers','workflow']){
  const changed=structuredClone(c);
  if(key==='messages')changed.messages.push({message_id:'reply',text:'New reply'});
  else if(key==='confirmed_fields')changed.confirmed_fields.push({field_key:'project',value:'New project'});
  else changed[key]={...changed[key],new_value:'updated'};
  const result=superviseCases([changed],saved,{now});assert.equal(result.changed_count,1,key);assert.equal(result.items[0].explanation_source,'saved_state',key);assert.notEqual(result.items[0].next_action,'AI next',key);
 }
});
test('finished work is tracked separately and a new reply reopens the analysis handoff',()=>{
 const done=make('done','Internal review complete'),open=make('open');
 const result=superviseCases([done,open],null,{now});assert.equal(result.finished_count,1);assert.equal(result.items[0].request_id,'open');
 const saved={snapshots:result.snapshots};done.messages.push({message_id:'new',text:'Scope changed'});done.workflow.status='Needs analysis';done.analysis=null;
 const next=superviseCases([done,open],saved,{now});assert.equal(next.finished_count,0);assert.equal(next.items.find(i=>i.request_id==='done').handoff.stage,'analysis');
});
test('exact deadline time respects supplied timezone and same-day urgency',()=>{
 const deadline={date:'2026-11-09',time:'11:00',timezone:'America/New_York'};
 assert.equal(deadlineInstant(deadline),Date.parse('2026-11-09T16:00:00Z'));
 assert.equal(deadlineInstant({...deadline,timezone:'invalid'}),null);
 assert.equal(deadlineInstant({date:'2026-03-08',time:'02:30',timezone:'America/New_York'}),null);
 const a={id:'a',status:'Needs analysis',deadline:{...deadline,time:'14:00'}},b={id:'b',status:'Needs analysis',deadline};
 const result=reviewPriorities([a,b],{now});assert.deepEqual(result.ranked_request_ids,['b','a']);assert.equal(result.recommendation.rank,0);
});

test('briefing persistence is workspace scoped and save errors never claim success',async()=>{
 const {saveBriefing}=await import('../server/briefing-store.js');
 const rows=new Map();
 const client={from(table){assert.equal(table,'syncflow_briefings');return {async upsert(row,options){assert.equal(options.onConflict,'workspace_id');rows.set(row.workspace_id,structuredClone(row));return {error:null};}};}};
 const c=make('case');const current=superviseCases([c],null,{now});
 await saveBriefing(client,'workspace-one','actor',{generated_at:now.toISOString(),items:[]},current.snapshots);
 assert.equal(rows.has('workspace-two'),false);
 const restored=superviseCases([c],rows.get('workspace-one'),{now});assert.equal(restored.changed_count,0);
 await assert.rejects(saveBriefing({from(){return {async upsert(){return {error:{message:'failure'}};}};}},'workspace-one','actor',null,{}),/BRIEFING_STORAGE_FAILED/);
});
test('fresh AI decisions control order and eligible follow-up; any changed case invalidates the whole decision',()=>{
 const a=make('a','Needs coordinator review'),b=make('b','Internal review pending');
 const initial=superviseCases([a,b],null,{now});
 const saved={generated_at:now.toISOString(),snapshots:initial.snapshots,report:{decision_version:5,items:[{request_id:'b',action:'follow_up',reason:'Chase the pending reviewer first.',next_action:'Contact the reviewer for a decision.',blocker:'Pending reviewer.',citations:[]},{request_id:'a',action:'response',reason:'Review after the follow-up.',next_action:'Continue client coordination.',citations:[]}]}};
 const result=superviseCases([a,b],saved,{now});
 assert.equal(result.decision_source,'ai');assert.deepEqual(result.items.map(i=>i.request_id),['b','a']);
 assert.equal(result.items[0].handoff.destination,'coordinator');assert.equal(result.items[0].handoff.anchor,'reviewer-follow-up');assert.equal(result.items[0].next_action,'Contact the reviewer for a decision.');
 a.messages.push({message_id:'reply',text:'Scope changed'});
 const stale=superviseCases([a,b],saved,{now});assert.equal(stale.decision_source,'workflow');assert.equal(stale.items.find(i=>i.request_id==='b').handoff.destination,'coordinator');
 assert.equal(superviseCases([b],saved,{now:new Date('2026-11-10T17:00:00Z')}).decision_source,'workflow');
});
