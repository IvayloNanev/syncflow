import test from 'node:test';
import assert from 'node:assert/strict';
import {seedDemo} from '../server/demo-seed.js';
import {openSharedStore} from '../requests/shared-store.js';
function database(){
 const rows=new Map(),queue=[];
 return {rows,queue,from(table){let workspace,id;return {select(){return this;},eq(k,v){if(k==='workspace_id')workspace=v;if(k==='id')id=v;return this;},async maybeSingle(){return {data:structuredClone(rows.get(`${workspace}:${id}`)||null)};},async upsert(value){assert.equal(table,'syncflow_internal_queue');queue.push(value);return {};}};},async rpc(name,p){assert.equal(name,'syncflow_commit_request');const key=`${p.p_workspace}:${p.p_id}`,previous=rows.get(key);if((previous?.version||0)!==p.p_expected)return {error:{message:'STORAGE_CONFLICT'}};rows.set(key,structuredClone({id:p.p_id,version:p.p_expected+1,state:p.p_state,dashboard:p.p_dashboard}));return {data:p.p_expected+1};}};
}
test('live demo seeds only private source cases; it fabricates no AI result or approval',async()=>{
 const client=database(),workspace='de000000-1234-4567-8901-123456789012';
 await seedDemo(client,workspace,'service-actor',{now:new Date('2026-11-13T12:00:00Z')});
 assert.equal(client.rows.size,3);assert.equal(client.queue.length,1);
 for(const row of client.rows.values()){
  const store=await openSharedStore({client,workspaceId:workspace,actorId:'service-actor',id:row.id});
  try{const request=store.get('service-actor',row.id);assert.equal(request.owner_id,workspace);assert.equal(request.messages.length,1);assert.match(request.messages[0].text,/FICTIONAL GUEST DEMO/);assert.equal(store.analyses('service-actor',row.id).length,0);assert.equal(store.activeAnalysis('service-actor',row.id),null);}finally{store.dispose();}
 }
 const internal=[...client.rows.values()].find(r=>r.id===client.queue[0].request_id);
 assert.equal(internal.state.tables.requests.length,1);
 const saved=JSON.parse(internal.state.tables.requests[0].body);assert.equal(saved.agent_assignment.destination,'internal');
 const firstIds=new Set([...client.rows.values()].map(r=>r.id));
 await seedDemo(client,'de000000-abcd-4567-8901-123456789012','service-actor');
 assert.equal(client.rows.size,6);for(const [key,row] of client.rows)if(key.startsWith('de000000-abcd'))assert.ok(!firstIds.has(row.id));
});
