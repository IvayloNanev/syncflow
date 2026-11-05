import test from 'node:test';
import assert from 'node:assert/strict';
import {openRequestStore} from '../requests/store.js';

test('reviewer decisions persist, replay safely, reject concurrent edits and invalidate on request changes', () => {
  const store=openRequestStore();
  try {
    const request=store.create({actor_id:'owner',email:'Fictional email',timezone:'UTC',idempotency_key:'create'}).request;
    const base={actor_id:'owner',request_id:request.id,expected_revision:0,expected_review_version:0,operation:'assign',name:'Director Demo',role:'Director',idempotency_key:'assign'};
    store.recordReview(base);store.recordReview(base);
    let tracking=store.reviewers('owner',request.id);
    assert.equal(tracking.reviewers.length,1);assert.equal(tracking.version,1);
    const decision={actor_id:'owner',request_id:request.id,expected_revision:0,expected_review_version:1,operation:'decision',reviewer_id:tracking.reviewers[0].id,status:'Approved',notes:'Reviewed outside app',idempotency_key:'decision'};
    store.recordReview(decision);store.recordReview(decision);
    assert.throws(()=>store.recordReview({...decision,idempotency_key:'concurrent'}),/REVIEW_CONFLICT/);
    tracking=store.reviewers('owner',request.id);
    assert.equal(tracking.history.length,2);assert.equal(tracking.reviewers[0].needs_reconfirmation,false);
    assert.equal(store.get('owner',request.id).revision,0); // reviewing does not invalidate analysis
    store.appendReply({actor_id:'owner',request_id:request.id,expected_revision:0,text:'Actually worldwide.',idempotency_key:'reply'});
    assert.equal(store.reviewers('owner',request.id).reviewers[0].needs_reconfirmation,true);
    assert.throws(()=>store.recordReview({...decision,expected_review_version:2,idempotency_key:'old-revision'}),/REVISION_CONFLICT/);
    store.recordReview({...decision,expected_revision:1,expected_review_version:2,idempotency_key:'reconfirm'});
    assert.equal(store.reviewers('owner',request.id).reviewers[0].needs_reconfirmation,false);
    assert.equal(store.reviewers('owner',request.id).history.length,3);
    assert.throws(()=>store.reviewers('other',request.id),/NOT_FOUND/);
    assert.throws(()=>store.recordReview({...decision,expected_revision:1,expected_review_version:3,status:'Licensed',idempotency_key:'bad'}),/INVALID_REVIEW/);
  } finally {store.close();}
});
