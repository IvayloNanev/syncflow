import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assessCatalogue} from '../catalog/availability.js';
import {runWorkflow} from '../agents/workflow/run-workflow.js';
import {createFollowUpMockProvider} from '../agents/follow-up/providers/mock.js';
import {validateSuccessfulAnalysis} from '../requests/validate-analysis.js';
import {requestReadiness} from '../requests/readiness.js';
const messages=[{text:'I NEED TO USE MICHAEL JAKCSON CATALOGUE'}];
test('the actual catalogue enquiry is flagged even when intake fails to extract its artist',async()=>{
 const f=JSON.parse(readFileSync(new URL('../fixtures/development/incomplete.json',import.meta.url),'utf8'));
 f.context.messages=[{...f.context.messages[0],text:messages[0].text}];f.context.confirmed_fields=[];f.context.unresolved_issues=[];f.intake.proposed_changes=[];f.intake.ambiguities=[];
 const result=await runWorkflow(f.context,{intakeProvider:{id:'test',mode:'mock',generate:async()=>f.intake},followUpProvider:createFollowUpMockProvider()});
 assert.equal(result.ok,true);validateSuccessfulAnalysis(result,f.context);
 const issue=result.stages.review.output.issues.find(i=>i.issue_id==='catalogue-coverage-check');assert.match(issue.question,/No match found/);assert.match(issue.question,/specific song titles/);assert.match(result.stages.follow_up.output.body,/No match found/);assert.doesNotMatch(result.stages.follow_up.output.body,/budget|response deadline|confirm project/i);assert.match(result.stages.follow_up.output.body.split(/\n\s*\n/)[1],/(?:We could not find a match|No match found)/);
 const assessment=assessCatalogue({messages});assert.equal(assessment.status,'not_found');assert.equal(assessment.artist,'MICHAEL JAKCSON');assert.equal(assessment.catalogueWide,true);
 const request={messages,revision:0,confirmed_fields:[],recording_id:null};const analysis={result,base_revision:0,run_id:result.run_id,status:'completed'};
 const workflow=requestReadiness({request,analysis,tracking:{reviewers:[]}});assert.equal(workflow.status,'Not found in catalogue');assert.equal(workflow.can_approve_brief,false);
});
test('known catalogue artists remain requests for specific recordings, not outside-catalogue claims',()=>{
 const result=assessCatalogue({messages:[{text:'Please license Maya Rivers catalogue'}]});assert.equal(result.status,'catalogue_enquiry');assert.match(result.question,/specific songs/);
 const resolved=assessCatalogue({messages:[{text:'Please license Maya Rivers catalogue'}],fields:[{field_key:'artist',value:'Maya Rivers'},{field_key:'track_title',value:'Northern Lights'}]});assert.equal(resolved.status,'candidate');assert.equal(resolved.catalogueWide,false);
});
test('ordinary incomplete requests remain unresolved; structured unknown identities receive a coverage warning',()=>{
 assert.equal(assessCatalogue({messages:[{text:'Please send me more information.'}]}).status,'unresolved');
 assert.equal(assessCatalogue({fields:[{field_key:'artist',value:'Unknown Performer'},{field_key:'track_title',value:'Unknown Song'}]}).status,'not_found');
 assert.equal(assessCatalogue({fields:[{field_key:'artist',value:'Maya Rivers'},{field_key:'track_title',value:'Northern Lights'}]}).status,'candidate');
});

test('music by an outside artist produces a catalogue-first draft, not a nine-question intake',async()=>{
 const f=JSON.parse(readFileSync(new URL('../fixtures/development/incomplete.json',import.meta.url),'utf8'));
 f.context.messages=[{...f.context.messages[0],text:'I want to use music by Michael Jackson.'}];f.context.confirmed_fields=[];f.context.unresolved_issues=[];f.intake.proposed_changes=[];f.intake.ambiguities=[];
 const result=await runWorkflow(f.context,{intakeProvider:{id:'test',mode:'mock',generate:async()=>f.intake},followUpProvider:createFollowUpMockProvider()});
 assert.equal(result.ok,true);validateSuccessfulAnalysis(result,f.context);assert.equal(assessCatalogue({messages:f.context.messages}).artist,'Michael Jackson');
 assert.match(result.stages.follow_up.output.body,/(?:We could not find a match for|No match found in SyncFlow’s current catalogue for) “Michael Jackson”/);assert.doesNotMatch(result.stages.follow_up.output.body,/budget|response deadline|confirm project/i);
 assert.ok(result.stages.review.output.issues.some(i=>i.issue_id==='missing-budget'));
});

test('application catalogue policy checks extracted artist regardless of source phrasing',async()=>{
 const f=JSON.parse(readFileSync(new URL('../fixtures/development/incomplete.json',import.meta.url),'utf8'));
 f.context.messages=[{...f.context.messages[0],text:'I need Michael Jackson music, thank you.'}];f.context.confirmed_fields=[];f.context.unresolved_issues=[];f.intake.proposed_changes=[{proposal_id:'artist-mj',field_key:'artist',previous_value:null,proposed_value:'Michael Jackson',evidence:[{message_id:f.context.messages[0].message_id,exact_quote:'Michael Jackson'}]}];f.intake.ambiguities=[];
 const result=await runWorkflow(f.context,{catalogueCheck:true,intakeProvider:{id:'test',mode:'mock',generate:async()=>f.intake},followUpProvider:createFollowUpMockProvider()});
 assert.equal(result.ok,true);validateSuccessfulAnalysis(result,f.context);assert.equal(result.catalogue_policy,'current-catalogue-v1');assert.match(result.stages.follow_up.output.body.split(/\n\s*\n/)[1],/(?:We could not find a match for|No match found in SyncFlow’s current catalogue for) “Michael Jackson”/);assert.doesNotMatch(result.stages.follow_up.output.body,/budget|response deadline|confirm project/i);
});

test('saved case regeneration enables the catalogue policy and persists the catalogue-first draft',async()=>{
 const {openRequestStore}=await import('../requests/store.js');const {analyzeSavedRequest}=await import('../requests/analyze-saved.js');const store=openRequestStore();
 try{const request=store.create({actor_id:'coordinator',email:'I need Michael Jackson music.',timezone:'UTC',idempotency_key:'create'}).request;
 const result=await analyzeSavedRequest(store,{actor_id:'coordinator',request_id:request.id,expected_revision:0,idempotency_key:'analyze'},{intakeProvider:{id:'test',mode:'mock',generate:async({context})=>({schema_version:context.schema_version,run_id:context.run_id,base_record_version:context.base_record_version,proposed_changes:[{proposal_id:'artist',field_key:'artist',previous_value:null,proposed_value:'Michael Jackson',evidence:[{message_id:context.messages[0].message_id,exact_quote:'Michael Jackson'}]}],ambiguities:[]})},followUpProvider:createFollowUpMockProvider()});
 assert.equal(result.analysis.result.catalogue_policy,'current-catalogue-v1');assert.equal(store.activeAnalysis('coordinator',request.id).status,'completed');assert.match(result.analysis.result.stages.follow_up.output.body,/(?:We could not find a match|No match found)/);assert.equal(store.workflow('coordinator',request.id).can_approve_brief,false);
 }finally{store.close();}
});
