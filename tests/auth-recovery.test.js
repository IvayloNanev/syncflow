import test from 'node:test';
import assert from 'node:assert/strict';
import {createServerClient} from '@supabase/ssr';
import {preserveRecoveryOnFailure} from '../lib/auth-recovery.js';

for (const status of [429,500]) test(`a rejected recovery resend (${status}) preserves the delivered link's verifier`,async()=>{
 const name='sb-example-auth-token-code-verifier';
 const values=new Map([[name,'previous-verifier'],['syncflow-auth-return','previous-intent'],['unrelated','untouched']]);
 const jar={getAll:()=>[...values].map(([name,value])=>({name,value})),set:(name,value)=>values.set(name,value),delete:({name})=>values.delete(name)};
 let changedBeforeFailure=false;
 const client=createServerClient('https://example.supabase.co','public-test-key',{
  cookies:{getAll:jar.getAll,setAll:items=>{for(const item of items)jar.set(item.name,item.value);}},
  global:{fetch:async()=>{changedBeforeFailure=values.get(name)!=='previous-verifier';return new Response(JSON.stringify({code:status===429?'over_email_send_rate_limit':'unexpected_failure',msg:'request rejected'}),{status,headers:{'content-type':'application/json'}});}}
 });
 const error=await preserveRecoveryOnFailure(jar,true,async()=>{
  jar.set('syncflow-auth-return','new-intent');
  return (await client.auth.resetPasswordForEmail('fixture@example.invalid',{redirectTo:'https://app.example/auth/callback'})).error;
 });
 assert.ok(error);assert.equal(changedBeforeFailure,true);
 assert.equal(values.get(name),'previous-verifier');
 assert.equal(values.get('syncflow-auth-return'),'previous-intent');
 assert.equal(values.get('unrelated'),'untouched');
});

test('a successful recovery retains the new verifier',async()=>{
 const name='sb-example-auth-token-code-verifier',values=new Map([[name,'old']]);
 const jar={getAll:()=>[...values].map(([name,value])=>({name,value})),set:(name,value)=>values.set(name,value),delete:({name})=>values.delete(name)};
 const client=createServerClient('https://example.supabase.co','public-test-key',{cookies:{getAll:jar.getAll,setAll:items=>items.forEach(({name,value})=>jar.set(name,value))},global:{fetch:async()=>new Response('{}',{status:200,headers:{'content-type':'application/json'}})}});
 const error=await preserveRecoveryOnFailure(jar,true,async()=>(await client.auth.resetPasswordForEmail('fixture@example.invalid')).error);
 assert.equal(error,null);assert.notEqual(values.get(name),'old');assert.ok(values.get(name));
});
