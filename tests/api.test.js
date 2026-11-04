import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { analyzeEmail } from '../server/analyze.js';
import { createAnalysisServer } from '../server/http.js';
import { createFollowUpMockProvider } from '../agents/follow-up/providers/mock.js';
const providers = () => ({ intakeProvider: {id:'test',mode:'mock',generate:async({context})=>({schema_version:context.schema_version,run_id:context.run_id,base_record_version:0,proposed_changes:[],ambiguities:[]})}, followUpProvider:createFollowUpMockProvider() });
test('new-email adapter generates identity and returns workflow stages',async()=>{
  const p=providers();let context;const generate=p.intakeProvider.generate;
  p.intakeProvider.generate=async args=>{context=args.context;return generate(args);};
  const r=await analyzeEmail({email:'A fictional music request',timezone:'America/New_York'},p);
  assert.equal(r.status,200);assert.equal(r.body.stages.follow_up.ok,true);assert.equal(r.body.saved,false);
  assert.equal(context.messages[0].text,'A fictional music request');assert.equal(context.messages[0].supplied_message_date,null);
  assert.equal(context.base_record_version,0);assert.ok(context.run_id);
});
test('bad or client-owned state is rejected without model calls',async()=>{
  const p=providers();p.intakeProvider.generate=()=>{throw Error('must not call');};
  for(const input of [null,[],{email:'',timezone:'UTC'},{email:'x',timezone:'invalid'},{email:'x',timezone:'UTC',confirmed_fields:[]},{email:'x'.repeat(20001),timezone:'UTC'}])
    assert.equal((await analyzeEmail(input,p)).status,400);
});
test('HTTP adapter handles JSON, methods, origins and no-store headers',async t=>{
  const server=createAnalysisServer(providers());server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/health')).status,200);
  assert.equal((await fetch(base+'/api/analyze')).status,405);
  assert.equal((await fetch(base+'/api/analyze',{method:'POST',headers:{'content-type':'text/plain'},body:'x'})).status,415);
  assert.equal((await fetch(base+'/api/analyze',{method:'POST',headers:{origin:'https://untrusted.example','content-type':'application/json'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:'{'})).status,400);
  const response=await fetch(base+'/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'Fictional request',timezone:'UTC'})});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await response.json()).sent,false);
});
test('HTTP overload rejects a second analysis and recovers after first completes',async t=>{
  const p=providers();let release;let started;
  const entered=new Promise(resolve=>{started=resolve;});const gate=new Promise(resolve=>{release=resolve;});
  const generate=p.intakeProvider.generate;p.intakeProvider.generate=async args=>{started();await gate;return generate(args);};
  const server=createAnalysisServer(p);server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url=`http://127.0.0.1:${server.address().port}/api/analyze`;
  const options={method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'Fictional request',timezone:'UTC'})};
  const first=fetch(url,options);await entered;
  assert.equal((await fetch(url,options)).status,429);release();assert.equal((await first).status,200);
  assert.equal((await fetch(url,options)).status,200);
});
test('HTTP rejects oversized bodies and still handles subsequent requests',async t=>{
  const server=createAnalysisServer(providers());server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}`;
  const r=await fetch(base+'/api/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'x'.repeat(110000),timezone:'UTC'})});
  assert.equal(r.status,413);assert.equal((await fetch(base+'/health')).status,200);
});
