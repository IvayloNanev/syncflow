import test from 'node:test';import assert from 'node:assert/strict';
import {briefingCase,loadAssessmentHistory} from '../server/briefing-store.js';
const request={id:'case',revision:1,messages:[{text:'Project: Summer film'}],confirmed_fields:[],recording_id:null};
const analysis={run_id:'run',base_revision:1,result:{ok:true,stages:{intake:{output:{proposed_changes:[{proposal_id:'p',field_key:'project',proposed_value:'Summer film',evidence:[{message_id:'m',exact_quote:'Summer film'}]}]}},review:{output:{issues:[]}}}}};
function store(current=analysis,decisions=[]){return {get:()=>request,activeAnalysis:()=>current,decisions:()=>decisions,workflow:()=>({status:'Needs analysis'}),reviewers:()=>({reviewers:[]}),handoff:()=>null};}
test('review context includes effective extraction even when raw request has no agent_fields',()=>{assert.equal(request.agent_fields,undefined);const c=briefingCase(store(),'actor',{id:'case'},4);assert.equal(c.agent_fields[0].value,'Summer film');assert.equal(c.agent_fields[0].origin,'agent');assert.equal(c.storage_version,4);assert.deepEqual(request.confirmed_fields,[]);});
test('review context excludes rejected and outdated extraction',()=>{assert.deepEqual(briefingCase(store(analysis,[{run_id:'run',proposal_id:'p',decision:'reject'}]),'actor',{id:'case'},4).agent_fields,[]);assert.deepEqual(briefingCase(store({...analysis,base_revision:0}),'actor',{id:'case'},4).agent_fields,[]);});


test('Internal Review receives full chronological history, scoped to its case with unsent drafts labelled',()=>{
 const original={message_id:'m1',kind:'initial',text:'Original inquiry',received_at:'2026-11-01T10:00:00Z'};
 const reply={message_id:'m2',kind:'reply',text:'Corrected client instructions',received_at:'2026-11-03T10:00:00Z'};
 const decision={manager_name:'Alex',notes:'Proceed subject to verification',decision:'return_to_coordinator',recorded_at:'2026-11-05T10:00:00Z'};
 const c={...request,messages:[original,reply],manager_decision_history:[decision]};
 const draftText='Full historical response. '.repeat(1000);
 const runs=[{run_id:'old',finished_at:'2026-11-02T10:00:00Z',result:{ok:true,stages:{follow_up:{output:{subject:'Original clarification',body:draftText}}}}}];
 const assessments=[{request_id:'case',fingerprint:'old-manager',result:{generated_at:'2026-11-04T10:00:00Z',draft:{subject:'Manager request',body:'Prior manager email draft'}}},{request_id:'other-case',fingerprint:'foreign',result:{draft:{body:'Private foreign draft'}}}];
 const source={...store(),get:()=>c,analyses:()=>runs};
 const loaded=briefingCase(source,'actor',{id:'case'},4,assessments);
 assert.deepEqual(loaded.correspondence.map(e=>e.kind),['Original email','Response draft · not sent','Email reply','Manager email draft · not sent','Recorded manager decision']);
 assert.equal(loaded.correspondence[1].text,draftText);
 assert.equal(loaded.correspondence[1].draft,true);
 assert.equal(loaded.correspondence[3].draft,true);
 assert.equal(loaded.correspondence[4].draft,false);
 assert.ok(!JSON.stringify(loaded).includes('Private foreign draft'));
 assert.equal(briefingCase(store(),'actor',{id:'case'},4).correspondence,undefined);
});

test('historical assessment loading reads all pages within the workspace and fails on missing pages',async()=>{
 const rows=Array.from({length:205},(_,i)=>({request_id:'case',fingerprint:String(i),result:{draft:{body:'saved draft'}}}));
 const pages=[];
 const client={from(table){assert.equal(table,'syncflow_internal_assessments');return {select(){return this;},eq(key,value){assert.equal(key,'workspace_id');assert.equal(value,'workspace');return this;},order(){return this;},async range(from,to){pages.push(from);return {data:rows.slice(from,to+1),error:null};}};}};
 assert.deepEqual(await loadAssessmentHistory(client,'workspace'),rows);
 assert.deepEqual(pages,[0,100,200]);
 const failed={from(){return {select(){return this;},eq(){return this;},order(){return this;},async range(){return {error:{message:'failure'}};}};}};
 await assert.rejects(loadAssessmentHistory(failed,'workspace'),/REVIEW_STORAGE_FAILED/);
});
