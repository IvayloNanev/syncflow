import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo,advanceDemo,demoView,journeys} from '../demo/journeys.js';
import {writeDemo,readDemo} from '../server/demo-store.js';
test('three real-domain demo journeys finish, stay blocked outside catalogue, and reopen stale approvals',async()=>{
 let run=await createDemo();const original=JSON.stringify(run);
 assert.deepEqual(demoView(run).scenarios.map(s=>s.status),['Needs clarification','Recording unresolved','Internal review complete']);
 assert.equal(demoView(run).supervision.items[0].request_id,demoView(run).scenarios[0].request_id);
 for(const expected of ['Needs analysis','Needs coordinator review','Internal review pending','Internal review complete']){run=await advanceDemo(run,'urgent');assert.equal(demoView(run).scenarios[0].status,expected);}
 for(let i=0;i<3;i++)run=await advanceDemo(run,'catalogue');
 assert.equal(demoView(run).scenarios[1].status,'Recording unresolved');assert.match(run.events.find(e=>e.note)?.note,/No matching/);
 run=await advanceDemo(run,'reopened');assert.equal(demoView(run).scenarios[2].status,'Needs analysis');assert.equal(demoView(run).scenarios[2].reviewers[0].needs_reconfirmation,true);
 for(const expected of ['Needs coordinator review','Internal review pending','Internal review complete']){run=await advanceDemo(run,'reopened');assert.equal(demoView(run).scenarios[2].status,expected);}
 assert.equal(run.events.length,journeys.reduce((n,s)=>n+s.steps.length,0));
 const restored=JSON.parse(JSON.stringify(run));assert.equal(demoView(restored).supervision.finished_count,2);
 const reset=await createDemo();assert.equal(demoView(reset).scenarios[0].step,0);assert.equal(reset.clock,'2030-05-01T16:00:00.000Z');
 const unchanged=JSON.parse(original);await assert.rejects(advanceDemo(unchanged,'unknown'),/INVALID_SCENARIO/);assert.equal(JSON.stringify(unchanged),original);
 await assert.rejects(advanceDemo(run,'urgent'),/SCENARIO_COMPLETE/);
});
test('demo persistence only uses the isolated table and rejects concurrent overwrite',async()=>{
 const rows=new Map();
 const client={from(table){assert.equal(table,'syncflow_demo_runs');let filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},async maybeSingle(){return {data:rows.get(`${filters.workspace_id}:${filters.actor_id}`)||null,error:null};},async insert(row){rows.set(`${row.workspace_id}:${row.actor_id}`,structuredClone(row));return {error:null};},update(row){return {eq(k,v){filters[k]=v;return this;},select(){return this;},async maybeSingle(){const key=`${filters.workspace_id}:${filters.actor_id}`,current=rows.get(key);if(current?.version!==filters.version)return {data:null,error:null};rows.set(key,row);return {data:{version:row.version},error:null};}};}};return q;}};
 assert.equal(await writeDemo(client,'demo-parent','alice',0,{fictional:true}),1);
 assert.equal(await readDemo(client,'demo-parent','bob'),null);
 assert.equal(await readDemo(client,'other','alice'),null);
 assert.equal(await writeDemo(client,'demo-parent','alice',1,{fictional:true,event:1}),2);
 await assert.rejects(writeDemo(client,'demo-parent','alice',1,{fictional:true,event:2}),/DEMO_CONFLICT/);
});

test('fixed demo clock changes deadline urgency without changing request state',async()=>{
 const {advanceDemoClock}=await import('../demo/journeys.js');
 const run=await createDemo(),before=JSON.stringify(run.scenarios),next=advanceDemoClock(run);
 assert.equal(JSON.stringify(next.scenarios),before);
 assert.equal(next.clock,'2030-05-02T16:00:00.000Z');
 assert.match(demoView(next).supervision.items[0].reason,/passed/);
 assert.equal(next.events[0].before[0].position,1);
 assert.notEqual(next.events[0].before[0].reason,next.events[0].after[0].reason);
});
