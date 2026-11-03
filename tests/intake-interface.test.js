import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { runIntake } from '../agents/intake/run-intake.js';
import { createMockProvider, developmentContext, scenarios } from '../agents/intake/providers/mock.js';
const context = () => developmentContext('complete');
const provider = () => createMockProvider('complete');
const bad = generate => ({ id: 'test-double', mode: 'mock', generate });
for (const scenario of scenarios) test(`mock pipeline validates ${scenario}`, async () => {
  const c = developmentContext(scenario), before = structuredClone(c);
  const result = await runIntake(c, { provider: createMockProvider(scenario) });
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'mock');
  assert.equal(result.freshness, 'not_checked');
  assert.deepEqual(c, before);
});
test('provider is explicit; there is no implicit model or mock default', async () => {
  assert.equal((await runIntake(context())).error.code, 'INVALID_PROVIDER');
});
test('invalid context does not invoke provider', async () => {
  let calls=0; const result=await runIntake({}, {provider:bad(async()=>{calls++;})});
  assert.equal(result.error.code,'INVALID_CONTEXT');assert.equal(calls,0);
});
test('refuses arbitrary messages rather than replaying plausible fixture output', async()=>{
  const c=context();c.messages[0].text='Use an unrelated song';
  const result=await runIntake(c,{provider:provider()});
  assert.equal(result.error.code,'UNSUPPORTED_MOCK_INPUT');assert.equal('output'in result,false);
});
test('safe provider error hides original message and preserves input',async()=>{
  const c=context(),before=structuredClone(c);const result=await runIntake(c,{provider:bad(async()=>{throw Error('SECRET-provider-key');})});
  assert.equal(result.error.code,'PROVIDER_FAILED');assert.equal(result.error.retryable,true);
  assert.equal(JSON.stringify(result).includes('SECRET'),false);assert.deepEqual(c,before);
});
test('malformed output and invented evidence never escape as accepted proposals',async()=>{
  assert.equal((await runIntake(context(),{provider:bad(async()=>({approved:true}))})).error.code,'INVALID_OUTPUT');
  const p=provider();const result=await runIntake(context(),{provider:bad(async args=>{const out=await p.generate(args);out.proposed_changes[0].evidence[0].exact_quote='invented';return out;})});
  assert.equal(result.error.code,'INVALID_OUTPUT');
});
test('times out uncooperative provider without automatic retry',async()=>{
  let calls=0;const result=await runIntake(context(),{timeoutMs:10,provider:bad(async()=>{calls++;return new Promise(()=>{});})});
  assert.equal(result.error.code,'TIMEOUT');assert.equal(calls,1);
});
test('timeout aborts the signal exposed to cooperative provider',async()=>{
  let aborted=false;const result=await runIntake(context(),{timeoutMs:10,provider:bad(({signal})=>new Promise((_,reject)=>{signal.addEventListener('abort',()=>{aborted=true;reject(Error('cancelled'));},{once:true});}))});
  assert.equal(result.error.code,'TIMEOUT');assert.equal(aborted,true);
});
test('detects stale persisted version after generation',async()=>{
  const result=await runIntake(context(),{provider:provider(),getCurrentVersion:async()=>1});
  assert.equal(result.error.code,'STALE_RESULT');assert.equal('output'in result,false);
});
test('reports checked freshness only when current version matches',async()=>{
  const result=await runIntake(context(),{provider:provider(),getCurrentVersion:async()=>0});
  assert.equal(result.ok,true);assert.equal(result.freshness,'checked');
});
test('database version check failure is explicit and sanitized',async()=>{
  const result=await runIntake(context(),{provider:provider(),getCurrentVersion:async()=>{throw Error('database password');}});
  assert.equal(result.error.code,'VERSION_CHECK_FAILED');assert.equal(JSON.stringify(result).includes('password'),false);
});
test('provider cannot mutate even its copy of confirmed context',async()=>{
  const c=developmentContext('partial-reply'),before=structuredClone(c);
  const result=await runIntake(c,{provider:bad(async({context:c})=>{c.confirmed_fields[0].value='changed';})});
  assert.equal(result.error.code,'PROVIDER_FAILED');assert.deepEqual(c,before);
});
test('each explicit invocation gets an independent output object',async()=>{
  const a=await runIntake(context(),{provider:provider()});a.output.proposed_changes.length=0;
  const b=await runIntake(context(),{provider:provider()});assert.ok(b.output.proposed_changes.length>0);
});
test('invalid timeout never invokes provider',async()=>{
  for(const timeoutMs of [0,-1,NaN,30001])assert.equal((await runIntake(context(),{provider:provider(),timeoutMs})).error.code,'INVALID_OPTIONS');
});
test('CLI explicitly labels mock and outputs a validated success envelope',()=>{
  const result=spawnSync(process.execPath,['agents/intake/cli.js','--provider','mock','--scenario','incomplete'],{encoding:'utf8',cwd:new URL('../',import.meta.url)});
  assert.equal(result.status,0);assert.match(result.stderr,/MOCK ONLY/);assert.equal(JSON.parse(result.stdout).mode,'mock');
});
test('CLI rejects unavailable live provider without pretending to call it',()=>{
  const result=spawnSync(process.execPath,['agents/intake/cli.js','--provider','live','--scenario','complete'],{encoding:'utf8',cwd:new URL('../',import.meta.url)});
  assert.equal(result.status,2);assert.equal(result.stdout,'');assert.match(result.stderr,/Usage:/);
});
