import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveFields} from '../requests/effective-fields.js';
import {requestReadiness,requiredFields} from '../requests/readiness.js';
import {buildHandoffSummary} from '../handoff/build-summary.js';
const request={id:'auto',revision:0,recording_id:'TRACK-0002',confirmed_fields:[],messages:[{message_id:'msg',text:'Fictional source'}]};
const proposals=requiredFields.map(field_key=>({proposal_id:field_key,field_key,proposed_value:({artist:'Maya Rivers',track_title:'Northern Lights',recording_version:'Instrumental'})[field_key]||'Fictional value',evidence:[{message_id:'msg',exact_quote:'Fictional source'}]}));
const analysis={run_id:'run',base_revision:0,result:{ok:true,stages:{intake:{output:{proposed_changes:proposals}},review:{output:{issues:[]}}}}};
const tracking={version:0,reviewers:[]};
test('complete current extraction needs no per-field confirmation without hidden approval or reviewer requirements',()=>{
 const before=JSON.stringify(request);const fields=effectiveFields(request,analysis);
 assert.equal(fields.length,12);assert.ok(fields.every(f=>f.state==='agent_extracted'));
 const ready=requestReadiness({request,analysis,tracking});assert.equal(ready.intake_ready,true);assert.equal(ready.can_complete,true);assert.equal(ready.status,'Ready for coordination');assert.equal(ready.can_approve_brief,true);
 assert.equal(requestReadiness({request,analysis,tracking:{version:1,reviewers:[{status:'Approved',needs_reconfirmation:false}]}}).can_complete,true);
 assert.equal(requestReadiness({request,analysis,briefApproval:{version:1,request_revision:0,analysis_run_id:'run'},tracking:{version:1,reviewers:[{status:'Approved',needs_reconfirmation:false}]}}).can_complete,true);
 assert.equal(JSON.stringify(request),before);
});
test('stale failed blocked rejected and evidence-free extraction cannot fill missing details',()=>{
 assert.equal(effectiveFields(request,{...analysis,base_revision:1}).length,0);
 assert.equal(effectiveFields(request,{...analysis,result:{ok:false}}).length,0);
 const rejected=[{run_id:'run',proposal_id:'project',decision:'reject'}];assert.equal(effectiveFields(request,analysis,rejected).length,11);
 const conflict=structuredClone(analysis);conflict.result.stages.review.output.issues=[{field_keys:['budget'],question:'Which rights?'}];assert.equal(effectiveFields(request,conflict).length,11);assert.equal(requestReadiness({request,analysis:conflict,tracking}).intake_ready,false);
 const noEvidence=structuredClone(analysis);noEvidence.result.stages.intake.output.proposed_changes[0].evidence=[];assert.equal(effectiveFields(request,noEvidence).length,11);
});
test('handoff uses source-backed automatic fields with explicit provenance and omits stale extraction',()=>{
 const agent_fields=effectiveFields(request,analysis);const text=buildHandoffSummary({request:{...request,agent_fields},analysisCurrent:true});
 assert.match(text,/Track title: Northern Lights/);assert.match(text,/Agent-extracted · run run · not human-confirmed/);assert.match(text,/Source msg: Fictional source/);
 assert.doesNotMatch(buildHandoffSummary({request:{...request,agent_fields},analysisCurrent:false}),/Track title: Northern Lights/);
});
test('automatic identity mismatch blocks internal readiness',()=>{
 const mismatch=structuredClone(analysis);mismatch.result.stages.intake.output.proposed_changes.find(p=>p.field_key==='recording_version').proposed_value='Original';
 assert.equal(requestReadiness({request,analysis:mismatch,tracking}).status,'Recording mismatch');
});

test('saved automatic intake completes internal review without field decisions and invalidates approvals when extraction changes',async()=>{
 const {readFileSync}=await import('node:fs');const {openRequestStore}=await import('../requests/store.js');const {analyzeSavedRequest}=await import('../requests/analyze-saved.js');const {createFollowUpMockProvider}=await import('../agents/follow-up/providers/mock.js');
 const fixture=JSON.parse(readFileSync(new URL('../fixtures/development/complete.json',import.meta.url),'utf8').replaceAll('Artist A','Maya Rivers').replaceAll('Track X','Northern Lights'));
 const email=fixture.context.messages[0].text.replace('November 6, 2026.','November 6, 2026 at 17:00 America/Toronto.');
 const deadline=fixture.intake.proposed_changes.find(p=>p.field_key==='response_deadline');deadline.proposed_value={supplied_text:'November 6, 2026 at 17:00 America/Toronto',date:'2026-11-06',time:'17:00',timezone:'America/Toronto'};deadline.evidence[0].exact_quote=deadline.proposed_value.supplied_text;
 const store=openRequestStore();let omitProject=false;
 try{
 const r=store.create({actor_id:'A',email,timezone:'UTC',recording_id:'TRACK-0001',idempotency_key:'create'}).request;
 const providers={intakeProvider:{id:'auto-test',mode:'mock',generate:async({context})=>({...structuredClone(fixture.intake),run_id:context.run_id,base_record_version:context.base_record_version,proposed_changes:fixture.intake.proposed_changes.filter(p=>!omitProject||p.field_key!=='project').map(p=>({...p,evidence:p.evidence.map(e=>({...e,message_id:context.messages[0].message_id}))}))})},followUpProvider:createFollowUpMockProvider()};
 const analyze=key=>analyzeSavedRequest(store,{actor_id:'A',request_id:r.id,expected_revision:0,idempotency_key:key},providers);
 await analyze('first');assert.equal(store.workflow('A',r.id).intake_ready,true);assert.equal(store.get('A',r.id).confirmed_fields.length,0);assert.equal(store.decisions('A',r.id).length,0);
 store.recordReview({actor_id:'A',request_id:r.id,expected_revision:0,expected_review_version:0,operation:'assign',name:'Morgan',role:'Director',idempotency_key:'assign'});
 const reviewer=store.reviewers('A',r.id).reviewers[0];store.recordReview({actor_id:'A',request_id:r.id,expected_revision:0,expected_review_version:1,operation:'decision',reviewer_id:reviewer.id,status:'Approved',notes:'Reviewed automatic source-backed summary',idempotency_key:'approve'});
 assert.equal(store.workflow('A',r.id).can_complete,true);
 store.approveBrief({actor_id:'A',request_id:r.id,expected_revision:0,analysis_run_id:store.activeAnalysis('A',r.id).run_id,idempotency_key:'brief-first'});
 assert.equal(store.workflow('A',r.id).can_complete,true);
 await analyze('same');assert.equal(store.reviewers('A',r.id).reviewers[0].needs_reconfirmation,false);
 assert.equal(store.workflow('A',r.id).brief_approved,false);
 store.approveBrief({actor_id:'A',request_id:r.id,expected_revision:0,analysis_run_id:store.activeAnalysis('A',r.id).run_id,idempotency_key:'brief-same'});
 store.completeReview({actor_id:'A',request_id:r.id,expected_revision:0,expected_review_version:2,idempotency_key:'complete'});assert.equal(store.workflow('A',r.id).completed,true);
 omitProject=true;await analyze('changed');assert.equal(store.reviewers('A',r.id).reviewers[0].needs_reconfirmation,true);assert.equal(store.workflow('A',r.id).completed,false);
 }finally{store.close();}
});
