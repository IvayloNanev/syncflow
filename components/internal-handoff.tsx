"use client";

import {useState} from 'react';
import {buildHandoffSummary} from '../handoff/build-summary.js';
import type {SavedRequest} from './saved-requests';
import type {Recording} from './recording-picker';

type Catalog = {recording: Recording | null; blockers: {question: string}[]};
export default function InternalHandoff({request, questions, catalog, analysisCurrent, pendingCount, busy}: {
  request: SavedRequest; questions: {question: string}[]; catalog: Catalog;
  analysisCurrent: boolean; pendingCount: number; busy: boolean;
}) {
  const [draft,setDraft] = useState<{source: string; text: string} | null>(null);
  const [status,setStatus] = useState('');
  const input = {request,questions,catalog,analysisCurrent,pendingCount};
  const source = JSON.stringify(input);
  const outdated = !!draft && draft.source !== source;
  async function copy() {
    if (!draft || outdated || busy) return;
    try {await navigator.clipboard.writeText(draft.text);setStatus('Internal summary copied. Nothing was sent.');}
    catch {setStatus('Clipboard unavailable. Select and copy the summary manually.');}
  }
  return <details className="handoff-panel"><summary>Prepare an internal handoff summary</summary>
    <p>Build a report from confirmed facts and outstanding checks for your Director or internal reviewer. Unconfirmed proposals are not treated as facts.</p>
    <button className="primary-button" type="button" disabled={busy} onClick={() => {setDraft({source,text:buildHandoffSummary(input)});setStatus('');}}>{draft ? 'Regenerate from current record' : 'Generate internal summary'}</button>
    {draft ? <><p className="panel-note">Edits stay in this browser view. Copy before leaving. Regenerating replaces your edits.</p>{outdated ? <p role="status" className="stale-banner">The record or analysis changed. Regenerate before editing or copying this summary.</p> : null}
      <label htmlFor="internal-summary">Internal handoff summary</label><textarea id="internal-summary" rows={18} value={draft.text} disabled={busy || outdated} onChange={e => {setDraft({...draft,text:e.target.value});setStatus('');}} />
      <button className="secondary-button" type="button" disabled={busy || outdated || !draft.text.trim()} onClick={copy}>Copy internal summary</button><p role="status">{status}</p>
    </> : null}
    <p className="panel-note">Preparing or copying a summary does not assign reviewers, record approval or grant music rights.</p>
  </details>;
}
