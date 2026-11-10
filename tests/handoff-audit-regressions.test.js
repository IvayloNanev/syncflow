import test from 'node:test';
import assert from 'node:assert/strict';
import {openRequestStore} from '../requests/store.js';
import {managerDecisionToken} from '../requests/manager-decision.js';
import {storedRoutingCase,canRunCoordinator} from '../server/case-routing-policy.js';
import {caseHandoff,caseSnapshot,superviseCases} from '../agents/priority/supervisor.js';
import {createSavedRequestsHandler} from '../server/saved-requests.js';
const actor='audit-owner';
function setup(t){const store=openRequestStore();t.after(()=>store.close());const {request}=store.create({actor_id:actor,email:'Project: Film. Request for a recording.',timezone:'UTC',idempotency_key:'create'});const id=request.id;store.recordReview({actor_id:actor,request_id:id,expected_revision:0,expected_review_version:0,operation:'assign',name:'Reviewer',role:'Rights reviewer',idempotency_key:'assign'});store.recordReview({actor_id:actor,request_id:id,expected_revision:0,expected_review_version:1,operation:'decision',reviewer_id:store.reviewers(actor,id).reviewers[0].id,status:'Declined',notes:'Cannot accept this use.',idempotency_key:'decline'});return {store,id};}
test('a saved manager decision resolves ownership, persists and is invalidated by a new reply',t=>{
 const {store,id}=setup(t);let c=storedRoutingCase(store,actor,id);assert.equal(canRunCoordinator(c),false);
 const command={actor_id:actor,request_id:id,expected_revision:0,expected_scope_token:managerDecisionToken(c),manager_name:'Manager',notes:'Proceed with revised terms; coordinator to clarify scope.',decision:'return_to_coordinator',idempotency_key:'manager'};
 store.recordManagerDecision(command);assert.equal(store.recordManagerDecision(command).replayed,true);
 c=storedRoutingCase(store,actor,id);assert.equal(caseHandoff(c).destination,'coordinator');assert.match(store.context(actor,id,'context-check').messages.at(-1).text,/INTERNAL MANAGER DECISION/);
 const restored=openRequestStore(':memory:',{initialState:store.exportState()});assert.equal(restored.get(actor,id).manager_resolution.notes,command.notes);restored.close();
 store.appendReply({actor_id:actor,request_id:id,expected_revision:1,text:'New usage scope',idempotency_key:'reply'});
 assert.equal(caseHandoff(storedRoutingCase(store,actor,id)).destination,'internal');
});
test('stale manager scope is rejected and closing is durable',t=>{
 const {store,id}=setup(t),c=storedRoutingCase(store,actor,id);
 const cmd={actor_id:actor,request_id:id,expected_revision:0,expected_scope_token:'stale',manager_name:'Manager',notes:'Decline this request.',decision:'close_case',idempotency_key:'close'};
 assert.throws(()=>store.recordManagerDecision(cmd),e=>e.code==='REVISION_CONFLICT');
 store.recordManagerDecision({...cmd,expected_scope_token:managerDecisionToken(c)});
 assert.equal(store.workflow(actor,id).status,'Case completed');
 store.setCompleted({actor_id:actor,request_id:id,expected_revision:1,completed:false,idempotency_key:'reopen'});
 assert.equal(caseHandoff(storedRoutingCase(store,actor,id)).destination,'internal');
});
test('direct Coordinator analysis API rejects manager-owned cases before a provider call',async t=>{
 const {store,id}=setup(t);let calls=0;
 const handler=createSavedRequestsHandler({actor,enabled:()=>true,openStore:()=>new Proxy(store,{get:(s,k)=>k==='close'?()=>{}:s[k]}),providers:()=>{calls++;throw Error('should not run');}});
 const res=await handler(new Request('http://127.0.0.1:3000/api/requests',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json'},body:JSON.stringify({action:'analyze',request_id:id,expected_revision:0,idempotency_key:'bypass'})}));
 assert.equal(res.status,409);assert.equal((await res.json()).error.code,'WRONG_AGENT');assert.equal(calls,0);
});
test('deadline crossing invalidates the old AI action and its explanation',()=>{
 const c={id:'clock',summary:{id:'clock',deadline:{date:'2026-11-10',time:'12:00',timezone:'UTC'}},workflow:{status:'Internal review pending',reasons:[],next_action:'Follow up'},analysis:{run_id:'a',result:{stages:{review:{output:{issues:[]}}}}},messages:[],recording_id:'r',reviewers:{reviewers:[{status:'Pending'}]}};
 const saved={generated_at:'2026-11-10T11:00:00Z',snapshots:{clock:caseSnapshot(c)},report:{decision_version:5,items:[{request_id:'clock',action:'follow_up',reason:'Old routine advice',next_action:'Contact the reviewer',citations:[]}]}};
 const report=superviseCases([c],saved,{now:new Date('2026-11-10T13:00:00Z')});assert.equal(report.decision_source,'workflow');const item=report.items[0];
 assert.equal(item.handoff.destination,'internal');assert.equal(item.explanation_source,'saved_state');assert.match(item.next_action,/manager/);assert.notEqual(item.reason,'Old routine advice');
});

import {isAbandonedAnalysis} from '../requests/analysis-recovery-policy.js';
import {caseCorrespondence} from '../requests/correspondence.js';
test('pending recovery waits for the grace period and never replaces a finished result',()=>{
 const now=Date.parse('2026-11-10T13:00:00Z');
 assert.equal(isAbandonedAnalysis({status:'running',created_at:'2026-11-10T12:59:30Z'},now),false);
 assert.equal(isAbandonedAnalysis({status:'running',created_at:'2026-11-10T12:58:00Z'},now),true);
 assert.equal(isAbandonedAnalysis({status:'completed',created_at:'2026-11-10T12:58:00Z'},now),false);
 assert.equal(isAbandonedAnalysis({status:'running',created_at:'invalid'},now),false);
});
test('recorded manager reply is retained in correspondence and is not an email draft',()=>{
 const rows=caseCorrespondence([],[],[],[{manager_name:'Morgan',notes:'Proceed on revised terms.',decision:'return_to_coordinator',recorded_at:'2026-11-10T12:00:00Z'}]);
 assert.equal(rows[0].draft,false);assert.match(rows[0].text,/Proceed on revised terms/);assert.match(rows[0].text,/Return to Coordinator/);
});

test('a resolved refusal does not hide a newly discovered rights exception',t=>{
 const {store,id}=setup(t);const c=storedRoutingCase(store,actor,id);
 store.recordManagerDecision({actor_id:actor,request_id:id,expected_revision:0,expected_scope_token:managerDecisionToken(c),manager_name:'Manager',notes:'Proceed to clarification.',decision:'return_to_coordinator',idempotency_key:'resolve'});
 const changed=storedRoutingCase(store,actor,id);assert.equal(caseHandoff(changed).destination,'coordinator');
 changed.catalogue_assessment={blockers:[{code:'rights_conflict'}]};
 assert.equal(caseHandoff(changed).destination,'internal');
});
