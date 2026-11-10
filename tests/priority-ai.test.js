import test from 'node:test';
import assert from 'node:assert/strict';
import {draftPriorityReport} from '../agents/priority/ai-review.js';
const cases=[{id:'one',messages:[{message_id:'m1',text:'Please confirm the Canada campaign.'}]}];
const review={recommendation:{request_id:'one'}};
const valid={request_id:'one',reason:'This campaign needs attention now.',action:'analysis',blocker:'The campaign scope needs review.',next_action:'Review the campaign scope before continuing.',citations:[{message_id:'m1',exact_quote:'Canada campaign'}]};
const provider=input=>async()=>Response.json({stop_reason:'tool_use',content:[{type:'tool_use',name:'submit_priority_report',input}]});
const args={review,cases,signal:new AbortController().signal,apiKey:'test',model:'test'};
test('AI report requires exact case/message citations and accepts a model-selected order with exact evidence',async()=>{
 const report=await draftPriorityReport({...args,fetchImpl:provider({items:[valid]})});assert.equal(report.reviewed_count,1);
 await assert.rejects(draftPriorityReport({...args,fetchImpl:provider({items:[{...valid,request_id:'foreign'}]})}),/AI_INVALID_OUTPUT/);
 await assert.rejects(draftPriorityReport({...args,fetchImpl:provider({items:[{...valid,citations:[{message_id:'m1',exact_quote:'approved worldwide'}]}]})}),/AI_INVALID_EVIDENCE/);
 await assert.rejects(draftPriorityReport({...args,fetchImpl:provider({items:[{...valid,citations:[{message_id:'foreign',exact_quote:'Canada'}]}]})}),/AI_INVALID_EVIDENCE/);
});
test('AI context includes saved case histories and only exposes a report tool',async()=>{
 await draftPriorityReport({...args,fetchImpl:async(url,options)=>{assert.equal(url,'https://api.anthropic.com/v1/messages');const body=JSON.parse(options.body);assert.deepEqual(JSON.parse(body.messages[0].content).cases.map(c=>{const saved={...c};delete saved.eligible_actions;return saved;}),cases);assert.equal(body.tools.length,1);assert.equal(body.tools[0].name,'submit_priority_report');return provider({items:[valid]})();}});
 await assert.rejects(draftPriorityReport({...args,cases:[{id:'one',messages:[{text:'x'.repeat(200001)}]}],fetchImpl:()=>assert.fail('No call for oversized history')}),/AI_CONTEXT_TOO_LARGE/);
});
test('AI briefing must cover all open cases, exclude completed cases, and preserve AI-selected priority order',async()=>{
 const all=[...cases,{id:'two',summary:{contact:'Priya',status:'Needs coordinator review'},messages:[{message_id:'m2',text:'Please review the trailer.'}]},{id:'done',summary:{status:'Internal review complete'},messages:[]}];
 const second={...valid,request_id:'two',citations:[{message_id:'m2',exact_quote:'review the trailer'}]};
 const scoped={...args,cases:all,review:{ranked_request_ids:['two','one'],recommendation:{request_id:'two'}}};
 const report=await draftPriorityReport({...scoped,fetchImpl:provider({items:[valid,second]})});
 assert.deepEqual(report.items.map(item=>item.request_id),['one','two']);
 await assert.rejects(draftPriorityReport({...scoped,fetchImpl:provider({items:[valid]})}),/AI_INVALID_OUTPUT/);
 await assert.rejects(draftPriorityReport({...scoped,fetchImpl:provider({items:[valid,valid]})}),/AI_INVALID_OUTPUT/);
 await assert.rejects(draftPriorityReport({...scoped,fetchImpl:provider({items:[valid,{...second,request_id:'done'}]})}),/AI_INVALID_OUTPUT/);
});
test('invalid generated evidence retries once and still requires a fully valid report',async()=>{
 let attempts=0;
 const report=await draftPriorityReport({...args,fetchImpl:async()=>{attempts++;return provider({items:[attempts===1?{...valid,citations:[{message_id:'m1',exact_quote:'invented'}]}:valid]})();}});
 assert.equal(attempts,2);assert.equal(report.items.length,1);
 attempts=0;
 await assert.rejects(draftPriorityReport({...args,fetchImpl:async()=>{attempts++;return provider({items:[]})();}}),/AI_INVALID_OUTPUT/);
 assert.equal(attempts,2);
});
test('agent may select Coordinator reviewer follow-up for pending review but cannot bypass analysis',async()=>{
 await assert.rejects(draftPriorityReport({...args,fetchImpl:provider({items:[{...valid,action:'internal'}]})}),/AI_INVALID_OUTPUT/);
 const pending={...cases[0],summary:{status:'Internal review pending'},workflow:{status:'Internal review pending'},recording_id:'recording',analysis:{result:{stages:{review:{output:{issues:[]}}}}}};
 const result=await draftPriorityReport({...args,cases:[pending],fetchImpl:provider({items:[{...valid,action:'follow_up'}]})});
 assert.equal(result.decision_version,5);assert.equal(result.items[0].destination,'coordinator');assert.equal(result.items[0].action,'follow_up');
});
