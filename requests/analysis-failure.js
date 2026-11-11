// Persist a fixed vocabulary only. Provider messages and rejected payloads may contain private text.
const messages={
 INVALID_OUTPUT:'The agent response failed validation. No output from this attempt was accepted.',
 TIMEOUT:'The analysis timed out. Saved messages and confirmed facts are unchanged.',
 PROVIDER_NOT_CONFIGURED:'The analysis provider is not configured on the server.',
 PROVIDER_AUTH_FAILED:'The analysis provider rejected authentication. Check server credentials before retrying.',
 PROVIDER_RATE_LIMITED:'The analysis provider is rate limited. Wait before starting another attempt.',
 PROVIDER_REQUEST_REJECTED:'The analysis provider rejected this request. Check server configuration.',
 PROVIDER_ATTEMPT_UNCERTAIN:'A previous AI attempt may have reached the provider. Check saved results before explicitly retrying.',
 PROVIDER_FAILED:'The analysis provider could not complete the request.',
 INVALID_CONTEXT:'Saved analysis context failed validation. Review the request before retrying.',
 INVALID_INTAKE:'The extracted details could not pass review validation.',
 INVALID_REVIEW:'The checklist could not pass drafting validation.',
 STALE_RESULT:'The request changed while analysis was running. Recheck the current revision.',
 VERSION_CHECK_FAILED:'The current request revision could not be verified.',
 ANALYSIS_FAILED:'Analysis failed. Review the request or explicitly retry with a new command key.',
};
const diagnostics=new Set(['SCHEMA_MISMATCH','EVIDENCE_QUOTE_MISMATCH','EVIDENCE_MESSAGE_MISMATCH','RUN_ID_MISMATCH','REVISION_MISMATCH','PREVIOUS_VALUE_MISMATCH','INVALID_DATE','INVALID_TIMEZONE','CONTRACT_MISMATCH','INVALID_RESPONSE_JSON','UNEXPECTED_STOP_REASON','INVALID_TOOL_ENVELOPE']);
export function safeAnalysisFailure(result) {
 const code=Object.hasOwn(messages,result?.error?.code)?result.error.code:'ANALYSIS_FAILED';
 const validation_codes=Array.isArray(result?.error?.validation_codes)?[...new Set(result.error.validation_codes.filter(c=>diagnostics.has(c)))].slice(0,8):[];
 return {ok:false,failed_stage:['intake','review','follow_up'].includes(result?.failed_stage)?result.failed_stage:'intake',
  error:{code,message:messages[code],...(validation_codes.length?{validation_codes}: {})}};
}
