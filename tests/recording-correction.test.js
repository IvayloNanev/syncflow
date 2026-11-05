import test from 'node:test';import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openRequestStore} from '../requests/store.js';import {recordingMismatches} from '../catalog/identity-check.js';

test('recording correction preserves thread/facts, records audit, invalidates reviews/handoff and replays once',()=>{
 const store=openRequestStore();try{
  const r=store.create({actor_id:'A',email:'Original email',timezone:'UTC',recording_id:'TRACK-0001',idempotency_key:'create'}).request;
  store.recordReview({actor_id:'A',request_id:r.id,expected_revision:0,expected_review_version:0,operation:'assign',name:'Reviewer',role:'Director',idempotency_key:'assign'});
  const reviewer=store.reviewers('A',r.id).reviewers[0];store.recordReview({actor_id:'A',request_id:r.id,expected_revision:0,expected_review_version:1,operation:'decision',reviewer_id:reviewer.id,status:'Approved',notes:'Demo',idempotency_key:'decision'});
  store.saveHandoff({actor_id:'A',request_id:r.id,expected_revision:0,expected_handoff_version:0,source_token:store.handoff('A',r.id).source_token,text:'Draft',idempotency_key:'summary'});
  const command={actor_id:'A',request_id:r.id,expected_revision:0,recording_id:'TRACK-0002',reason:'Client requested instrumental',idempotency_key:'correction'};
  store.changeRecording(command);store.changeRecording(command);
  const changed=store.get('A',r.id);assert.equal(changed.revision,1);assert.equal(changed.recording_id,'TRACK-0002');assert.deepEqual(changed.messages,r.messages);assert.deepEqual(changed.confirmed_fields,r.confirmed_fields);
  assert.equal(store.reviewers('A',r.id).reviewers[0].needs_reconfirmation,true);assert.equal(store.handoff('A',r.id).latest.outdated,true);
  assert.equal(store.history('A',r.id).filter(e=>e.action==='recording_corrected').length,1);
  assert.throws(()=>store.changeRecording({...command,idempotency_key:'stale'}),/REVISION_CONFLICT/);
  assert.throws(()=>store.changeRecording({...command,actor_id:'B',idempotency_key:'foreign'}),/NOT_FOUND/);
  assert.throws(()=>store.changeRecording({...command,expected_revision:1,recording_id:'FAKE',idempotency_key:'invalid'}),/INVALID_RECORDING/);
  assert.throws(()=>store.changeRecording({...command,expected_revision:1,reason:' ',idempotency_key:'empty'}),/INVALID_RECORDING_CHANGE/);
 } finally{store.close();}
});
test('recording mismatch guard checks confirmed identity without importing metadata as client facts',()=>{
 const request={recording_id:'TRACK-0002',confirmed_fields:[{field_key:'artist',state:'confirmed',value:'Maya Rivers'},{field_key:'track_title',state:'confirmed',value:'Northern Lights'},{field_key:'recording_version',state:'confirmed',value:'instrumental recording'}]};
 assert.deepEqual(recordingMismatches(request),[]);
 assert.deepEqual(recordingMismatches({...request,recording_id:'TRACK-0001'}),['recording_version']);
});
test('failed correction audit rolls back recording, revision and retry command',t=>{
 const dir=mkdtempSync(join(tmpdir(),'syncflow-correction-'));const path=join(dir,'store.sqlite');const store=openRequestStore(path);const fault=new DatabaseSync(path);
 t.after(()=>{fault.close();store.close();rmSync(dir,{recursive:true,force:true});});
 const r=store.create({actor_id:'A',email:'Original',timezone:'UTC',idempotency_key:'create'}).request;
 fault.exec("CREATE TRIGGER fail_recording BEFORE INSERT ON events WHEN json_extract(NEW.body,'$.action')='recording_corrected' BEGIN SELECT RAISE(ABORT,'test audit failure'); END");
 const command={actor_id:'A',request_id:r.id,expected_revision:0,recording_id:'TRACK-0002',reason:'Resolved identity',idempotency_key:'correct'};
 assert.throws(()=>store.changeRecording(command),/STORE_FAILED/);assert.deepEqual(store.get('A',r.id),r);
 fault.exec('DROP TRIGGER fail_recording');store.changeRecording(command);assert.equal(store.get('A',r.id).revision,1);
});
