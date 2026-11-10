import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openRequestStore} from '../requests/store.js';
import {analyzeSavedRequest} from '../requests/analyze-saved.js';
import {createFollowUpMockProvider} from '../agents/follow-up/providers/mock.js';
import {createSavedRequestsHandler} from '../server/saved-requests.js';
const fixture=JSON.parse(readFileSync(new URL('../fixtures/development/complete.json',import.meta.url),'utf8').replaceAll('Artist A','Maya Rivers').replaceAll('Track X','Northern Lights'));
const email=fixture.context.messages[0].text.replace('November 6, 2026.','November 6, 2026 at 17:00 America/Toronto.');
const deadline=fixture.intake.proposed_changes.find(p=>p.field_key==='response_deadline');deadline.proposed_value={supplied_text:'November 6, 2026 at 17:00 America/Toronto',date:'2026-11-06',time:'17:00',timezone:'America/Toronto'};deadline.evidence[0].exact_quote=deadline.proposed_value.supplied_text;
const providers=()=>({intakeProvider:{id:'brief-test',mode:'mock',generate:async({context})=>({...structuredClone(fixture.intake),run_id:context.run_id,base_record_version:context.base_record_version,proposed_changes:fixture.intake.proposed_changes.map(p=>({...p,evidence:p.evidence.map(e=>({...e,message_id:context.messages[0].message_id}))}))})},followUpProvider:createFollowUpMockProvider()});
test('one sign-off is audited, persisted, isolated and invalidated by analysis attempts and revisions',async()=>{
 let store=openRequestStore();
 try{
 const r=store.create({actor_id:'A',email,timezone:'UTC',recording_id:'TRACK-0001',idempotency_key:'create'}).request;
 const analyze=key=>analyzeSavedRequest(store,{actor_id:'A',request_id:r.id,expected_revision:0,idempotency_key:key},providers());
 const first=await analyze('first');const input={actor_id:'A',request_id:r.id,expected_revision:0,analysis_run_id:first.analysis.run_id,idempotency_key:'approve'};
 assert.equal(store.workflow('A',r.id).status,'Ready for coordination');
 assert.throws(()=>store.approveBrief({...input,actor_id:'B'}),/NOT_FOUND/);
 assert.throws(()=>store.approveBrief({...input,approved_by:'someone'}),/INVALID_INPUT/);
 assert.throws(()=>store.approveBrief({...input,expected_revision:9}),/REVISION_CONFLICT/);
 store.approveBrief(input);store.approveBrief(input);assert.equal(store.briefApproval('A',r.id).history.length,1);
 assert.equal(store.workflow('A',r.id).status,'Ready for coordination');assert.equal(store.workflow('A',r.id).brief_approval.approved_by,'A');assert.equal(store.get('A',r.id).confirmed_fields.length,0);
 const snapshot=store.exportState();store.close();store=openRequestStore(':memory:',{initialState:snapshot});assert.equal(store.workflow('A',r.id).brief_approved,true);
 const legacy=structuredClone(snapshot);delete legacy.tables.brief_approvals;const old=openRequestStore(':memory:',{initialState:legacy});assert.equal(old.workflow('A',r.id).brief_approved,false);old.close();
 const running=store.beginAnalysis({actor_id:'A',request_id:r.id,expected_revision:0,idempotency_key:'interrupted'});assert.equal(store.workflow('A',r.id).brief_approved,false);assert.equal(store.workflow('A',r.id).can_approve_brief,false);
 store.finishAnalysis({actor_id:'A',request_id:r.id,run_id:running.analysis.run_id,result:{ok:false}});assert.equal(store.workflow('A',r.id).can_approve_brief,false);
 assert.throws(()=>store.approveBrief({...input,idempotency_key:'old-run'}),/BRIEF_ANALYSIS_CONFLICT/);
 const second=await analyze('second');store.approveBrief({...input,analysis_run_id:second.analysis.run_id,idempotency_key:'approve-second'});
 assert.equal(store.briefApproval('A',r.id).history.length,2);
 store.appendReply({actor_id:'A',request_id:r.id,expected_revision:0,text:'Correction: worldwide.',idempotency_key:'reply'});assert.equal(store.workflow('A',r.id).brief_approved,false);assert.equal(store.workflow('A',r.id).brief_approval.outdated,true);
 }finally{store.close();}
});
test('approval API requires the complete current brief and rejects browser-supplied approval claims',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'syncflow-brief-'));const path=join(dir,'requests.sqlite');
 try{
 const handler=createSavedRequestsHandler({actor:'A',enabled:()=>true,openStore:()=>openRequestStore(path),providers});
 const call=async input=>{const response=await handler(new Request('http://127.0.0.1:3000/api/requests',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json'},body:JSON.stringify(input)}));return {status:response.status,...await response.json()};};
 const created=await call({action:'create',email,timezone:'UTC',recording_id:'TRACK-0001',idempotency_key:'create'});const request_id=created.request.id;
 const analyzed=await call({action:'analyze',request_id,expected_revision:0,idempotency_key:'analyze'});
 const input={action:'approve_brief',request_id,expected_revision:0,analysis_run_id:analyzed.active_analysis.run_id,idempotency_key:'approve'};
 assert.equal((await call({...input,approved_by:'forged'})).status,400);assert.equal((await call({...input,analysis_run_id:'wrong'})).status,409);
 const approved=await call(input);assert.equal(approved.status,200);assert.equal(approved.workflow.brief_approved,true);assert.equal(approved.brief_approval_history.length,1);assert.equal(approved.workflow.brief_approval.approved_by,'A');
 const reopened=await call({action:'get',request_id});assert.equal(reopened.workflow.brief_approved,true);
 await call({action:'reply',request_id,expected_revision:0,text:'New client reply.',idempotency_key:'reply'});
 assert.equal((await call({...input,expected_revision:1,idempotency_key:'stale-analysis'})).status,409);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
