"use client";

import {useState} from 'react';
import {buildHandoffSummary} from '../handoff/build-summary.js';
import type {SavedRequest} from './saved-requests';
import type {Recording} from './recording-picker';

export type HandoffState = {version:number;source_token:string;latest:{version:number;source_token:string;text:string;outdated:boolean;saved_by:string;saved_at:string}|null;history:{version:number;saved_at:string;saved_by:string;request_revision:number}[]};
type Catalog = {recording: Recording | null; blockers: {question: string}[]};
export default function InternalHandoff({request, questions, catalog, analysisCurrent, pendingCount, busy, savedDraft, onSave}: {
  request: SavedRequest; questions: {question: string}[]; catalog: Catalog;
  analysisCurrent: boolean; pendingCount: number; busy: boolean; savedDraft:HandoffState; onSave:(text:string,source:string)=>Promise<boolean>;
}) {
  const [draft,setDraft] = useState<{source: string; text: string} | null>(()=>savedDraft.latest ? {source:savedDraft.latest.source_token,text:savedDraft.latest.text} : null);
  const [status,setStatus] = useState('');
  const input = {request,questions,catalog,analysisCurrent,pendingCount};
  const source = savedDraft.source_token;
  const outdated = !!draft && draft.source !== source;
  async function copy() {
    if (!draft || outdated || busy) return;
    try {await navigator.clipboard.writeText(draft.text);setStatus('Internal summary copied. Nothing was sent.');}
    catch {setStatus('Clipboard unavailable. Select and copy the summary manually.');}
  }
  return <details className="handoff-panel"><summary>Prepare an internal handoff summary</summary>
    <p>Build a report from confirmed facts and outstanding checks for your Director or internal reviewer. Unconfirmed proposals are not treated as facts.</p>
    <button className="primary-button" type="button" disabled={busy} onClick={() => {setDraft({source,text:buildHandoffSummary(input)});setStatus('');}}>{draft ? 'Regenerate from current record' : 'Generate internal summary'}</button>
    {draft ? <><p className="panel-note">Save your edits to restore them after reopening. Regenerating replaces the text in this editor; previous saved versions remain recorded.</p>{outdated ? <p role="status" className="stale-banner">The record or analysis changed. Regenerate before editing or copying this summary.</p> : null}
      <label htmlFor="internal-summary">Internal handoff summary</label><textarea id="internal-summary" rows={18} value={draft.text} disabled={busy || outdated} onChange={e => {setDraft({...draft,text:e.target.value});setStatus('');}} />
      <button className="primary-button" type="button" disabled={busy || outdated || !draft.text.trim()} onClick={async()=>{if(await onSave(draft.text,draft.source))setStatus("Handoff summary saved. Your edits will be restored on reopen.");}}>Save handoff edits</button>
      <button className="secondary-button" type="button" disabled={busy || outdated || !draft.text.trim()} onClick={copy}>Copy internal summary</button><p role="status">{status}</p>
    </> : null}
    {savedDraft.latest ? <p className="panel-note">Saved version {savedDraft.latest.version} · {savedDraft.latest.saved_by} · {savedDraft.latest.saved_at}{savedDraft.latest.outdated ? ' · Saved summary is outdated' : ''}{draft && draft.text!==savedDraft.latest.text ? ' · Editor has unsaved changes' : ''}</p> : draft ? <p className="panel-note">Not saved yet.</p> : null}
    {savedDraft.history.length ? <details><summary>Saved summary history ({savedDraft.history.length})</summary>{savedDraft.history.map(h=><p key={h.version}>Version {h.version} · request revision {h.request_revision} · {h.saved_by} · {h.saved_at}</p>)}</details> : null}
    <p className="panel-note">Preparing or copying a summary does not assign reviewers, record approval or grant music rights.</p>
  </details>;
}
