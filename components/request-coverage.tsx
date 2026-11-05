"use client";

import { coverageRows } from '../catalog/coverage-view.js';
import { valueText, type ConfirmedFact, type FactProposal } from './fact-review';

type Evidence = {message_id:string;exact_quote:string};
export default function RequestCoverage({email, analyzed, stale, proposals, confirmed, issues, agentFields = []}: {
  email: string; analyzed: boolean; stale: boolean; proposals: FactProposal[]; confirmed: ConfirmedFact[];
  issues: {field_keys: string[]; question: string}[];
  agentFields?: {field_key:string;value:unknown;evidence:Evidence[]}[];
}) {
  const rows = coverageRows({email,analyzed,stale,proposals,confirmed,issues}).map(row=>{
    const automatic=analyzed&&!stale ? agentFields.find(f=>f.field_key===row.key) : undefined;
    const evidence=automatic?.evidence || (row.source==='confirmed' ? confirmed.find(f=>f.field_key===row.key)?.evidence : proposals.find(p=>p.field_key===row.key)?.evidence) || [];
    return {...row,...(automatic ? {value:automatic.value,source:'agent',hasProposal:false} : {}),evidence};
  });
  if (!rows.length) return <p className="panel-note">Paste an email to see what’s provided and what’s missing.</p>;
  const provided=rows.filter(row=>row.state==='provided');
  const missing=rows.filter(row=>row.state!=='provided');
  return <section className="simple-request-summary" aria-label="Provided and missing request details">
    {!analyzed || stale ? <p className="panel-note">{stale?'Outdated analysis — recheck to update this summary.':'Email preview — analyze to check the details.'}</p> : null}
    <section aria-labelledby="provided-details"><h3 id="provided-details"><span aria-hidden="true">✓</span> Provided <small>{provided.length}</small></h3>
      {provided.length ? <dl>{provided.map(row=><div key={row.key}><dt>{row.label}</dt><dd>{valueText(row.value)}</dd></div>)}</dl> : <p>No details detected yet.</p>}
    </section>
    <section aria-labelledby="missing-details"><h3 id="missing-details"><span aria-hidden="true">!</span> Missing <small>{missing.length}</small></h3>
      {missing.length ? <ul>{missing.map(row=><li key={row.key}><strong>{row.label}</strong>{row.state==='attention'?<><span className="summary-clarify">Needs clarification</span><p>{row.value!=null?`Supplied: ${valueText(row.value)}`:''}</p></>:null}<p>{row.questions.length?row.questions.map(q=>q.question).join(' '):row.state==='attention'?'Resolve the conflicting information.':analyzed&&!stale?'Not supplied.':'Not detected in the email.'}</p></li>)}</ul> : <p>Nothing missing from the current checklist.</p>}
    </section>
    {rows.some(row=>row.evidence.length) ? <details className="summary-evidence"><summary>View source evidence</summary>{rows.filter(row=>row.evidence.length).map(row=><div key={row.key}><strong>{row.label}</strong><small>{row.source==='agent'?'Agent-extracted':row.source==='confirmed'?'Human-confirmed':'Extracted — check exceptions'}</small>{row.evidence.map((e,i)=><blockquote key={i}>{e.exact_quote}<small>Message: {e.message_id}</small></blockquote>)}</div>)}</details> : null}
  </section>;
}
