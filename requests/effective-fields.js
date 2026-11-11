// Read model only: never upgrades agent output into human-confirmed facts.
export function effectiveFields(request, analysis, decisions = []) {
  const fields=request.confirmed_fields.filter(f=>f.state==='confirmed').map(f=>({...f,origin:'human'}));
  if(!analysis?.result?.ok || analysis.base_revision!==request.revision)return fields;
  const blocked=new Set((analysis.result.stages?.review?.output?.issues||[]).filter(i=>!i.issue_id?.startsWith('catalogue-coverage-check')).flatMap(i=>i.field_keys||[]));
  const rejected=new Set(decisions.filter(d=>d.run_id===analysis.run_id && d.decision==='reject').map(d=>d.proposal_id));
  for(const proposal of analysis.result.stages?.intake?.output?.proposed_changes||[]){
    if(blocked.has(proposal.field_key)||rejected.has(proposal.proposal_id)||!proposal.evidence?.length)continue;
    const index=fields.findIndex(f=>f.field_key===proposal.field_key);
    // Keep the human-confirmed record intact; a current unblocked correction is a separate agent-derived value.
    if(index>=0 && JSON.stringify(fields[index].value)===JSON.stringify(proposal.proposed_value))continue;
    if(index>=0)fields.splice(index,1);
    fields.push({field_key:proposal.field_key,state:'agent_extracted',origin:'agent',value:proposal.proposed_value,evidence:proposal.evidence,run_id:analysis.run_id,base_revision:analysis.base_revision});
  }
  return fields;
}
