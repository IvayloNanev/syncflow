// Only allowlisted codes cross the API boundary; provider responses stay private.
export function assessmentFailure(code){
 const errors={
  AI_NOT_CONFIGURED:[503,'AI review is not configured. Saved case files remain available.'],
  AI_UNAVAILABLE:[503,'The AI service could not complete this assessment. Retry assessment; your saved case is unchanged.'],
  AI_INVALID_OUTPUT:[503,'The AI response did not pass validation. Retry assessment; no recommendation was saved.'],
  AI_INVALID_EVIDENCE:[503,'The AI response could not be verified against this case. Retry assessment; no recommendation was saved.'],
  AI_CONTEXT_TOO_LARGE:[422,'This case is too large for one assessment. Its saved facts and correspondence remain available.'],
  REVIEW_CHANGED:[409,'This case changed during assessment. Refresh the context before reassessing.'],
  REVIEW_STORAGE_FAILED:[503,'The assessment could not be saved. Retry assessment to check for a saved result before starting again.'],
 };
 const [status,error]=errors[code]||[503,'Assessment could not finish. Retry assessment; your context and case files are preserved.'];
 return {status,body:{error,error_code:errors[code]?code:'ASSESSMENT_FAILED'}};
}
