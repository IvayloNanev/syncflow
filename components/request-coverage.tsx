"use client";

import { coverageRows } from '../catalog/coverage-view.js';
import { valueText, type ConfirmedFact, type FactProposal } from './fact-review';

export default function RequestCoverage({email, analyzed, stale, proposals, confirmed, issues}: {
  email: string; analyzed: boolean; stale: boolean; proposals: FactProposal[]; confirmed: ConfirmedFact[];
  issues: {field_keys: string[]; question: string}[];
}) {
  const rows = coverageRows({email,analyzed,stale,proposals,confirmed,issues});
  if (!rows.length) return <section className="coverage" aria-label="Email detail coverage"><p className="panel-note">Paste the client’s email to preview the recording and request details. Nothing is missing until there is a request to check.</p></section>;
  const provided = rows.filter(r => r.state === 'provided').length;
  const missing = rows.filter(r => r.state === 'missing').length;
  const attention = rows.filter(r => r.state === 'attention').length;
  return <section className="coverage" aria-label="Email detail coverage">
    <p className="panel-note">{stale ? 'Confirmed values are preserved below. Other excerpts are a conversation preview; recheck to assess the latest changes.' : analyzed ? 'Agent-extracted details. Provided means supplied, not confirmed or cleared.' : 'Instant preview: detected excerpts only. Analyze to verify meaning and missing details.'}</p>
    <div className="coverage-totals"><div><strong>{provided}</strong><span>Supplied / confirmed</span></div><div><strong>{missing}</strong><span>{analyzed && !stale ? 'Missing' : 'Not detected'}</span></div><div><strong>{attention}</strong><span>Needs clarification</span></div></div>
    <div className="coverage-bar" role="img" aria-label={`${provided} supplied or confirmed, ${missing} ${analyzed && !stale ? 'missing' : 'not detected'}, ${attention} need clarification, across 12 details`}>
      {rows.map(r => <span key={r.key} className={`coverage-segment ${r.state}`} />)}
    </div>
    <div className="coverage-list">{rows.map(row => <article key={row.key} className={`coverage-row ${row.state}`}>
      <span className="coverage-icon" aria-hidden="true">{row.state === 'attention' ? '!' : row.source === 'confirmed' ? '✓' : row.state === 'missing' ? '−' : '·'}</span>
      <div><div className="coverage-row-label"><h3>{row.label}</h3><span>{row.source === 'confirmed' ? 'Confirmed value' : row.state === 'missing' ? analyzed && !stale ? 'Missing' : 'Not detected' : row.source === 'proposed' ? 'Proposed · not confirmed' : 'Detected · not confirmed'}</span></div>
      <p>{row.value == null ? analyzed && !stale ? 'Not supplied — clarification needed' : 'Not detected in the email' : valueText(row.value)}</p>
      {row.source === 'confirmed' && row.hasProposal ? <p className="coverage-question">{row.changed ? 'Proposed change (not confirmed)' : 'New proposal (not yet reviewed)'}: {valueText(row.proposal)}. Review its source evidence before deciding.</p> : null}
      {row.questions.map((q,i) => <p className="coverage-question" key={i}>{q.question}</p>)}</div>
    </article>)}</div>
  </section>;
}
