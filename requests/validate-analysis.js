import { validateContract } from '../contracts/validate.js';
import { runReview } from '../agents/review/run-review.js';
import { isDeepStrictEqual } from 'node:util';

/** Validate a successful workflow against the immutable persisted input before activation. */
export function validateSuccessfulAnalysis(result, context) {
  const allowed = ['ok','run_id','base_record_version','freshness','status','coordinator_review_issue_ids','manual_review_required','saved','sent','stages'];
  if (!result || Object.keys(result).some(k=>!allowed.includes(k)) || result.ok!==true || result.saved!==false
      || result.sent!==false || result.manual_review_required!==true || result.run_id!==context.run_id
      || result.base_record_version!==context.base_record_version) throw Error('Invalid analysis envelope');
  const stages=result.stages;
  if(!stages||Object.keys(stages).some(k=>!['intake','review','follow_up'].includes(k))||!stages.intake?.ok||!stages.review?.ok||!stages.follow_up?.ok)throw Error('Incomplete analysis');
  validateContract('intake',stages.intake.output,context);
  const review=runReview(context,stages.intake.output);
  if(!review.ok||!isDeepStrictEqual(stages.review.output,review.output)
      ||!isDeepStrictEqual(result.coordinator_review_issue_ids,review.coordinator_issue_ids))throw Error('Review differs from input');
  const excluded=new Set(review.coordinator_issue_ids);
  const draftContext={...context,unresolved_issues:context.unresolved_issues.filter(i=>!excluded.has(i.issue_id))};
  const draftReview={...review.output,issues:review.output.issues.filter(i=>!excluded.has(i.issue_id))};
  const ids=new Set([...draftContext.unresolved_issues,...draftReview.issues].map(i=>i.issue_id));
  if(!ids.size){
    if(stages.follow_up.skipped!==true||stages.follow_up.output!==null||result.status!=='review_required')throw Error('Invalid skipped draft');
  }else{
    if(stages.follow_up.skipped||result.status!=='draft_ready_for_review')throw Error('Missing draft');
    validateContract('follow_up',stages.follow_up.output,draftContext,draftReview);
    if(stages.follow_up.output.addressed_issue_ids.length!==ids.size||stages.follow_up.output.addressed_issue_ids.some(id=>!ids.has(id)))throw Error('Incomplete draft coverage');
  }
  return result;
}
