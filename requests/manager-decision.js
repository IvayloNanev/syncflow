import {createHash} from 'node:crypto';
// A management decision applies only to the exact request and recorded reviewer scope.
export function managerDecisionToken(c){return createHash('sha256').update(JSON.stringify([c.revision,c.recording_id,c.internal_review_request?.id,c.reviewers?.version,(c.reviewers?.reviewers||[]).map(record=>Object.fromEntries(Object.entries(record).filter(([key])=>key!=='needs_reconfirmation')))])).digest('hex');}
export function resolvedEscalation(c){return c.manager_resolution?.decision==='return_to_coordinator'&&c.manager_resolution.scope_token===managerDecisionToken(c);}
