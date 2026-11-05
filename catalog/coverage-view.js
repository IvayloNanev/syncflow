import {previewFields} from './email-preview.js';

/**
 * Keep human-confirmed values separate from provisional detections and proposals.
 * @param {{email:string,analyzed:boolean,stale:boolean,proposals:{field_key:string,proposed_value:unknown}[],confirmed:{field_key:string,state:string,value:unknown}[],issues:{field_keys:string[],question:string}[]}} input
 */
export function coverageRows({email,analyzed,stale,proposals,confirmed,issues}) {
  if (!email.trim() && !confirmed.some(f=>f.state==='confirmed')) return [];
  return previewFields(email).map(field=>{
    const fact=confirmed.find(f=>f.field_key===field.key && f.state==='confirmed');
    const proposal=analyzed && !stale ? proposals.find(p=>p.field_key===field.key) : undefined;
    const value=fact ? fact.value : proposal ? proposal.proposed_value : !analyzed || stale ? field.value : null;
    const source=fact ? 'confirmed' : proposal ? 'proposed' : !analyzed || stale ? 'detected' : 'missing';
    const questions=analyzed && !stale ? issues.filter(i=>i.field_keys.includes(field.key)) : [];
    const changed=!!fact && !!proposal && JSON.stringify(fact.value)!==JSON.stringify(proposal.proposed_value);
    const state=value==null ? 'missing' : questions.length || changed ? 'attention' : 'provided';
    return {...field,value,source,questions,state,proposal:proposal?.proposed_value,hasProposal:!!proposal,changed};
  });
}
