import {caseTitle} from '../../requests/case-title.js';
import {inquiryLabels} from '../../requests/inquiry-labels.js';
import {createHash} from 'node:crypto';
import {caseSnapshot} from '../priority/supervisor.js';
import {eligibleLanes} from './triage.js';
export const REVIEW_VERSION='internal-v6-full-correspondence';
export function reviewFingerprint(c,{now=new Date()}={}){return createHash('sha256').update(JSON.stringify({version:REVIEW_VERSION,snapshot:caseSnapshot(c).fingerprint,storage:c.storage_version,eligibility:eligibleLanes(c,{now})})).digest('hex');}
export function contextForReview(c){
 const pending=(c.reviewers?.reviewers||[]).filter(r=>r.status==='Pending'||r.needs_reconfirmation);
 return {project:caseTitle(c),client:c.summary.contact||'Not supplied',recording:c.summary.track||c.recording_id||'Not confirmed',status:c.workflow.status,deadline:c.summary.deadline||null,decision:pending.length?`Awaiting ${pending.map(r=>`${r.name} (${r.role})`).join(', ')}.`:c.workflow.next_action||'Review the saved request and outstanding checks.'};
}
export function managerDecisionQuestion(c,recommendation){
 const pending=(c.reviewers?.reviewers||[]).filter(r=>r.status==='Pending'||r.needs_reconfirmation).map(r=>r.name).filter(Boolean).join(', ')||'the assigned reviewer';
 switch(recommendation.escalation_trigger){
 case 'Manual Internal Review requested':return 'What decision, conditions or additional checks are needed before this case can proceed with coordination?';
 case 'Manager decision requested':return c.internal_review_request.question;
 case 'Reviewer refusal':return 'Given the recorded reviewer refusal, should we decline the request, seek revised terms, or appoint an alternate reviewer, and what conditions should apply?';
 case 'Conflicting reviewer decisions':return 'How should we resolve the conflicting reviewer decisions, and which conditions or additional review must be satisfied before the request can proceed?';
 case 'Unresolved catalogue or rights exception':return 'Who should resolve the documented rights or policy exception, and what evidence or conditions must be satisfied before any client commitment?';
 case 'Overdue client commitment with unresolved review':return `The client response deadline has passed while ${pending} has not confirmed a decision. Who should take ownership, what revised response deadline should we give the client, and should we pause the request pending review?`;
 default:throw Error('MANAGER_NOT_ELIGIBLE');
 }
}
export function managerDraft(c,recommendation,{now=new Date()}={}){
 if(recommendation.lane!=='manager'||!eligibleLanes(c,{now}).escalation.includes(recommendation.escalation_trigger))throw Error('MANAGER_NOT_ELIGIBLE');
 const context=contextForReview(c),deadline=context.deadline?[context.deadline.date||context.deadline.supplied_text,context.deadline.time,context.deadline.timezone].filter(Boolean).join(' · '):'Not supplied';
 return {kind:'prepared_template',subject:`Manager decision requested: ${context.project}`,body:`Hello,\n\nPlease review this music-usage request and advise on the next step.\n\nClient: ${context.client}\nProject: ${context.project}\nRecording: ${context.recording}\nResponse deadline: ${deadline}\n\nReason for escalation: ${c.internal_review_request?.reason||recommendation.reason}\nEscalation trigger: ${recommendation.escalation_trigger}\n\nManager decision needed: ${managerDecisionQuestion(c,recommendation)}\n\nPlease confirm your decision and any conditions or additional checks required.\n\nThank you`};
}
export function assessmentResult(c,recommendation,now=new Date()){
 if(recommendation.lane==='manager')recommendation={...recommendation,next_action:managerDecisionQuestion(c,recommendation)};
 const context=contextForReview(c);
 return {fingerprint:reviewFingerprint(c,{now}),request_version:c.storage_version,generated_at:now.toISOString(),context,recommendation,draft:recommendation.lane==='manager'?managerDraft(c,recommendation,{now}):null};
}
export function currentAssessment(c,rows,now=new Date()){const fingerprint=reviewFingerprint(c,{now});return rows.find(row=>row.request_id===c.id&&row.fingerprint===fingerprint)?.result||null;}
// Queue and assessment updates can occur without changing the request aggregate.
export function reviewListVersion(cases,rows){
 return createHash('sha256').update(JSON.stringify({cases:cases.map(c=>[c.id,c.storage_version,reviewFingerprint(c)]).sort(),queue:rows.queue.map(r=>[r.request_id,r.active,r.admitted_at,r.returned_at]).sort(),assessments:rows.assessments.map(r=>[r.request_id,r.fingerprint]).sort()})).digest('hex');
}
export function caseListing(c,assessment,{now=new Date()}={}){
 const lane=['Internal review complete','Case completed'].includes(c.workflow.status)?'finished':assessment?.recommendation.lane||(eligibleLanes(c,{now}).escalation.length?'manager':'coordinator');
 return {request_id:c.id,fingerprint:reviewFingerprint(c),lane,project:caseTitle(c),client:c.summary.contact||inquiryLabels(c.messages?.[0]?.text||'').sender||'Client not supplied',destination:lane==='coordinator'?'coordinator':'internal',status:c.workflow.status,track:c.summary.track||'',deadline:c.summary.deadline||null,classification_source:assessment?'assessment':'workflow'};
}
