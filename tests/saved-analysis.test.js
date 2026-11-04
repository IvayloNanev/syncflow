import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openRequestStore} from '../requests/store.js';import {analyzeSavedRequest} from '../requests/analyze-saved.js';import {runWorkflow} from '../agents/workflow/run-workflow.js';import {createFollowUpMockProvider} from '../agents/follow-up/providers/mock.js';
const setup=t=>{const s=openRequestStore();t.after(()=>s.close());const r=s.create({actor_id:'A',idempotency_key:'create',email:'Contact: Fictional Coordinator.',timezone:'UTC'}).request;return {s,r};};
const cmd=r=>({actor_id:'A',request_id:r.id,expected_revision:0,idempotency_key:'analysis-1'});
const providers=()=>({intakeProvider:{id:'test',mode:'mock',generate:async({context})=>({schema_version:'1.0',run_id:context.run_id,base_record_version:context.base_record_version,proposed_changes:[],ambiguities:[]})},followUpProvider:createFollowUpMockProvider()});
const code=c=>e=>e.code===c;
test('analysis is stored separately and never confirms facts or resolves issues',async t=>{
 const {s,r}=setup(t);const before=s.get('A',r.id);const a=await analyzeSavedRequest(s,cmd(r),providers());
 assert.equal(a.analysis.status,'completed');assert.equal(s.activeAnalysis('A',r.id).run_id,a.analysis.run_id);
 assert.deepEqual(s.get('A',r.id),before);assert.equal(s.history('A',r.id).length,1);
 assert.equal(s.analyses('A',r.id).length,1);assert.equal(a.analysis.result.stages.follow_up.ok,true);
});
test('same command replay avoids provider calls and changed revision key reuse is rejected',async t=>{
 const {s,r}=setup(t);let calls=0;const p=providers();const generate=p.intakeProvider.generate;p.intakeProvider.generate=async args=>{calls++;return generate(args);};
 const a=await analyzeSavedRequest(s,cmd(r),p);const b=await analyzeSavedRequest(s,cmd(r),p);
 assert.equal(calls,1);assert.equal(b.replayed,true);assert.equal(a.analysis.run_id,b.analysis.run_id);
 assert.throws(()=>s.beginAnalysis({...cmd(r),expected_revision:1}),code('IDEMPOTENCY_CONFLICT'));
});
test('in-progress replay returns running without starting another model call',async t=>{
 const {s,r}=setup(t);s.beginAnalysis(cmd(r));let calls=0;const p=providers();p.intakeProvider.generate=async()=>{calls++;};
 const a=await analyzeSavedRequest(s,cmd(r),p);assert.equal(a.analysis.status,'running');assert.equal(calls,0);
});
test('reply during model call makes result stale and never active',async t=>{
 const {s,r}=setup(t);let entered,release;const ready=new Promise(resolve=>{entered=resolve;});const wait=new Promise(resolve=>{release=resolve;});
 const p=providers(),generate=p.intakeProvider.generate;p.intakeProvider.generate=async args=>{entered();await wait;return generate(args);};
 const pending=analyzeSavedRequest(s,cmd(r),p);await ready;
 s.appendReply({actor_id:'A',request_id:r.id,idempotency_key:'reply',expected_revision:0,text:'Scope changed.'});release();
 const a=await pending;assert.equal(a.analysis.status,'stale');assert.equal(s.activeAnalysis('A',r.id),null);assert.equal(s.get('A',r.id).revision,1);
});
test('atomic activation rejects result computed before a later reply',async t=>{
 const {s,r}=setup(t);const a=s.beginAnalysis(cmd(r)).analysis;const result=await runWorkflow(a.context,providers());
 s.appendReply({actor_id:'A',request_id:r.id,idempotency_key:'reply',expected_revision:0,text:'Updated scope.'});
 assert.equal(s.finishAnalysis({actor_id:'A',request_id:r.id,run_id:a.run_id,result}).status,'stale');assert.equal(s.activeAnalysis('A',r.id),null);
});
test('late older run cannot supersede a newer run at same revision',async t=>{
 const {s,r}=setup(t);const old=s.beginAnalysis(cmd(r)).analysis;const newer=s.beginAnalysis({...cmd(r),idempotency_key:'analysis-2'}).analysis;
 const resultNew=await runWorkflow(newer.context,providers());const resultOld=await runWorkflow(old.context,providers());
 s.finishAnalysis({actor_id:'A',request_id:r.id,run_id:newer.run_id,result:resultNew});
 assert.equal(s.finishAnalysis({actor_id:'A',request_id:r.id,run_id:old.run_id,result:resultOld}).status,'superseded');assert.equal(s.activeAnalysis('A',r.id).run_id,newer.run_id);
});
test('provider failure preserves previous active result and stores only safe failure',async t=>{
 const {s,r}=setup(t);const good=await analyzeSavedRequest(s,cmd(r),providers());const p=providers();p.intakeProvider.generate=async()=>{throw Error('private raw provider error');};
 const bad=await analyzeSavedRequest(s,{...cmd(r),idempotency_key:'failed'},p);
 assert.equal(bad.analysis.status,'failed');assert.equal(s.activeAnalysis('A',r.id).run_id,good.analysis.run_id);assert.ok(!JSON.stringify(bad).includes('private raw provider error'));
});
test('invalid output cannot be activated or supply agent approval',async t=>{
 const {s,r}=setup(t);const a=s.beginAnalysis(cmd(r)).analysis;const result=await runWorkflow(a.context,providers());result.approved=true;
 assert.throws(()=>s.finishAnalysis({actor_id:'A',request_id:r.id,run_id:a.run_id,result}),code('INVALID_ANALYSIS'));assert.equal(s.activeAnalysis('A',r.id),null);
});
test('analysis history is owner-bound and survives database reopen',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'syncflow-analysis-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'test.sqlite');
 let s=openRequestStore(path);const r=s.create({actor_id:'A',idempotency_key:'create',email:'Fictional request.',timezone:'UTC'}).request;
 const a=await analyzeSavedRequest(s,cmd(r),providers());s.close();s=openRequestStore(path);t.after(()=>s.close());
 assert.equal(s.activeAnalysis('A',r.id).run_id,a.analysis.run_id);assert.equal(s.analyses('A',r.id).length,1);
 assert.throws(()=>s.analysis('B',r.id,a.analysis.run_id),code('NOT_FOUND'));assert.throws(()=>s.analyses('B',r.id),code('NOT_FOUND'));
 const b=await analyzeSavedRequest(s,cmd(r),providers());assert.equal(b.replayed,true);
});

test('reply invalidates completed active analysis without deleting its result',async t=>{
 const {s,r}=setup(t);const a=await analyzeSavedRequest(s,cmd(r),providers());
 s.appendReply({actor_id:'A',request_id:r.id,idempotency_key:'reply',expected_revision:0,text:'New reply.'});
 assert.equal(s.activeAnalysis('A',r.id),null);const old=s.analysis('A',r.id,a.analysis.run_id);
 assert.equal(old.status,'stale');assert.equal(old.result.ok,true);assert.equal(old.base_revision,0);
});
