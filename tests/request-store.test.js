import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openRequestStore} from '../requests/store.js';
const input=()=>({actor_id:'owner-A',idempotency_key:'create-1',email:'Exact original email.\nSecond line.',timezone:'America/New_York'});
const error=code=>e=>e.code===code;
const setup=t=>{const s=openRequestStore();t.after(()=>s.close());return s;};
test('request and reply survive close/reopen with exact source and atomic audit history',t=>{
 const dir=mkdtempSync(join(tmpdir(),'syncflow-test-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'requests.sqlite');
 let s=openRequestStore(path);const c=s.create(input()).request;
 s.appendReply({actor_id:'owner-A',request_id:c.id,idempotency_key:'reply-1',expected_revision:0,text:'Exact reply\nunchanged.'});s.close();
 s=openRequestStore(path);t.after(()=>s.close());const r=s.get('owner-A',c.id);
 assert.equal(r.revision,1);assert.equal(r.messages[0].text,input().email);assert.equal(r.messages[1].text,'Exact reply\nunchanged.');
 assert.deepEqual(s.history('owner-A',c.id).map(e=>e.action),['request_created','reply_appended']);
 assert.equal(s.context('owner-A',c.id).base_record_version,1);
});
test('repeated commands return original response and do not append twice',t=>{
 const s=setup(t);const a=s.create(input());const b=s.create({...input()});assert.equal(b.replayed,true);assert.deepEqual(b.request,a.request);
 const cmd={actor_id:'owner-A',request_id:a.request.id,idempotency_key:'reply-1',expected_revision:0,text:'Reply'};
 const first=s.appendReply(cmd);const replay=s.appendReply(cmd);assert.equal(replay.replayed,true);assert.deepEqual(replay.request,first.request);
 assert.equal(s.get('owner-A',a.request.id).messages.length,2);assert.equal(s.history('owner-A',a.request.id).length,2);
 assert.throws(()=>s.appendReply({...cmd,text:'Different'}),error('IDEMPOTENCY_CONFLICT'));
});
test('same key with changed creation payload fails without creating extra request',t=>{
 const s=setup(t);s.create(input());assert.throws(()=>s.create({...input(),email:'Different'}),error('IDEMPOTENCY_CONFLICT'));assert.equal(s.list('owner-A').length,1);
});
test('stale revision fails without appending a message or audit event',t=>{
 const s=setup(t);const r=s.create(input()).request;
 const cmd={actor_id:'owner-A',request_id:r.id,idempotency_key:'reply',expected_revision:0,text:'Reply'};
 s.appendReply(cmd);assert.throws(()=>s.appendReply({...cmd,idempotency_key:'stale'}),error('REVISION_CONFLICT'));
 assert.equal(s.get('owner-A',r.id).revision,1);assert.equal(s.history('owner-A',r.id).length,2);
});
test('owner boundary prevents another trusted actor reading or changing a record',t=>{
 const s=setup(t);const r=s.create(input()).request;
 for(const fn of [()=>s.get('owner-B',r.id),()=>s.history('owner-B',r.id),()=>s.context('owner-B',r.id),()=>s.appendReply({actor_id:'owner-B',request_id:r.id,idempotency_key:'x',expected_revision:0,text:'x'})])assert.throws(fn,error('NOT_FOUND'));
 assert.deepEqual(s.list('owner-B'),[]);assert.equal(s.get('owner-A',r.id).revision,0);
});
test('input cannot inject confirmed fields, revision, actor or approval state',t=>{
 const s=setup(t);
 for(const extra of [{confirmed_fields:[]},{revision:10},{approved:true},{id:'chosen'}])assert.throws(()=>s.create({...input(),...extra}),error('INVALID_INPUT'));
 assert.throws(()=>s.create({...input(),timezone:'bad-zone'}),error('INVALID_TIMEZONE'));
 assert.throws(()=>s.create({...input(),email:' '.repeat(3)}),error('INVALID_INPUT'));
 assert.throws(()=>s.create({...input(),email:'x'.repeat(20001)}),error('INVALID_INPUT'));
 assert.equal(s.list('owner-A').length,0);
});
test('returned snapshots cannot mutate saved state; context strips database-only metadata',t=>{
 const s=setup(t);const r=s.create(input()).request;r.messages[0].text='tampered';
 const c=s.context('owner-A',r.id,'run-local');assert.equal(c.messages[0].text,input().email);assert.equal(c.run_id,'run-local');assert.equal(c.messages[0].received_at,undefined);
 c.messages.length=0;assert.equal(s.context('owner-A',r.id).messages.length,1);
});
test('two database handles cannot overwrite the same revision',t=>{
 const dir=mkdtempSync(join(tmpdir(),'syncflow-concurrent-'));const path=join(dir,'test.sqlite');const a=openRequestStore(path),b=openRequestStore(path);
 t.after(()=>{a.close();b.close();rmSync(dir,{recursive:true,force:true});});const r=a.create(input()).request;
 a.appendReply({actor_id:'owner-A',request_id:r.id,idempotency_key:'a',expected_revision:0,text:'Reply A'});
 assert.throws(()=>b.appendReply({actor_id:'owner-A',request_id:r.id,idempotency_key:'b',expected_revision:0,text:'Reply B'}),error('REVISION_CONFLICT'));
 assert.equal(b.get('owner-A',r.id).messages.length,2);
});

test('case completion is audited, persists in the aggregate and can be reopened without granting approval',t=>{const s=setup(t),created=s.create(input()).request;const command={actor_id:'owner-A',request_id:created.id,expected_revision:0,completed:true,idempotency_key:'complete-case-1'};s.setCompleted(command);assert.equal(s.workflow('owner-A',created.id).status,'Case completed');assert.ok(s.get('owner-A',created.id).completed_at);assert.equal(s.setCompleted(command).replayed,true);assert.ok(s.history('owner-A',created.id).some(e=>e.action==='case_completed'));assert.throws(()=>s.setCompleted({...command,actor_id:'other',idempotency_key:'foreign'}));s.setCompleted({...command,completed:false,idempotency_key:'reopen-case-1'});assert.notEqual(s.workflow('owner-A',created.id).status,'Case completed');assert.equal(s.get('owner-A',created.id).completed_at,null);});
