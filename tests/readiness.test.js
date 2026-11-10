import test from 'node:test';
import assert from 'node:assert/strict';
import {requestReadiness,requiredFields} from '../requests/readiness.js';
import {openRequestStore} from '../requests/store.js';
const request={id:'demo',revision:4,recording_id:'TRACK-0002',confirmed_fields:requiredFields.map(field_key=>({field_key,state:'confirmed'}))};
const analysis={run_id:'run',base_revision:4,result:{ok:true,stages:{review:{output:{issues:[]}}}}};
const tracking={version:2,reviewers:[{status:'Approved',needs_reconfirmation:false}]};
const briefApproval={version:1,request_revision:4,analysis_run_id:'run',approved_by:'A',approved_at:'2026-11-08T12:00:00Z'};
const check=extra=>requestReadiness({request,analysis,tracking,briefApproval,...extra});
test('readiness requires confirmed fields, current analysis, identity and any recorded reviewer decisions',()=>{
  assert.equal(check({}).can_complete,true);
  assert.equal(check({tracking:{version:0,reviewers:[]},briefApproval:null}).can_complete,true);
  for(const input of [{analysis:null},{analysis:{...analysis,base_revision:3}},{request:{...request,recording_id:null}},{request:{...request,confirmed_fields:[]}},{tracking:{...tracking,reviewers:[{status:'Approved',needs_reconfirmation:true}]}},{tracking:{...tracking,reviewers:[{status:'Pending'}]}},{tracking:{...tracking,reviewers:[{status:'Declined'}]}},{tracking:{...tracking,reviewers:[{status:'Changes requested'}]}}]) assert.equal(check(input).can_complete,false);
  assert.equal(check({analysis:{...analysis,result:{ok:true,stages:{review:{output:{issues:[{question:'Missing term'}]}}}}}}).can_complete,false);
});
test('completion is revision-bound, reviewer-version-bound and distinct from licence approval',()=>{
  const completion={brief_approval_version:1,request_revision:4,review_version:2,completed_by:'human'};
  assert.equal(check({completion}).status,'Internal review complete');
  assert.equal(check({completion}).can_complete,false);
  assert.equal(check({completion:{...completion,request_revision:3}}).completion.needs_reconfirmation,true);
  assert.equal(check({completion:{...completion,review_version:1}}).completed,false);
});
test('store blocks incomplete review completion, isolates owners and leaves audit unchanged',()=>{
  const store=openRequestStore();try{
    const r=store.create({actor_id:'A',email:'Demo',timezone:'UTC',idempotency_key:'create'}).request;
    assert.equal(store.workflow('A',r.id).status,'Needs analysis');
    assert.throws(()=>store.completeReview({actor_id:'A',request_id:r.id,expected_revision:0,expected_review_version:0,idempotency_key:'complete'}),/REVIEW_NOT_READY/);
    assert.throws(()=>store.workflow('B',r.id),/NOT_FOUND/);
    assert.equal(store.workflow('A',r.id).history.length,0);
    assert.equal(store.get('A',r.id).revision,0);
  } finally {store.close();}
});


test('confirmed version mismatch blocks readiness even with every fact and reviewer approved',()=>{
 const changed={...request,confirmed_fields:request.confirmed_fields.map(f=>({...f,...(f.field_key==='recording_version'?{value:'Original recording'}:{})}))};
 assert.equal(check({request:changed}).status,'Recording mismatch');assert.equal(check({request:changed}).can_complete,false);
});
