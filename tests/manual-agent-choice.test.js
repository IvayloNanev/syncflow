import test from 'node:test';
import assert from 'node:assert/strict';
import {openRequestStore} from '../requests/store.js';
import {managerDecisionToken} from '../requests/manager-decision.js';
import {storedRoutingCase,canRunCoordinator} from '../server/case-routing-policy.js';
import {caseHandoff,eligibleHandoffs} from '../agents/priority/supervisor.js';
import {eligibleLanes} from '../agents/internal/triage.js';
import {managerDraft} from '../agents/internal/lifecycle.js';
import {selectCaseAgent} from '../components/case-routing.js';
test('Cases agent choices persist a single owner, replay safely and expire on changed conversation',()=>{
 let store=openRequestStore();
 try{
 const r=store.create({actor_id:'A',email:'Synthetic request: please review this campaign.',timezone:'UTC',idempotency_key:'create'}).request;
 const c=()=>storedRoutingCase(store,'A',r.id);
 const choice=(destination,key)=>({actor_id:'A',request_id:r.id,expected_revision:store.get('A',r.id).revision,expected_scope_token:managerDecisionToken(c()),expected_assignment_id:store.get('A',r.id).agent_assignment?.id??null,destination,idempotency_key:key});
 const first=choice('internal','internal');store.assignAgent(first);store.assignAgent(first);
 assert.equal(store.get('A',r.id).agent_assignment_history.length,1);
 assert.equal(caseHandoff(c()).destination,'internal');assert.equal(eligibleHandoffs(c()).length,1);assert.deepEqual(eligibleLanes(c()).allowed,['manager']);assert.equal(canRunCoordinator(c()),false);
 assert.match(managerDraft(c(),{lane:'manager',reason:'Selected from Cases.',escalation_trigger:'Manual Internal Review requested'}).body,/additional checks/);
 assert.equal(store.get('A',r.id).messages.length,1);assert.equal(store.get('A',r.id).revision,0);
 assert.throws(()=>store.assignAgent({...first,idempotency_key:'concurrent'}),/REVISION_CONFLICT/);
 const state=store.exportState();store.close();store=openRequestStore(':memory:',{initialState:state});assert.equal(caseHandoff(c()).destination,'internal');
 store.assignAgent(choice('coordinator','coordinator'));
 assert.equal(caseHandoff(c()).destination,'coordinator');assert.deepEqual(eligibleLanes(c()).allowed,['coordinator']);assert.equal(eligibleHandoffs(c()).length,1);
 assert.throws(()=>store.assignAgent({...choice('internal','foreign'),actor_id:'B'}),/NOT_FOUND/);
 store.assignAgent(choice('internal','internal-again'));
 store.recordManagerDecision({actor_id:'A',request_id:r.id,expected_revision:0,expected_scope_token:managerDecisionToken(c()),manager_name:'Synthetic Manager',notes:'Continue coordination.',decision:'return_to_coordinator',idempotency_key:'manager'});
 assert.equal(caseHandoff(c()).destination,'coordinator');
 store.assignAgent(choice('internal','new-review-after-decision'));
 assert.equal(caseHandoff(c()).destination,'internal');
 store.appendReply({actor_id:'A',request_id:r.id,expected_revision:1,text:'The client changed the request.',idempotency_key:'reply'});
 assert.equal(caseHandoff(c()).destination,'coordinator');
 store.setCompleted({actor_id:'A',request_id:r.id,expected_revision:2,completed:true,idempotency_key:'complete'});
 assert.throws(()=>store.assignAgent(choice('internal','closed')),/REVIEW_NOT_READY/);
 }finally{store.close();}
});
test('manual selection saves the chosen agent before navigation and refuses stale case views',async()=>{
 const calls=[];
 const fetchImpl=async(url,options)=>{calls.push([url,options]);return Response.json(url.startsWith('/api/review-email')?{revision:2,fingerprint:'current',manager_decision_token:'scope',agent_assignment_id:'previous'}:{request:{id:'case'}});};
 assert.equal(await selectCaseAgent('case','internal',{fingerprint:'current',fetchImpl}),'/internal?request=case');
 assert.deepEqual(JSON.parse(calls[1][1].body),{action:'assign_agent',request_id:'case',expected_revision:2,expected_scope_token:'scope',expected_assignment_id:'previous',destination:'internal',idempotency_key:JSON.parse(calls[1][1].body).idempotency_key});
 assert.ok(JSON.parse(calls[1][1].body).idempotency_key);
 calls.length=0;await assert.rejects(selectCaseAgent('case','coordinator',{fingerprint:'outdated',fetchImpl}),/case changed/);assert.equal(calls.length,1);
});
