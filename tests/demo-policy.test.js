import test from 'node:test';
import assert from 'node:assert/strict';
import {newDemoToken,demoTokenHash,demoIpHash,readDemoSession,reserveDemo,isDemoWorkspace} from '../server/demo-policy.js';
const workspace='de000000-1234-4567-8901-123456789012';
test('guest tokens are random opaque bearer secrets; only their digests are queried',async()=>{
 const token=newDemoToken();assert.match(token,/^[a-f0-9]{64}$/);assert.notEqual(token,newDemoToken());assert.notEqual(demoTokenHash(token),token);
 let args;const client={rpc:async(name,input)=>{args={name,input};return {data:{workspace_id:workspace,actor_id:'actor',expires_at:new Date(Date.now()+60000).toISOString()}};}};
 assert.equal((await readDemoSession(client,token)).workspace_id,workspace);assert.deepEqual(args,{name:'syncflow_read_demo',input:{p_hash:demoTokenHash(token)}});
 assert.equal(await readDemoSession(client,'forged-workspace-id'),null);
});
test('missing, expired, malformed, and foreign-workspace guest sessions never grant access',async()=>{
 for(const data of [null,{workspace_id:'09eece27-cee6-4286-94b7-870e3ad8f7a1',actor_id:'actor',expires_at:new Date(Date.now()+60000).toISOString()},{workspace_id:workspace,actor_id:'actor',expires_at:'2000-01-01'},{workspace_id:workspace,actor_id:'actor',expires_at:'bad'}]){
  assert.equal(await readDemoSession({rpc:async()=>({data})},newDemoToken()),null);
 }
 await assert.rejects(readDemoSession({rpc:async()=>({error:{message:'offline'}})},newDemoToken()),/DEMO_ACCESS_UNAVAILABLE/);
});
test('network quotas trust only platform-overwritten headers in production',()=>{
 const headers=new Headers({'x-forwarded-for':'forged','x-vercel-forwarded-for':'203.0.113.8'});
 assert.equal(demoIpHash(headers,'secret',{vercel:true,production:true}),demoIpHash(new Headers({'x-vercel-forwarded-for':'203.0.113.8'}),'secret',{vercel:true,production:true}));
 assert.throws(()=>demoIpHash(headers,'secret',{vercel:false,production:true}),/DEMO_NETWORK_UNAVAILABLE/);
 assert.throws(()=>demoIpHash(new Headers({'x-forwarded-for':'forged'}),'secret',{vercel:true,production:true}),/DEMO_NETWORK_UNAVAILABLE/);
});
test('guest budget service fails closed, while ordinary workspaces keep their current path',async()=>{
 assert.ok(isDemoWorkspace(workspace));assert.ok(!isDemoWorkspace('real-workspace'));
 assert.equal(await reserveDemo({rpc:()=>{throw Error('should not query');}},'real-workspace','actor','provider','key'),true);
 for(const result of [{error:{}},{data:null},{data:{allowed:'yes'}}])await assert.rejects(reserveDemo({rpc:async()=>result},workspace,'actor','provider','key'),/DEMO_USAGE_UNAVAILABLE/);
 assert.equal(await reserveDemo({rpc:async()=>({data:{allowed:false}})},workspace,'actor','provider','key'),false);
});
