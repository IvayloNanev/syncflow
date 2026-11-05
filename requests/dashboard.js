// Current validated extraction is separate from human-confirmed history.
export function dashboardRequest(request, workflow, tracking) {
  const value=key=>request.agent_fields?.find(f=>f.field_key===key)?.value ?? request.confirmed_fields.find(f=>f.field_key===key&&f.state==='confirmed')?.value ?? null;
  const deadline=value('response_deadline');
  const waiting=tracking.reviewers.filter(r=>r.needs_reconfirmation||r.status!=='Approved');
  const responsible=workflow.status==='Internal review pending' || ['Changes requested','Declined'].includes(workflow.status)
    ? waiting.map(r=>`${r.name} (${r.role})`).join(', ') || 'Coordinator' : 'Coordinator';
  return {
    agent_extracted:!!request.agent_fields?.length,
    project:typeof value('project')==='string'?value('project'):null,
    contact:typeof value('client_contact')==='string'?value('client_contact'):null,
    track:typeof value('track_title')==='string'?value('track_title'):null,
    deadline:deadline && typeof deadline==='object' ? {date:deadline.date ?? null,time:deadline.time ?? null,timezone:deadline.timezone ?? null,supplied_text:deadline.supplied_text ?? null} : null,
    status:workflow.status,responsible,
    blocker:workflow.reasons.join(' ') || 'No internal-review blockers. Rights verification and licensing remain separate.',
    next_action:workflow.next_action,
  };
}
