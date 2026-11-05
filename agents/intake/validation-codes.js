// Never expose ContractError messages: they may contain provider/client text.
export function validationCodes(error) {
  const codes=new Set();
  for(const message of error?.errors || []) {
    if(typeof message!=='string') continue;
    if(message.startsWith('/')) codes.add('SCHEMA_MISMATCH');
    else if(message.startsWith('Evidence quote not found')) codes.add('EVIDENCE_QUOTE_MISMATCH');
    else if(message.startsWith('Unknown evidence message')) codes.add('EVIDENCE_MESSAGE_MISMATCH');
    else if(message==='Run ID does not match context') codes.add('RUN_ID_MISMATCH');
    else if(message==='Stale base record version') codes.add('REVISION_MISMATCH');
    else if(message.includes(': previous value differs from confirmed state')) codes.add('PREVIOUS_VALUE_MISMATCH');
    else if(message.startsWith('Invalid calendar date')) codes.add('INVALID_DATE');
    else if(message.startsWith('Invalid timezone')) codes.add('INVALID_TIMEZONE');
    else codes.add('CONTRACT_MISMATCH');
  }
  return [...codes].slice(0,8);
}
