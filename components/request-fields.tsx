"use client";

import { valueText, type ConfirmedFact, type FactProposal, type FactDecision } from "./fact-review";

const fields = [
  ["client_contact", "Client / contact"], ["project", "Project"],
  ["artist", "Artist"], ["track_title", "Track title"],
  ["recording_version", "Recording version"], ["intended_use", "Intended use"],
  ["platforms", "Media / platforms"], ["territories", "Territory"],
  ["campaign_term", "Campaign term"], ["music_length", "Amount of music"],
  ["budget", "Budget / currency / scope"], ["response_deadline", "Response deadline"],
];

export default function RequestFields({ confirmed, proposals, decisions, runId, busy, analyzed, stale, issues, onReview }: {
  confirmed: ConfirmedFact[]; proposals: FactProposal[]; decisions: FactDecision[]; runId: string | null;
  busy: boolean; analyzed: boolean; stale: boolean;
  issues: { field_keys: string[]; type: string; question: string }[]; onReview: () => void;
}) {
  const rows = fields.map(([key, name]) => {
    const current = confirmed.find(f => f.field_key === key && f.state === "confirmed");
    const proposal = proposals.find(p => p.field_key === key);
    const decision = proposal && decisions.find(d => d.run_id === runId && d.proposal_id === proposal.proposal_id);
    const pending = proposal && !decision;
    const value = pending ? proposal.proposed_value : current?.value;
    const evidence = pending ? proposal.evidence : current?.evidence || [];
    const fieldIssues = issues.filter(i => i.field_keys.includes(key));
    const state = busy ? "Analyzing" : pending ? "Proposed" : current ? "Confirmed" : decision?.decision === "reject" ? "Rejected" : analyzed && !stale ? "Missing" : "Waiting";
    return { key, name, value, evidence, fieldIssues, state };
  });
  const filled = rows.filter(r => r.value != null).length;
  return <section className="result-panel request-fields" aria-labelledby="request-fields-heading" aria-busy={busy}>
    <p className="eyebrow">AGENT-FILLED REQUEST RECORD</p>
    <div className="section-heading"><h2 id="request-fields-heading">The details, organized.</h2><span className="count">{filled} / 12 filled</span></div>
    <p className="panel-note">Paste the email, then select Fill request from email. The agent fills what it finds; missing answers stay visible.</p>
    {stale ? <p className="stale-banner">Previous proposals shown. Update the analysis after replies or decisions to refresh missing details.</p> : null}
    <div className="request-field-grid">{rows.map(row => <article className={`request-field-box field-${row.state.toLowerCase()}`} key={row.key}>
      <div className="request-field-label"><h3>{row.name}</h3><span>{row.state}</span></div>
      <p className="request-field-value">{row.value == null ? busy ? "Reading email…" : row.state === "Missing" ? "Unknown — ask client" : row.state === "Rejected" ? "Proposal rejected" : "Waiting for analysis" : valueText(row.value)}</p>
      {row.fieldIssues.map((issue, i) => <p className="field-question" key={i}>{issue.question}</p>)}
      {row.evidence.length ? <details><summary>Source evidence ({row.evidence.length})</summary>{row.evidence.map((e,i) => <blockquote key={i}>{e.exact_quote}<small>Message: {e.message_id}</small></blockquote>)}</details> : null}
    </article>)}</div>
    <p className="panel-note">Auto-filled values are proposals, not confirmed facts or rights clearance.</p>
    <button className="primary-button" type="button" disabled={busy || !analyzed} onClick={onReview}>Review and confirm these fields →</button>
  </section>;
}
