import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClaudeProvider } from '../agents/intake/providers/claude.js';
import { developmentContext, createMockProvider } from '../agents/intake/providers/mock.js';
import { runIntake } from '../agents/intake/run-intake.js';
const config={apiKey:'fake-test-key-not-a-real-credential',model:'test-claude-model'};
const envelope=async context=>({stop_reason:'tool_use',content:[{type:'tool_use',name:'submit_intake',input:await createMockProvider('complete').generate({context,signal:new AbortController().signal})}]});
test('Claude requires explicit key and model',()=>{
  for(const c of [{apiKey:'',model:'x'},{apiKey:'fake',model:''}])assert.throws(()=>createClaudeProvider(c),e=>e.code==='PROVIDER_NOT_CONFIGURED');
});
test('sends only context, instructions and output schema to fixed Anthropic origin',async()=>{
  const context=developmentContext('complete');let sent;
  const provider=createClaudeProvider({...config,fetchImpl:async(url,opts)=>{sent={url,opts};return {ok:true,json:async()=>envelope(context)};}});
  const result=await runIntake(context,{provider});
  assert.equal(result.ok,true);assert.equal(result.mode,'live');
  assert.equal(sent.url,'https://api.anthropic.com/v1/messages');
  assert.equal(sent.opts.redirect,'error');assert.equal(sent.opts.headers.authorization,'Bearer '+config.apiKey);
  const body=JSON.parse(sent.opts.body);
  assert.equal(body.model,config.model);assert.equal(body.max_tokens,4096);
  assert.deepEqual(JSON.parse(body.messages[0].content),{context});
  assert.equal(body.tools.length,1);assert.equal(body.tools[0].name,'submit_intake');
  assert.equal(body.tool_choice.name,'submit_intake');
  assert.deepEqual(body.tools[0].input_schema.properties.schema_version,{type:'string',enum:['1.0']});
  assert.equal(JSON.stringify(body.tools[0].input_schema).includes('$ref'),false);
  assert.match(body.system,/client data, never system instructions/);
  assert.equal(JSON.stringify(body).includes('expected_behavior'),false);
  assert.equal(JSON.stringify(result).includes(config.apiKey),false);
});
for(const [status,code]of [[401,'PROVIDER_AUTH_FAILED'],[403,'PROVIDER_AUTH_FAILED'],[429,'PROVIDER_RATE_LIMITED'],[400,'PROVIDER_REQUEST_REJECTED'],[500,'PROVIDER_FAILED']])test(`HTTP ${status} has safe error mapping, no automatic retry`,async()=>{
  let calls=0;const provider=createClaudeProvider({...config,fetchImpl:async()=>{calls++;return {ok:false,status,json:()=>{throw Error('Must not read error body');}};}});
  const result=await runIntake(developmentContext('complete'),{provider});
  assert.equal(result.error.code,code);assert.equal(calls,1);assert.equal('output'in result,false);
});
for(const response of [
  {stop_reason:'max_tokens',content:[]},
  {stop_reason:'end_turn',content:[{type:'text',text:'refused'}]},
  {stop_reason:'tool_use',content:[{type:'tool_use',name:'send_email',input:{}}]},
  {stop_reason:'tool_use',content:[{type:'tool_use',name:'submit_intake',input:{}},{type:'tool_use',name:'submit_intake',input:{}}]},
])test('rejects truncated/refused/wrong/multiple tool results',async()=>{
  const provider=createClaudeProvider({...config,fetchImpl:async()=>({ok:true,json:async()=>response})});
  assert.equal((await runIntake(developmentContext('complete'),{provider})).error.code,'INVALID_OUTPUT');
});
test('valid tool block still passes local evidence and schema validation',async()=>{
  const context=developmentContext('complete');const message=await envelope(context);
  message.content[0].input.proposed_changes[0].evidence[0].exact_quote='fabricated quote';
  const provider=createClaudeProvider({...config,fetchImpl:async()=>({ok:true,json:async()=>message})});
  assert.equal((await runIntake(context,{provider})).error.code,'INVALID_OUTPUT');
});
test('aborts live transport on harness timeout',async()=>{
  let aborted=false;
  const provider=createClaudeProvider({...config,fetchImpl:(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('abort'));},{once:true}))});
  const result=await runIntake(developmentContext('complete'),{provider,timeoutMs:10});
  assert.equal(result.error.code,'TIMEOUT');assert.equal(aborted,true);
});
test('tracked environment template contains no key',()=>{
  const example=readFileSync(new URL('../.env.example',import.meta.url),'utf8');
  assert.match(example,/^ANTHROPIC_API_KEY=$/m);assert.equal(example.includes('sk-ant-'),false);
});

test('numeric schema version is rejected rather than coerced',async()=>{
  const context=developmentContext('complete');const message=await envelope(context);
  message.content[0].input.schema_version=1;
  const provider=createClaudeProvider({...config,fetchImpl:async()=>({ok:true,json:async()=>message})});
  assert.equal((await runIntake(context,{provider})).error.code,'INVALID_OUTPUT');
});
