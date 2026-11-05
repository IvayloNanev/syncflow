"use client";

import type { ConfirmedFact } from "./fact-review";

export type SavedRequest = { confirmed_fields: ConfirmedFact[]; id: string; revision: number; recording_id: string | null; coordinator_timezone: string;
  messages: { message_id: string; kind: string; text: string; received_at: string }[] };
export type RequestSummary = { id: string; revision: number; message_count: number; preview: string; recording_id: string | null };
export type AnalysisSummary = { run_id: string; base_revision: number; status: string };
export default function SavedRequests({ requests, saved, analyses, busy, reply, onReply, onAppend, onOpen, onRefresh, onNew }:
  { requests: RequestSummary[]; saved: SavedRequest | null; analyses: AnalysisSummary[]; busy: boolean; reply: string;
    onReply: (value: string) => void; onAppend: () => void; onOpen: (id: string) => void; onRefresh: () => void; onNew: () => void }) {
  return <section className="result-panel saved-panel" aria-labelledby="saved-heading">
    <p className="eyebrow">SAVED ON THIS COMPUTER · SINGLE LOCAL OPERATOR</p><h2 id="saved-heading">Request history</h2>
    <p>Emails and agent outputs are stored locally. Saving never confirms facts or grants a licence. Use fictional data for this prototype.</p>
    <div className="catalog-pagination"><button type="button" disabled={busy} onClick={onRefresh}>Refresh saved requests</button><button type="button" disabled={busy} onClick={onNew}>New request</button></div>
    {!requests.length ? <p>No saved requests yet.</p> : <ul className="catalog-list">{requests.map(r => <li key={r.id}><div><strong>{r.preview}</strong><small>{r.id.slice(0, 8)} · revision {r.revision} · {r.message_count} messages · {r.recording_id || 'Recording unresolved'}</small></div><button type="button" disabled={busy} onClick={() => onOpen(r.id)}>{saved?.id === r.id ? 'Reopen current' : 'Open request'}</button></li>)}</ul>}
    {saved ? <div className="catalog-selection"><h3>Saved request {saved.id.slice(0, 8)} · revision {saved.revision}</h3><p>The original email, timezone and recording selection are preserved. Add corrections as replies. To change the recording, start a separate request.</p>
      {saved.messages.map((m, i) => <details key={m.message_id}><summary>{i === 0 ? 'Original client email' : `Reply ${i}`} · {m.received_at}</summary><p className="message-body">{m.text}</p></details>)}
      <label htmlFor="client-reply">Append client reply or correction</label><textarea id="client-reply" rows={4} maxLength={20000} disabled={busy} value={reply} onChange={e => onReply(e.target.value)} placeholder="Paste the reply; previous messages stay unchanged." />
      <button type="button" className="secondary-button" disabled={busy || !reply.trim()} onClick={onAppend}>Save reply</button>
      <h4>Analysis history</h4>{analyses.length ? <ul>{analyses.map(a => <li key={a.run_id}>Revision {a.base_revision} · {a.status} · {a.run_id.slice(0, 8)}</li>)}</ul> : <p>No saved analysis yet.</p>}
      <p>Only a completed analysis of the current revision is shown below. Older outputs stay in the database as history.</p>
    </div> : null}
  </section>;
}
