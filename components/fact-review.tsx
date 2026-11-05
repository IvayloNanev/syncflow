"use client";

export type Evidence = { message_id: string; exact_quote: string };
export type FactProposal = { proposal_id: string; field_key: string; previous_value: unknown; proposed_value: unknown; evidence: Evidence[] };
export type ConfirmedFact = { field_key: string; state: string; value: unknown; evidence: Evidence[]; confirmed_by: string | null; confirmed_at: string | null };
export type FactDecision = { run_id: string; proposal_id: string; field_key: string; decision: string; decided_by: string; decided_at: string; resulting_revision: number };
const label = (key: string) => key.replaceAll("_", " ");
export function valueText(value: unknown): string {
  if (value == null) return "Not confirmed";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(valueText).join(", ");
  if (typeof value === "object") return Object.entries(value).filter(([,v]) => v != null).map(([k,v]) => `${label(k)}: ${valueText(v)}`).join(" · ");
  return String(value);
}
export default function FactReview({ confirmed, proposals, runId, decisions, busy, onDecide }:
  { confirmed: ConfirmedFact[]; proposals: FactProposal[]; runId: string | null; decisions: FactDecision[]; busy: boolean;
    onDecide: (proposal: FactProposal, decision: "accept" | "reject") => void }) {
  return <section className="result-panel fact-review" aria-labelledby="fact-review-heading">
    <p className="eyebrow">HUMAN REVIEW / YOU HAVE THE FINAL SAY</p><h2 id="fact-review-heading">Confirmed facts and proposed changes</h2>
    <p>Accept only what the source supports. Decisions save immediately. Reject keeps the existing confirmed value; neither action grants rights clearance.</p>
    <h3>Confirmed record <span className="count">{confirmed.filter(f => f.state === 'confirmed').length}</span></h3>
    {confirmed.filter(f => f.state === 'confirmed').length ? <div className="confirmed-grid">{confirmed.filter(f => f.state === 'confirmed').map(f => <article className="confirmed-fact" key={f.field_key}><h4>{label(f.field_key)}</h4><pre>{valueText(f.value)}</pre><small>Confirmed by {f.confirmed_by} · {f.confirmed_at}</small><details><summary>Confirmed source evidence</summary>{f.evidence.map((e,i) => <blockquote key={i}>{e.exact_quote}<small>Message: {e.message_id}</small></blockquote>)}</details></article>)}</div> : <p className="empty-inline">No confirmed facts yet. Review the proposals below to build the record.</p>}
    <h3>Proposals from this analysis</h3>
    <p className="panel-note">Review proposals individually. Decisions make the checklist and draft outdated; analyze again when finished. A new reply invalidates remaining proposals.</p>
    {proposals.length ? proposals.map(p => {
      const decision = decisions.find(d => d.run_id === runId && d.proposal_id === p.proposal_id);
      const current = confirmed.find(f => f.field_key === p.field_key && f.state === 'confirmed');
      return <article className="fact proposal-review" key={p.proposal_id}><div className="proposal-heading"><h4>{label(p.field_key)}</h4><span className="proposal-tag">{decision ? (decision.decision === 'accept' ? 'Accepted' : 'Rejected') : 'Needs your review'}</span></div><div className="fact-diff"><div><strong>Current confirmed value</strong><pre>{valueText(current?.value ?? null)}</pre></div><div><strong>Agent proposal</strong><pre>{valueText(p.proposed_value)}</pre></div></div>
        {current && JSON.stringify(current.value) !== JSON.stringify(p.proposed_value) ? <p className="change-warning">Different from the confirmed record. Replacement requires your explicit acceptance.</p> : null}
        <details><summary>View proposal source evidence ({p.evidence.length})</summary>{p.evidence.map((e,i) => <blockquote key={i}>{e.exact_quote}<small>Message: {e.message_id}</small></blockquote>)}</details>
        {decision ? <p role="status">{decision.decision === 'accept' ? 'Accepted' : 'Rejected'} · {decision.decided_by} · {decision.decided_at}</p> : <div className="decision-actions"><button type="button" className="primary-button" disabled={busy || !runId} aria-label={`Accept ${label(p.field_key)}`} onClick={() => onDecide(p,'accept')}>Accept fact</button><button type="button" className="secondary-button" disabled={busy || !runId} aria-label={`Reject ${label(p.field_key)}`} onClick={() => onDecide(p,'reject')}>Reject</button></div>}
      </article>;
    }) : <p>No current proposals to review. Analyze the saved revision to generate proposals.</p>}
    {decisions.length ? <details><summary>Saved fact decision history ({decisions.length})</summary><ul>{decisions.map(d => <li key={`${d.run_id}-${d.proposal_id}`}>{label(d.field_key)} · {d.decision} · revision {d.resulting_revision} · {d.decided_by} · {d.decided_at}</li>)}</ul></details> : null}
  </section>;
}
