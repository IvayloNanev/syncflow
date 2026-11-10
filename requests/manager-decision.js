import {createHash} from 'node:crypto';
// A management decision applies only to the exact request and recorded reviewer scope.
export function managerDecisionToken(c){
 const scope=[c.revision,c.recording_id,c.internal_review_request?.id,c.reviewers?.version,(c.reviewers?.reviewers||[]).map(record=>Object.fromEntries(Object.entries(record).filter(([key])=>key!=='needs_reconfirmation')))];
 // Keep existing decisions valid until a user explicitly chooses a different agent.
 if(c.agent_assignment?.id)scope.push(c.agent_assignment.id);
 return createHash('sha256').update(JSON.stringify(scope)).digest('hex');
}
export function resolvedEscalation(c){return c.manager_resolution?.decision==='return_to_coordinator'&&c.manager_resolution.scope_token===managerDecisionToken(c);}
