import {caseTitle} from '../../requests/case-title.js';
import {escalationReasons} from '../internal/escalation.js';
import {createHash} from 'node:crypto';
import {reviewPriorities,orderByDeadlineGroup} from './review.js';
const hash=value=>createHash('sha256').update(JSON.stringify(value??null)).digest('hex');
export function caseSnapshot(c){
 const facets={emails:hash(c.messages),analysis:hash(c.analysis),details:hash(c.confirmed_fields),catalogue:hash({recording:c.recording_id,assessment:c.catalogue_assessment}),reviewers:hash(c.reviewers),workflow:hash({workflow:c.workflow,manager_resolution:c.manager_resolution,internal_review_request:c.internal_review_request,agent_assignment:c.agent_assignment})};
 return {fingerprint:hash(facets),facets};
}
export function caseHandoff(c,{now=new Date()}={}){
 const status=c.workflow.status,issues=c.analysis?.result?.stages?.review?.output?.issues||[];
 if(['Internal review complete','Case completed'].includes(status))return {stage:'finished',label:'Internal review complete',destination:'internal',anchor:'internal-handoff',state:'finished'};
 if(escalationReasons(c,{now}).length)return {stage:'internal',label:'Prepare manager escalation',destination:'internal',anchor:'manager-escalation',state:'action'};
 if(status==='Needs analysis'||!c.analysis)return {stage:'analysis',label:'Analyze conversation',destination:'coordinator',anchor:'analyze-heading',state:'action'};
 if(!c.recording_id||['Recording unresolved','Recording mismatch'].includes(status)||c.catalogue_assessment?.status==='not_found')return {stage:'catalogue',label:'Check catalogue & recording',destination:'coordinator',anchor:'request-record',state:'blocked'};
 if(issues.length||['Needs clarification','Needs request details'].includes(status))return {stage:'response',label:'Review response draft',destination:'coordinator',anchor:'client-response',state:'blocked'};
 if(status==='Ready for coordination'||status==='Needs coordinator review')return {stage:'response',label:'Continue coordination',destination:'coordinator',anchor:'client-response',state:'action'};
 return {stage:'follow_up',label:'Manage reviewer follow-up',destination:'coordinator',anchor:'reviewer-follow-up',state:'action'};
}
// The model chooses an action; the server owns every route and eligibility rule.
export function eligibleHandoffs(c,options){const primary=caseHandoff(c,options);return [{...primary,action:primary.stage}];}
/** @param {object[]} cases @param {{snapshots?:Object,report?:Object,generated_at?:string}|null} saved */
export function superviseCases(cases,saved=null,{now=new Date()}={}){
 const summaries=cases.map(c=>({...c.summary,status:c.workflow.status}));
 const review=reviewPriorities(summaries,{now});
 const snapshots=Object.fromEntries(cases.map(c=>[c.id,caseSnapshot(c)]));
 const labels={emails:'Email conversation changed',analysis:'Analysis updated',details:'Request details changed',catalogue:'Catalogue check changed',reviewers:'Reviewer decisions changed',workflow:'Workflow status changed'};
 const decisionCurrent=saved?.report?.decision_version===5&&saved.generated_at?.slice(0,10)===now.toISOString().slice(0,10)&&cases.every(c=>saved?.snapshots?.[c.id]?.fingerprint===snapshots[c.id].fingerprint)&&saved.report.items.length===cases.filter(c=>!['Internal review complete','Case completed'].includes(c.workflow.status)).length&&cases.every(c=>['Internal review complete','Case completed'].includes(c.workflow.status)||saved.report.items.some(item=>item.request_id===c.id&&eligibleHandoffs(c,{now}).some(h=>h.action===item.action)));
 const items=cases.map(c=>{
  const current=snapshots[c.id],previous=saved?.snapshots?.[c.id];
  const changed=!previous||previous.fingerprint!==current.fingerprint;
  const changes=!previous?['New since the saved briefing']:Object.keys(labels).filter(key=>previous.facets[key]!==current.facets[key]).map(key=>labels[key]);
  let handoff=caseHandoff(c,{now});const ranked=review.items.find(r=>r.request_id===c.id);
  const candidate=decisionCurrent?saved?.report?.items?.find(item=>item.request_id===c.id):null;
  const ai=candidate&&eligibleHandoffs(c,{now}).some(h=>h.action===candidate.action)?candidate:null;
  const decision=decisionCurrent?ai:null;
  if(decision){const selected=eligibleHandoffs(c,{now}).find(h=>h.action===decision.action);if(selected)handoff=selected;}
  const issues=c.analysis?.result?.stages?.review?.output?.issues||[];
  const evidence=[{kind:'workflow',text:`Saved workflow: ${c.workflow.status}`}];
  if(c.catalogue_assessment)evidence.push({kind:'catalogue',text:c.catalogue_assessment.blockers?.map(blocker=>blocker.question||blocker.code).join(' ')||JSON.stringify(c.catalogue_assessment)});
  for(const issue of issues)evidence.push({kind:'analysis',text:issue.question||issue.message||issue.reason||issue.description||issue.code||'Unresolved checklist issue'});
  for(const reviewer of c.reviewers?.reviewers||[])evidence.push({kind:'reviewer',text:`${reviewer.name} (${reviewer.role}): ${reviewer.status}${reviewer.needs_reconfirmation?' — reconfirmation required':''}${reviewer.notes?`: ${reviewer.notes}`:''}`});
  for(const citation of ai?.citations||[])evidence.push({kind:'email',text:citation.exact_quote});
  return {request_id:c.id,client:c.summary.contact||'Client not identified',project:caseTitle(c),status:c.workflow.status,deadline:c.summary.deadline||null,responsible:handoff.destination==='internal'?'Manager':'Coordinator',handoff,reason:decision?.reason||(handoff.destination==='internal'?escalationReasons(c,{now}).join('; '):null)||ranked?.reason||'Internal review is complete; rights clearance remains separate.',blocker:ai?.blocker||c.workflow.reasons.join(' ')||'No internal-review blockers.',next_action:decision?.next_action||(handoff.destination==='internal'?'Assess the escalation and prepare a manager decision email.':handoff.stage==='follow_up'?'Follow up with the reviewer and record their decision in Coordinator.':c.workflow.next_action),changes,changed,explanation_source:ai?'ai':'saved_state',evidence,priority:ranked?.rank??99};
 });
 const order=new Map((decisionCurrent?orderByDeadlineGroup(saved.report.items,review).map(item=>item.request_id):review.ranked_request_ids).map((id,index)=>[id,index]));
 items.sort((a,b)=>(order.get(a.request_id)??Infinity)-(order.get(b.request_id)??Infinity)||a.request_id.localeCompare(b.request_id));
 return {decision_source:decisionCurrent?'ai':'workflow',checked_at:now.toISOString(),saved_at:saved?.generated_at||null,items,snapshots,changed_count:items.filter(i=>i.changed).length,finished_count:items.filter(i=>i.handoff.state==='finished').length,review};
}
