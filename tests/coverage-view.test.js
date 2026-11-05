import test from 'node:test';
import assert from 'node:assert/strict';
import {coverageRows} from '../catalog/coverage-view.js';
const base={email:'Territory: United States',analyzed:false,stale:true,proposals:[],confirmed:[{field_key:'territories',state:'confirmed',value:['Canada']}],issues:[]};
test('stale preview cannot replace a confirmed territory or badge detected text as confirmed',()=>{
  const row=coverageRows(base).find(r=>r.key==='territories');
  assert.deepEqual(row.value,['Canada']);
  assert.equal(row.source,'confirmed');
  const detected=coverageRows({...base,confirmed:[]}).find(r=>r.key==='territories');
  assert.equal(detected.source,'detected');
  assert.notDeepEqual(detected.value,['Canada']);
});
test('pending change preserves current confirmed value and separately exposes proposed value',()=>{
  const row=coverageRows({...base,analyzed:true,stale:false,proposals:[{field_key:'territories',proposed_value:['United States']}]}).find(r=>r.key==='territories');
  assert.deepEqual(row.value,['Canada']);
  assert.deepEqual(row.proposal,['United States']);
  assert.equal(row.changed,true);
  assert.equal(row.state,'attention');
});
test('blank request has no misleading missing-data checklist; new proposed data stays unconfirmed',()=>{
  assert.deepEqual(coverageRows({...base,email:' ',confirmed:[]}),[]);
  const row=coverageRows({...base,confirmed:[],analyzed:true,stale:false,proposals:[{field_key:'territories',proposed_value:['United States']}]}).find(r=>r.key==='territories');
  assert.equal(row.source,'proposed');
  assert.deepEqual(row.value,['United States']);
});
