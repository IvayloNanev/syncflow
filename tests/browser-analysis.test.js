import test from 'node:test';import assert from 'node:assert/strict';
import {createBrowserAnalysisHandler} from '../server/browser-analysis.js';import {createFollowUpMockProvider} from '../agents/follow-up/providers/mock.js';
const request=(body,origin='http://127.0.0.1:3000')=>new Request('http://127.0.0.1:3000/api/analyze',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
const providers=()=>({intakeProvider:{id:'test',mode:'mock',generate:async({context})=>({schema_version:'1.0',run_id:context.run_id,base_record_version:0,proposed_changes:[],ambiguities:[]})},followUpProvider:createFollowUpMockProvider()});
test('browser bridge returns the complete unsaved workflow envelope',async()=>{
 const post=createBrowserAnalysisHandler({enabled:()=>true,providers});const response=await post(request({email:'Fictional request',timezone:'UTC'}));
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');const result=await response.json();
 assert.equal(result.ok,true);assert.equal(result.saved,false);assert.equal(result.sent,false);assert.ok(result.stages.follow_up.output.body);
});
test('disabled deployment and foreign origins never invoke providers',async()=>{
 let calls=0;const get=()=>{calls++;return providers();};
 assert.equal((await createBrowserAnalysisHandler({enabled:()=>false,providers:get})(request({email:'x',timezone:'UTC'}))).status,503);
 assert.equal((await createBrowserAnalysisHandler({enabled:()=>true,providers:get})(request({email:'x',timezone:'UTC'},'https://attacker.example'))).status,403);
 assert.equal(calls,0);
});
test('invalid input and oversized body are rejected before credentials or model use',async()=>{
 let calls=0;const post=createBrowserAnalysisHandler({enabled:()=>true,providers:()=>{calls++;return providers();}});
 assert.equal((await post(request({email:'x',timezone:'invalid'}))).status,400);
 assert.equal((await post(request({email:'x'.repeat(110000),timezone:'UTC'}))).status,413);
 assert.equal(calls,0);assert.equal((await post(request({email:'x',timezone:'UTC'}))).status,200);
});
test('overlap is rejected and bridge recovers after safe provider failure',async()=>{
 let enter,release;const ready=new Promise(r=>enter=r),gate=new Promise(r=>release=r);const p=providers();
 p.intakeProvider.generate=async()=>{enter();await gate;throw Error('private error text');};
 const post=createBrowserAnalysisHandler({enabled:()=>true,providers:()=>p});const first=post(request({email:'x',timezone:'UTC'}));await ready;
 assert.equal((await post(request({email:'x',timezone:'UTC'}))).status,429);release();const response=await first;
 assert.equal(response.status,502);assert.ok(!JSON.stringify(await response.json()).includes('private error text'));
 assert.equal((await post(request({email:'',timezone:'UTC'}))).status,400);
});
test('loopback Host remains valid when Next normalizes its internal URL to localhost',async()=>{
 const post=createBrowserAnalysisHandler({enabled:()=>true,providers});
 const req=new Request('http://localhost:3000/api/analyze',{method:'POST',headers:{host:'127.0.0.1:3000',origin:'http://127.0.0.1:3000','content-type':'application/json'},body:JSON.stringify({email:'Fictional request',timezone:'UTC'})});
 assert.equal((await post(req)).status,200);
});
