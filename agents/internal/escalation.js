import {resolvedEscalation} from '../../requests/manager-decision.js';
import {deadlineInstant} from '../priority/review.js';
// Shared by briefing, case browsing and Internal Review. Admission alone is not evidence.
export function escalationReasons(c,{now=new Date()}={}){
 const reviewers=c.reviewers?.reviewers||[],reasons=[];
 if(c.internal_review_request)reasons.push('Manager decision requested');
 if(reviewers.some(r=>r.status==='Declined'))reasons.push('Reviewer refusal');
 if(reviewers.some(r=>r.status==='Changes requested')&&reviewers.some(r=>r.status==='Approved'))reasons.push('Conflicting reviewer decisions');
 if(c.catalogue_assessment?.blockers?.some(b=>b.requires_manager===true||['rights_conflict','policy_exception'].includes(b.code)))reasons.push('Unresolved catalogue or rights exception');
 const due=deadlineInstant(c.summary?.deadline);
 if(due!==null&&due<now.getTime()&&reviewers.some(r=>r.status==='Pending'||r.needs_reconfirmation))reasons.push('Overdue client commitment with unresolved review');
 return resolvedEscalation(c)?reasons.filter(reason=>!c.manager_resolution.resolved_triggers?.includes(reason)):reasons;
}
