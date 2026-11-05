import test from 'node:test';import assert from 'node:assert/strict';
import {validationCodes} from '../agents/intake/validation-codes.js';
test('diagnostic categories do not echo client or provider content',()=>{
 const sensitive='PRIVATE_CANARY never display';
 const codes=validationCodes({errors:[`Evidence quote not found in m1: ${sensitive}`,`/proposed_changes/0 ${sensitive}`,`Unknown evidence message: ${sensitive}`]});
 assert.deepEqual(codes,['EVIDENCE_QUOTE_MISMATCH','SCHEMA_MISMATCH','EVIDENCE_MESSAGE_MISMATCH']);assert.ok(!JSON.stringify(codes).includes(sensitive));
});

test('Intake exposes safe validation categories while rejecting the original output',async()=>{
 const {readFileSync}=await import('node:fs');const {runIntake}=await import('../agents/intake/run-intake.js');
 const fixture=JSON.parse(readFileSync(new URL('../fixtures/development/complete.json',import.meta.url),'utf8'));
 fixture.intake.proposed_changes[0].evidence[0].exact_quote='PRIVATE_CANARY not in email';
 const result=await runIntake(fixture.context,{provider:{id:'test',mode:'mock',generate:async()=>fixture.intake}});
 assert.equal(result.ok,false);assert.equal(result.error.code,'INVALID_OUTPUT');
 assert.deepEqual(result.error.validation_codes,['EVIDENCE_QUOTE_MISMATCH']);
 assert.ok(!JSON.stringify(result).includes('PRIVATE_CANARY'));
});

test('malformed provider tool envelope has a safe diagnosis, not an arbitrary error body',async()=>{
 const {readFileSync}=await import('node:fs');const {runIntake}=await import('../agents/intake/run-intake.js');
 const {createClaudeProvider}=await import('../agents/intake/providers/claude.js');
 const fixture=JSON.parse(readFileSync(new URL('../fixtures/development/complete.json',import.meta.url),'utf8'));
 const provider=createClaudeProvider({apiKey:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({stop_reason:'tool_use',content:[{type:'tool_use',name:'untrusted-tool',input:{private:'PRIVATE_CANARY'}}]})})});
 const result=await runIntake(fixture.context,{provider});assert.equal(result.ok,false);assert.deepEqual(result.error.validation_codes,['INVALID_TOOL_ENVELOPE']);assert.ok(!JSON.stringify(result).includes('PRIVATE_CANARY'));
});
