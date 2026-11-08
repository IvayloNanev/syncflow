import test from 'node:test';
import assert from 'node:assert/strict';
import {clientFile,clientGroups} from '../requests/client-history.js';
test('opening a filtered client returns completed and active cases from the full saved history',()=>{
 const cases=[{id:'a',contact:'Alex',project:'Current campaign',status:'Needs clarification',message_count:2},{id:'b',contact:'Alex',project:'Previous campaign',status:'Internal review complete',message_count:3},{id:'c',contact:'Priya',message_count:1}];
 const visible=clientGroups(cases.filter(r=>r.status==='Needs clarification'));
 const file=clientFile(cases,visible[0].key);
 assert.deepEqual(file.requests.map(r=>r.id),['a','b']);assert.equal(file.message_count,5);assert.equal(clientFile(cases,'missing'),null);
});
