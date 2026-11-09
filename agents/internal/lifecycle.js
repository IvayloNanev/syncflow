import {createHash} from 'node:crypto';
import {caseSnapshot} from '../priority/supervisor.js';
import {eligibleLanes} from './triage.js';
export const REVIEW_VERSION='internal-v2';
export function reviewFingerprint(c,{now=new Date()}={}){return createHash('sha256').update(JSON.stringify({version:REVIEW_VERSION,snapshot:caseSnapshot(c).fingerprint,storage:c.storage_version,eligibility:eligibleLanes(c,{now})})).digest('hex');}
export function contextForReview(c){
 const pending=(c.reviewers?.reviewers||[]).filter(r=>r.status==='Pending'||r.needs_reconfirmation);
 return {project:c.summary.project||c.subject||`Request ${c.id.slice(0,8)}`,client:c.summary.contact||'Not supplied',recording:c.summary.track||c.recording_id||'Not confirmed',status:c.workflow.status,deadline:c.summary.deadline||null,decision:pending.length?`Awaiting ${pending.map(r=>`${r.name} (${r.role})`).join(', ')}.`:c.workflow.next_action||'Review the saved request and outstanding checks.'};
}
export function managerDraft(c,recommendation){
 if(recommendation.lane!=='manager'||!eligibleLanes(c).escalation.includes(recommendation.escalation_trigger))throw Error('MANAGER_NOT_ELIGIBLE');
 const context=contextForReview(c),deadline=context.deadline?[context.deadline.date||context.deadline.supplied_text,context.deadline.time,context.deadline.timezone].filter(Boolean).join(' · '):'Not supplied';
 return {kind:'prepared_template',subject:`Manager decision requested: ${context.project}`,body:`Hello,\n\nPlease review this music-usage request and advise on the next step.\n\nClient: ${context.client}\nProject: ${context.project}\nRecording: ${context.recording}\nResponse deadline: ${deadline}\n\nReason for escalation: ${recommendation.reason}\nEscalation trigger: ${recommendation.escalation_trigger}\n\nDecision requested: ${recommendation.next_action}\n\nPlease confirm your decision and any conditions or additional checks required.\n\nThank you`};
}
export function assessmentResult(c,recommendation,now=new Date()){
 const context=contextForReview(c);
 return {fingerprint:reviewFingerprint(c,{now}),request_version:c.storage_version,generated_at:now.toISOString(),context,recommendation,draft:recommendation.lane==='manager'?managerDraft(c,recommendation):null};
}
export function currentAssessment(c,rows,now=new Date()){const fingerprint=reviewFingerprint(c,{now});return rows.find(row=>row.request_id===c.id&&row.fingerprint===fingerprint)?.result||null;}
export function caseListing(c,assessment){
 const policy=eligibleLanes(c),lane=['Internal review complete','Case completed'].includes(c.workflow.status)?'finished':assessment?.recommendation.lane||(policy.escalation.length?'manager':policy.allowed.includes('human')?'human':'coordinator');
 return {request_id:c.id,lane,project:contextForReview(c).project,client:c.summary.contact||'Client not supplied',destination:lane==='coordinator'?'coordinator':'internal',status:c.workflow.status,track:c.summary.track||'',deadline:c.summary.deadline||null,classification_source:assessment?'assessment':'workflow'};
}
