"use client";

import { previewFields } from '../catalog/email-preview.js';
import { valueText, type ConfirmedFact, type FactProposal } from './fact-review';

export default function RequestCoverage({email, analyzed, stale, proposals, confirmed, issues}: {
  email: string; analyzed: boolean; stale: boolean; proposals: FactProposal[]; confirmed: ConfirmedFact[];
  issues: {field_keys: string[]; question: string}[];
}) {
  const rows = previewFields(email).map(field => {
    const fact = confirmed.find(f => f.field_key === field.key && f.state === 'confirmed');
    const proposal = proposals.find(p => p.field_key === field.key);
    const value = analyzed ? proposal?.proposed_value ?? fact?.value : field.value;
    const questions = analyzed ? issues.filter(i => i.field_keys.includes(field.key)) : [];
    const state = value == null ? 'missing' : questions.length ? 'attention' : 'provided';
    return {...field, value, state, questions, confirmed: !!fact && !proposal};
  });
  const provided = rows.filter(r => r.state === 'provided').length;
  const missing = rows.filter(r => r.state === 'missing').length;
  const attention = rows.filter(r => r.state === 'attention').length;
  return <section className="coverage" aria-label="Email detail coverage">
    <p className="panel-note">{stale ? 'Conversation preview only — refresh analysis to verify the latest changes.' : analyzed ? 'Agent-extracted details. Provided means supplied, not confirmed or cleared.' : 'Instant preview: detected excerpts only. Analyze to verify meaning and missing details.'}</p>
    <div className="coverage-totals"><div><strong>{provided}</strong><span>Provided</span></div><div><strong>{missing}</strong><span>{analyzed ? 'Missing' : 'Not detected'}</span></div><div><strong>{attention}</strong><span>Needs clarification</span></div></div>
    <div className="coverage-bar" role="img" aria-label={`${provided} provided, ${missing} ${analyzed ? 'missing' : 'not detected'}, ${attention} need clarification, across 12 details`}>
      {rows.map(r => <span key={r.key} className={`coverage-segment ${r.state}`} />)}
    </div>
    <div className="coverage-list">{rows.map(row => <article key={row.key} className={`coverage-row ${row.state}`}>
      <span className="coverage-icon" aria-hidden="true">{row.state === 'provided' ? '✓' : row.state === 'missing' ? '−' : '!'}</span>
      <div><div className="coverage-row-label"><h3>{row.label}</h3><span>{row.state === 'provided' ? row.confirmed ? 'Confirmed' : 'Provided' : row.state === 'missing' ? analyzed ? 'Missing' : 'Not detected' : 'Clarify'}</span></div>
      <p>{row.value == null ? analyzed ? 'Not supplied — clarification needed' : 'Not detected in the email' : valueText(row.value)}</p>
      {row.questions.map((q,i) => <p className="coverage-question" key={i}>{q.question}</p>)}</div>
    </article>)}</div>
  </section>;
}
