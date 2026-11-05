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
  const keys = [...new Set([...proposals.map(p => p.field_key), ...confirmed.filter(f => f.state === 'confirmed').map(f => f.field_key)])];
  return <section className="result-panel fact-review" aria-labelledby="fact-review-heading">
    <h2 id="fact-review-heading">Request facts</h2><p className="panel-note">Confirm only what the evidence supports. Confirmation records the client’s requirements; it does not approve music use.</p>
    {keys.length ? keys.map(key => {
      const p = proposals.find(p => p.field_key === key);
      const current = confirmed.find(f => f.field_key === key && f.state === 'confirmed');
      const decision = p && decisions.find(d => d.run_id === runId && d.proposal_id === p.proposal_id);
      const pending = p && !decision;
      const different = pending && current && JSON.stringify(current.value) !== JSON.stringify(p.proposed_value);
      const evidence = pending ? p.evidence : current?.evidence || p?.evidence || [];
      return <article className="fact proposal-review" key={key}>
        <div className="proposal-heading"><h3>{label(key)}</h3><span className="proposal-tag">{pending ? 'Awaiting confirmation' : current ? 'Confirmed' : 'Rejected — no confirmed value'}</span></div>
        <pre>{valueText(pending ? p.proposed_value : current?.value)}</pre>
        {different ? <p className="change-warning">Currently confirmed: {valueText(current.value)}. Accepting replaces this value.</p> : null}
        <details><summary>Source evidence ({evidence.length})</summary>{evidence.map((e,i) => <blockquote key={i}>{e.exact_quote}<small>Message: {e.message_id}</small></blockquote>)}</details>
        {pending ? <div className="decision-actions"><button type="button" className="primary-button" disabled={busy || !runId} aria-label={`Accept ${label(key)}`} onClick={() => onDecide(p,'accept')}>Confirm fact</button><button type="button" className="secondary-button" disabled={busy || !runId} aria-label={`Reject ${label(key)}`} onClick={() => onDecide(p,'reject')}>Reject</button></div> : current ? <small>Confirmed by {current.confirmed_by} · {current.confirmed_at}</small> : null}
      </article>;
    }) : <p>No facts to confirm yet. Analyze the conversation first.</p>}
    {decisions.length ? <details><summary>Fact decision history ({decisions.length})</summary><ul>{decisions.map(d => <li key={`${d.run_id}-${d.proposal_id}`}>{label(d.field_key)} · {d.decision} · revision {d.resulting_revision} · {d.decided_by} · {d.decided_at}</li>)}</ul></details> : null}
  </section>;
}
