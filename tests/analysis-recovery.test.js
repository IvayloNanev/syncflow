import test from 'node:test';import assert from 'node:assert/strict';
import {safeAnalysisFailure} from '../requests/analysis-failure.js';
import {openRequestStore} from '../requests/store.js';
import {analyzeSavedRequest} from '../requests/analyze-saved.js';
import {createFollowUpMockProvider} from '../agents/follow-up/providers/mock.js';

test('persisted analysis failures whitelist codes and never echo rejected payloads or private messages',()=>{
 const failure=safeAnalysisFailure({ok:false,failed_stage:'intake',error:{code:'INVALID_OUTPUT',message:'PRIVATE_CANARY',validation_codes:['EVIDENCE_QUOTE_MISMATCH','PRIVATE_CANARY']},stages:{secret:'PRIVATE_CANARY'}});
 assert.equal(failure.error.code,'INVALID_OUTPUT');assert.deepEqual(failure.error.validation_codes,['EVIDENCE_QUOTE_MISMATCH']);assert.ok(!JSON.stringify(failure).includes('PRIVATE_CANARY'));
 assert.equal(safeAnalysisFailure({error:{code:'constructor'}}).error.code,'ANALYSIS_FAILED');
});
test('failed attempt preserves valid active result; read/replay do not call model; explicit retry can recover',async()=>{
 const store=openRequestStore();try{
  const r=store.create({actor_id:'A',email:'Fictional request.',timezone:'UTC',idempotency_key:'create'}).request;
  let calls=0;const providers={intakeProvider:{id:'mock',mode:'mock',generate:async({context})=>{calls++;return {schema_version:'1.0',run_id:context.run_id,base_record_version:context.base_record_version,proposed_changes:[],ambiguities:[]};}},followUpProvider:createFollowUpMockProvider()};
  const command={actor_id:'A',request_id:r.id,expected_revision:0,idempotency_key:'first'};
  const good=await analyzeSavedRequest(store,command,providers);
  const before=store.get('A',r.id);
  const invalid={...providers,intakeProvider:{id:'invalid',mode:'mock',generate:async()=>{calls++;return {private:'PRIVATE_CANARY'};}}};
  const failed=await analyzeSavedRequest(store,{...command,idempotency_key:'invalid'},invalid);
  assert.equal(failed.analysis.result.error.code,'INVALID_OUTPUT');
  assert.deepEqual(failed.analysis.result.error.validation_codes,['SCHEMA_MISMATCH']);
  assert.ok(!JSON.stringify(failed.analysis.result).includes('PRIVATE_CANARY'));
  assert.equal(store.activeAnalysis('A',r.id).run_id,good.analysis.run_id);
  assert.deepEqual(store.get('A',r.id),before);
  const count=calls;
  store.analyses('A',r.id);await analyzeSavedRequest(store,{...command,idempotency_key:'invalid'},invalid);assert.equal(calls,count);
  const retry=await analyzeSavedRequest(store,{...command,idempotency_key:'explicit-retry'},providers);
  assert.equal(retry.analysis.status,'completed');assert.equal(calls,count+1);
 }finally{store.close();}
});
