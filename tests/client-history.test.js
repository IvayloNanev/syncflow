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
