import test from 'node:test';
import assert from 'node:assert/strict';
import {clientGroups} from '../requests/client-history.js';
test('client history groups exact contact labels, preserves requests and sorts latest first',()=>{
 const requests=[{id:'old',contact:' Alex Chen ',message_count:1,updated_at:'2026-11-01'},{id:'new',contact:'alex chen',message_count:3,updated_at:'2026-11-07'},{id:'other',contact:'Alex Chen, Another Agency',message_count:2,updated_at:'2026-11-06'}];
 const groups=clientGroups(requests);assert.equal(groups.length,2);assert.equal(groups[0].message_count,4);assert.deepEqual(groups[0].requests.map(r=>r.id),['new','old']);assert.equal(groups[0].updated_at,'2026-11-07');assert.equal(requests[0].id,'old');
});
test('unidentified clients stay separate instead of combining unrelated history',()=>{
 const groups=clientGroups([{id:'a',contact:null,message_count:1},{id:'b',contact:' ',message_count:2}]);assert.equal(groups.length,2);assert.ok(groups.every(g=>!g.identified));assert.equal(clientGroups([]).length,0);
});

test('briefing preserves priority over recency and orders a client by its highest priority case',async()=>{
 const {priorityClientGroups}=await import('../requests/client-history.js');
 const cases=[{id:'new',contact:'New client',updated_at:'2026-11-09'},{id:'old',contact:'Urgent client',updated_at:'2026-11-01'},{id:'another',contact:'Urgent client',updated_at:'2026-11-10'},{id:'done',contact:'Completed client',updated_at:'2026-11-11'}];
 const groups=priorityClientGroups(cases,[{request_id:'old'},{request_id:'new'},{request_id:'another'}]);
 assert.deepEqual(groups.map(g=>g.name),['Urgent client','New client']);
 assert.deepEqual(groups[0].requests.map(r=>r.id),['old','another']);
 assert.equal(cases[0].id,'new');
});
test('only a saved pending internal review is classified as waiting',async()=>{
 const {priorityActionState}=await import('../requests/client-history.js');
 assert.equal(priorityActionState({status:'Internal review pending'}),'waiting');
 for(const status of ['Needs analysis','Needs clarification','Changes requested','Ready for internal review','Ready to complete internal review'])assert.equal(priorityActionState({status}),'action');
 assert.equal(priorityActionState(undefined),'action');
});
