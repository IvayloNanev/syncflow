import test from 'node:test';import assert from 'node:assert/strict';
import {briefingCase} from '../server/briefing-store.js';
const request={id:'case',revision:1,messages:[{text:'Project: Summer film'}],confirmed_fields:[],recording_id:null};
const analysis={run_id:'run',base_revision:1,result:{ok:true,stages:{intake:{output:{proposed_changes:[{proposal_id:'p',field_key:'project',proposed_value:'Summer film',evidence:[{message_id:'m',exact_quote:'Summer film'}]}]}},review:{output:{issues:[]}}}}};
function store(current=analysis,decisions=[]){return {get:()=>request,activeAnalysis:()=>current,decisions:()=>decisions,workflow:()=>({status:'Needs analysis'}),reviewers:()=>({reviewers:[]}),handoff:()=>null};}
test('review context includes effective extraction even when raw request has no agent_fields',()=>{assert.equal(request.agent_fields,undefined);const c=briefingCase(store(),'actor',{id:'case'},4);assert.equal(c.agent_fields[0].value,'Summer film');assert.equal(c.agent_fields[0].origin,'agent');assert.equal(c.storage_version,4);assert.deepEqual(request.confirmed_fields,[]);});
test('review context excludes rejected and outdated extraction',()=>{assert.deepEqual(briefingCase(store(analysis,[{run_id:'run',proposal_id:'p',decision:'reject'}]),'actor',{id:'case'},4).agent_fields,[]);assert.deepEqual(briefingCase(store({...analysis,base_revision:0}),'actor',{id:'case'},4).agent_fields,[]);});

test('opening one review case hydrates only that case, not every request in the workspace',async()=>{
 const {openRequestStore}=await import('../requests/store.js');const {loadBriefing}=await import('../server/briefing-store.js');const rows=[],loaded=[];
 for(const id of ['11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222']){const store=openRequestStore(':memory:',{ownerId:'workspace',createId:id});store.create({actor_id:'actor',idempotency_key:id,email:'Music request',timezone:'UTC'});rows.push({id,version:1,state:store.exportState(),dashboard:{id,status:'Needs analysis',brief_policy:'coordinator-signoff-v1'}});store.close();}
 const client={from(table){let id,columns;const q={select(value){columns=value;return q;},eq(key,value){if(key==='id')id=value;return q;},order(){return q;},range(){return q;},async maybeSingle(){if(table==='syncflow_briefings')return {data:null};loaded.push(id);return {data:rows.find(row=>row.id===id)};},then(resolve){const chosen=rows.filter(row=>!id||row.id===id);resolve({data:columns==='id,version'?chosen.map(({id,version})=>({id,version})):chosen});}};return q;}};
 const result=await loadBriefing(client,'workspace','actor',{requestId:rows[1].id});assert.deepEqual(result.cases.map(c=>c.id),[rows[1].id]);assert.deepEqual(loaded,[rows[1].id]);
});
