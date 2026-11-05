"use client";

import type { ReactNode } from "react";
import type { ConfirmedFact } from "./fact-review";

export type SavedRequest = { confirmed_fields: ConfirmedFact[]; id: string; revision: number; recording_id: string | null; coordinator_timezone: string;
  messages: { message_id: string; kind: string; text: string; received_at: string }[] };
export type RequestSummary = { project?:string|null; contact?:string|null; track?:string|null; deadline?:{date:string|null;time:string|null;timezone:string|null;supplied_text:string|null}|null;status?:string;responsible?:string;blocker?:string;next_action?:string; id: string; revision: number; message_count: number; preview: string; recording_id: string | null };
export type AnalysisSummary = { run_id: string; base_revision: number; status: string; message_count?: number; draft?: {subject: string; body: string} | null };
export default function SavedRequests({ requests, saved, analyses, busy, reply, onReply, onAppend, onOpen, onRefresh, onNew, variant = "navigation", response, activeRunId, onRecheck }:
  { requests: RequestSummary[]; saved: SavedRequest | null; analyses: AnalysisSummary[]; busy: boolean; reply: string;
    onReply: (value: string) => void; onAppend: () => void; onOpen: (id: string) => void; onRefresh: () => void; onNew: () => void;
    response?: ReactNode; activeRunId?: string; onRecheck?: () => void; variant?: "navigation" | "conversation" }) {
  if (variant === "conversation") return saved ? <section className="conversation-panel" aria-labelledby="conversation-heading">
    <div className="section-heading"><div><p className="eyebrow">PRESERVED SOURCE MESSAGES</p><h3 id="conversation-heading">Conversation</h3></div><span className="count">{saved.messages.length} messages</span></div>
    <div className="message-timeline">{saved.messages.map((m, i) => <div key={m.message_id}><details open={i === 0 || i === saved.messages.length - 1}><summary><span>{i === 0 ? 'Original client email' : `Client reply ${i}`}</span><small>{new Date(m.received_at).toLocaleString()}</small></summary><p className="message-body">{m.text}</p></details>{analyses.filter(a => a.message_count === i + 1 && a.draft && a.run_id !== activeRunId).map(a => <details className="historical-response" key={a.run_id}><summary>Previous generated response · revision {a.base_revision} · draft, not sent</summary><strong>{a.draft?.subject}</strong><p className="message-body">{a.draft?.body}</p></details>)}</div>)}</div>
    {response}
    <div className="reply-composer"><label htmlFor="client-reply">Paste the client’s reply</label><textarea id="client-reply" rows={5} maxLength={20000} disabled={busy} value={reply} onChange={e => onReply(e.target.value)} placeholder="Paste the client’s answers here, then recheck the request…" />
    <div className="composer-footer"><small>Appends the reply and checks the whole conversation again. Nothing is sent.</small><button type="button" className="primary-button" disabled={busy || !reply.trim()} onClick={onRecheck || onAppend}>{busy ? 'Rechecking…' : 'Add reply & recheck'}</button></div></div>
    <details className="history-disclosure"><summary>Analysis history <span>{analyses.length} runs</span></summary>{analyses.length ? <ul>{analyses.map(a => <li key={a.run_id}><span>Revision {a.base_revision}</span><span className="count">{a.status}</span><small>{a.run_id.slice(0, 8)}</small></li>)}</ul> : <p>No analysis yet.</p>}<small>Older outputs are retained. Only current analysis is used for the checklist and draft.</small></details>
  </section> : null;
  return <section className="request-navigation" aria-labelledby="saved-heading">
    <button type="button" className="new-request-button" disabled={busy} onClick={onNew}><span aria-hidden="true">＋</span> New request</button>
    <div className="sidebar-section-heading"><h2 id="saved-heading">Your requests <span>{requests.length}</span></h2><button type="button" className="icon-button" disabled={busy} onClick={onRefresh} aria-label="Refresh saved requests" title="Refresh saved requests">↻</button></div>
    {!requests.length ? <div className="sidebar-empty"><span aria-hidden="true">♫</span><p>A place for every request.</p><small>Saved requests will appear here.</small></div> : <ul className="request-list">{requests.map(r => <li key={r.id}><button type="button" className={saved?.id === r.id ? "request-link selected" : "request-link"} disabled={busy} onClick={() => onOpen(r.id)} aria-current={saved?.id === r.id ? "page" : undefined}><span className="request-preview">{r.preview || 'Untitled request'}</span><span className="request-meta">{r.recording_id || 'Recording not selected'}</span><span className="request-meta">Rev {r.revision} <span aria-hidden="true">·</span> {r.message_count} {r.message_count === 1 ? 'message' : 'messages'}</span></button></li>)}</ul>}
  </section>;
}
