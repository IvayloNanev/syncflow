import test from 'node:test';
import assert from 'node:assert/strict';
import {openRequestStore} from '../requests/store.js';

test('deleting hides a case, preserves its history, and permits restore after reopening storage',()=>{
 const store=openRequestStore();
 try{
  const {request}=store.create({actor_id:'owner',idempotency_key:'create',email:'Client enquiry',timezone:'UTC',recording_id:null});
  const input={actor_id:'owner',request_id:request.id,expected_revision:0,deleted:true,idempotency_key:'delete'};
  assert.throws(()=>store.setDeleted({...input,actor_id:'other'}),/NOT_FOUND/);
  assert.throws(()=>store.setDeleted({...input,expected_revision:1}),/REVISION_CONFLICT/);
  store.setDeleted(input);
  assert.equal(store.list('owner').length,0);
  assert.equal(store.list('owner',true).length,1);
  assert.deepEqual(store.get('owner',request.id).messages,request.messages);
  assert.equal(store.setDeleted(input).replayed,true);
  const reopened=openRequestStore(':memory:',{initialState:store.exportState()});
  try{
   assert.equal(reopened.list('owner').length,0);
   reopened.setDeleted({...input,deleted:false,idempotency_key:'restore'});
   assert.equal(reopened.list('owner').length,1);
   assert.equal(reopened.get('owner',request.id).deleted_at,null);
   assert.deepEqual(reopened.history('owner',request.id),store.history('owner',request.id));
  }finally{reopened.close();}
 }finally{store.close();}
});
