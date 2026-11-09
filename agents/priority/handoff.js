// A handoff is reconstructed from current server-checked evidence, never URL prose.
export function briefingHandoff(supervision,requestId,destination){
 const item=supervision.items.find(i=>i.request_id===requestId);
 if(!item)return null;
 const current=supervision.decision_source==='ai'&&!item.changed;
 return {request_id:item.request_id,project:item.project,client:item.client,rank:supervision.items.filter(i=>i.handoff.state!=='finished').findIndex(i=>i.request_id===requestId)+1,current,generated_at:supervision.saved_at,checked_at:supervision.checked_at,destination_matches:item.handoff.destination===destination,...(current?{reason:item.reason,blocker:item.blocker,next_action:item.next_action,responsible:item.responsible,deadline:item.deadline,evidence:item.evidence,handoff:item.handoff}:{changes:item.changes})};
}
