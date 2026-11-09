import {readFileSync} from 'node:fs';
import {openRequestStore} from '../requests/store.js';
import {analyzeSavedRequest} from '../requests/analyze-saved.js';
import {createFollowUpMockProvider} from '../agents/follow-up/providers/mock.js';
import {effectiveFields} from '../requests/effective-fields.js';
import {dashboardRequest} from '../requests/dashboard.js';
import {reviewRecording,resolveRecording} from '../catalog/review.js';
import {searchRecordings} from '../catalog/recordings.js';
import {superviseCases} from '../agents/priority/supervisor.js';
const actor='fictional-demo-coordinator';
const fixture=JSON.parse(readFileSync(new URL('../fixtures/development/complete.json',import.meta.url),'utf8'));
export const journeys=[
 {key:'urgent',title:'Urgent inquiry → clarification → internal review',client:'Avery Stone · Demo Northstar',project:'Demo launch trailer',deadline:'2030-05-01',steps:['Client supplies the missing budget','Analyze the complete reply','Approve brief and assign reviewer','Reviewer approves; complete internal review']},
 {key:'catalogue',title:'Music outside the catalogue',client:'Mina Reed · Demo Orbit',project:'Demo brand film',deadline:'2030-05-08',steps:['Check the requested catalogue recording','Client provides a recording reference','Recheck the conversation']},
 {key:'reopened',title:'Completed case reopened by a scope change',client:'Noah Park · Demo Harbor',project:'Demo documentary campaign',deadline:'2030-05-10',steps:['Client changes the territory','Analyze the changed scope','Approve revised brief','Reviewer reconfirms; complete review']},
];
const definition=key=>{const found=journeys.find(s=>s.key===key);if(!found)throw Error('INVALID_SCENARIO');return found;};
function fixtureFor(key){
 const spec=definition(key),artist=key==='catalogue'?'Orion Vale':'Maya Rivers',track=key==='catalogue'?'Glass Satellites':'Northern Lights';
 return JSON.parse(JSON.stringify(fixture).replaceAll('Jordan Pike',spec.client).replaceAll('Northlight launch',spec.project).replaceAll('Artist A',artist).replaceAll('Track X',track).replaceAll('November 6, 2026',`${spec.deadline} at 17:00 America/Toronto`));
}
async function analyze(store,key,commandKey){
 const spec=definition(key),r=store.list(actor,true)[0],example=fixtureFor(key);
 const provider={id:`scripted-demo:${key}`,mode:'mock',async generate({context}){
  const result=structuredClone(example.intake);result.run_id=context.run_id;result.base_record_version=context.base_record_version;
  result.proposed_changes=result.proposed_changes.filter(p=>p.field_key!=='budget'||context.messages.some(m=>m.text.includes('CAD 5,000 for both rights')));
  for(const p of result.proposed_changes){
   if(p.field_key==='response_deadline')p.proposed_value={supplied_text:`${spec.deadline} at 17:00 America/Toronto`,date:spec.deadline,time:'17:00',timezone:'America/Toronto'};
   if(p.field_key==='territories'&&context.messages.some(m=>m.text.includes('Canada and United States'))){p.proposed_value=['Canada','United States'];p.evidence=[{message_id:'',exact_quote:'Canada and United States'}];}
   for(const e of p.evidence){const source=context.messages.toReversed().find(m=>m.text.includes(e.exact_quote));if(!source)throw Error(`DEMO_EVIDENCE_MISSING:${p.field_key}`);e.message_id=source.message_id;}
  }
  return result;
 }};
 await analyzeSavedRequest(store,{actor_id:actor,request_id:r.id,expected_revision:r.revision,idempotency_key:commandKey},{intakeProvider:provider,followUpProvider:createFollowUpMockProvider()});
}
function approve(store,id,key){const r=store.get(actor,id);store.approveBrief({actor_id:actor,request_id:id,expected_revision:r.revision,analysis_run_id:store.activeAnalysis(actor,id).run_id,idempotency_key:key});}
function assign(store,id,key){const r=store.get(actor,id),tracking=store.reviewers(actor,id);store.recordReview({actor_id:actor,request_id:id,expected_revision:r.revision,expected_review_version:tracking.version,operation:'assign',name:'Taylor Lane (demo)',role:'Master rights reviewer',idempotency_key:key});}
function finish(store,id,key){
 const r=store.get(actor,id),tracking=store.reviewers(actor,id);
 store.recordReview({actor_id:actor,request_id:id,expected_revision:r.revision,expected_review_version:tracking.version,operation:'decision',reviewer_id:tracking.reviewers[0].id,status:'Approved',notes:'Synthetic internal decision. This is not rights clearance.',idempotency_key:`${key}:decision`});
 const handoff=store.handoff(actor,id);store.saveHandoff({actor_id:actor,request_id:id,expected_revision:r.revision,expected_handoff_version:handoff.version,source_token:handoff.source_token,text:'DEMO handoff: review the saved synthetic usage scope. No licence granted.',idempotency_key:`${key}:handoff`});
 store.completeReview({actor_id:actor,request_id:id,expected_revision:r.revision,expected_review_version:store.reviewers(actor,id).version,idempotency_key:`${key}:complete`});
}
function casesFor(run){
 return journeys.map(spec=>{
  const state=run.scenarios[spec.key],store=openRequestStore(':memory:',{initialState:state.store});
  try{const id=store.list(actor,true)[0].id,r=store.get(actor,id),analysis=store.activeAnalysis(actor,id),workflow=store.workflow(actor,id),reviewers=store.reviewers(actor,id);
   // Same effective-field summary path as production; no generated facts are human-confirmed.
   r.agent_fields=effectiveFields(r,analysis,store.decisions(actor,id)).filter(field=>field.origin==='agent');
   const summary={...dashboardRequest(r,workflow,reviewers),id,revision:r.revision,updated_at:r.updated_at};
   return {id,summary,messages:r.messages,recording_id:r.recording_id,confirmed_fields:r.confirmed_fields,analysis,workflow,reviewers,catalogue_assessment:reviewRecording(r.recording_id),scenario:spec.key};
  }finally{store.close();}
 });
}
export function demoView(run){
 const cases=casesFor(run),supervision=superviseCases(cases,run.baseline,{now:new Date(run.clock)});
 return {clock:run.clock,supervision,events:run.events,scenarios:journeys.map(spec=>{const c=cases.find(c=>c.scenario===spec.key);return {...spec,step:run.scenarios[spec.key].step,status:c.workflow.status,request_id:c.id,messages:c.messages,draft:c.analysis?.result?.stages?.follow_up?.output||null,issues:c.analysis?.result?.stages?.review?.output?.issues||[],reviewers:c.reviewers.reviewers};})};
}
export async function createDemo(){
 const run={clock:'2030-05-01T16:00:00.000Z',scenarios:{},baseline:null,events:[]};
 for(const spec of journeys){
  const store=openRequestStore();try{
   let email=fixtureFor(spec.key).context.messages[0].text;
   if(spec.key==='urgent')email=email.replace('Budget CAD 5,000 for both rights. ','');
   const r=store.create({actor_id:actor,idempotency_key:`create:${spec.key}`,email:`DEMO DATA — fictional request. ${email}`,timezone:'America/Toronto',recording_id:spec.key==='catalogue'?null:'TRACK-0001'}).request;
   await analyze(store,spec.key,'initial-analysis');
   if(spec.key==='reopened'){approve(store,r.id,'initial-approval');assign(store,r.id,'initial-reviewer');finish(store,r.id,'initial-completion');}
   run.scenarios[spec.key]={step:0,store:store.exportState()};
  }finally{store.close();}
 }
 run.baseline={generated_at:run.clock,snapshots:superviseCases(casesFor(run),null,{now:new Date(run.clock)}).snapshots};
 return run;
}
export async function advanceDemo(current,key){
 const run=structuredClone(current),spec=definition(key),state=run.scenarios[key];
 if(state.step>=spec.steps.length)throw Error('SCENARIO_COMPLETE');
 const before=queueSnapshot(run);
 const store=openRequestStore(':memory:',{initialState:state.store});
 try{
  const id=store.list(actor,true)[0].id,r=store.get(actor,id),command=`${key}:${state.step}`;
  if(key==='urgent'){
   if(state.step===0)store.appendReply({actor_id:actor,request_id:id,expected_revision:r.revision,text:'DEMO client reply: Budget CAD 5,000 for both rights.',idempotency_key:command});
   if(state.step===1)await analyze(store,key,command);
   if(state.step===2){approve(store,id,command);assign(store,id,`${command}:assign`);}
   if(state.step===3)finish(store,id,command);
  }else if(key==='catalogue'){
   if(state.step===0){if(searchRecordings('Orion Vale Glass Satellites').length)throw Error('DEMO_CATALOGUE_CHANGED');resolveRecording(null);}
   if(state.step===1)store.appendReply({actor_id:actor,request_id:id,expected_revision:r.revision,text:'DEMO client reference: Glass Satellites by Orion Vale, original recording. https://example.com/demo-recording',idempotency_key:command});
   if(state.step===2)await analyze(store,key,command);
  }else{
   if(state.step===0)store.appendReply({actor_id:actor,request_id:id,expected_revision:r.revision,text:'DEMO scope change: the territory is now Canada and United States. This replaces Canada only.',idempotency_key:command});
   if(state.step===1)await analyze(store,key,command);
   if(state.step===2)approve(store,id,command);
   if(state.step===3)finish(store,id,command);
  }
  state.step++;state.store=store.exportState();
 }finally{store.close();}
 const after=queueSnapshot(run);
 run.events.push({scenario:key,label:spec.steps[state.step-1],at:run.clock,before,after,note:key==='catalogue'&&state.step===1?'No matching artist or recording in the synthetic catalogue. Request stays blocked.':null});
 return run;
}

function queueSnapshot(run){return demoView(run).supervision.items.map((item,index)=>({request_id:item.request_id,status:item.status,position:index+1,reason:item.reason}));}
export function advanceDemoClock(current){
 const run=structuredClone(current),before=queueSnapshot(run);
 run.clock=new Date(new Date(run.clock).getTime()+86400000).toISOString();
 run.events.push({scenario:'clock',label:'Advance the demo clock by one day',at:run.clock,before,after:queueSnapshot(run)});
 return run;
}
