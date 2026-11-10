// Preserve full saved text; generated drafts must never appear as sent mail.
export function caseCorrespondence(messages,runs=[],assessments=[],managerDecisions=[]){
 const entries=messages.filter(m=>m.source!=='manager_decision').map((m,index)=>({id:m.message_id||`message-${index}`,kind:m.kind==='initial'?'Original email':'Email reply',date:m.supplied_message_date||m.received_at||null,subject:null,text:m.text,draft:false}));
 for(const run of runs){const draft=run.result?.ok?run.result.stages?.follow_up?.output:null;if(draft?.body)entries.push({id:`draft-${run.run_id}`,kind:'Response draft · not sent',date:run.finished_at||run.created_at||null,subject:draft.subject||null,text:draft.body,draft:true});}
 for(const row of assessments){const result=row.result;if(result?.draft?.body)entries.push({id:`manager-${row.fingerprint}`,kind:result.recommendation?.lane==='human'?'Reviewer email draft · not sent':'Manager email draft · not sent',date:result.generated_at||null,subject:result.draft.subject,text:result.draft.body,draft:true});}
 for(const [index,decision] of managerDecisions.entries())entries.push({id:`manager-decision-${index}`,kind:'Recorded manager decision',date:decision.recorded_at,subject:null,text:`${decision.manager_name}: ${decision.notes}\nOutcome: ${decision.decision==='close_case'?'Close case':'Return to Coordinator'}`,draft:false});
 return entries.map((entry,index)=>({...entry,index})).sort((a,b)=>{const left=Date.parse(a.date),right=Date.parse(b.date);return (Number.isFinite(left)?left:Infinity)-(Number.isFinite(right)?right:Infinity)||a.index-b.index;}).map(entry=>{const result={...entry};delete result.index;return result;});
}

export function savedCorrespondence(detail){return Array.isArray(detail?.correspondence)?detail.correspondence:caseCorrespondence(Array.isArray(detail?.messages)?detail.messages:[]);}
