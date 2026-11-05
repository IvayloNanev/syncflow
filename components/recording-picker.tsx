"use client";

import { useState } from "react";
import { recordings, searchRecordings } from "../catalog/recordings.js";
import { scenarios } from "../catalog/scenarios.js";

export type Recording = (typeof recordings)[number];
type Props = { selected: Recording | null; disabled: boolean; allowScenarios?:boolean; onSelect: (recording: Recording | null) => void; onScenario: (email: string) => void };
export default function RecordingPicker({ selected, disabled, onSelect, onScenario, allowScenarios=true }: Props) {
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState("");
  const [page, setPage] = useState(0);
  const matches = searchRecordings(query, { version });
  const pages = Math.max(1, Math.ceil(matches.length / 10));
  const currentPage = Math.min(page, pages - 1);
  return <section className="result-panel catalog-panel" aria-labelledby="catalog-heading">
    <p className="eyebrow">RECORDING LOOKUP · 1,000 FICTIONAL RECORDINGS</p>
    <h3 id="catalog-heading">Which recording does the client mean?</h3>
    <p>Search by title, artist or ID, then choose the exact version before saving. Fictional catalog metadata is separate from client facts.</p>
    {disabled ? <p className="catalog-locked"><strong>Recording selection is temporarily unavailable.</strong> Wait for the current action to finish.</p> : null}
    {allowScenarios ? <details className="scenario-disclosure"><summary>Explore 10 fictional client scenarios</summary><label htmlFor="catalog-scenario">Load a sample brief</label>
    <select id="catalog-scenario" disabled={disabled} defaultValue="" onChange={e => {
      const scenario = scenarios.find(s => s.id === e.target.value);
      if (scenario) { setQuery(scenario.query); setVersion(""); setPage(0); onSelect(null); onScenario(scenario.email); }
    }}><option value="" disabled>Choose one of 10 examples…</option>{scenarios.map(s => <option key={s.id} value={s.id}>{s.id} · {s.name}</option>)}</select></details> : null}
    <div className="catalog-controls"><div><label htmlFor="catalog-query">Search catalog</label><input id="catalog-query" value={query} disabled={disabled} placeholder="Northern Lights, Maya Rivers, TRACK-0001…" onChange={e => { setQuery(e.target.value); setPage(0); }} /></div>
      <div><label htmlFor="catalog-version">Version</label><select id="catalog-version" value={version} disabled={disabled} onChange={e => { setVersion(e.target.value); setPage(0); }}><option value="">All versions</option>{['Original','Instrumental','Live','Remix'].map(v => <option key={v}>{v}</option>)}</select></div></div>
    <p role="status">{matches.length} matching recordings. {matches.length > 1 ? 'Check artist and version before selecting.' : ''}</p>
    <ul className="catalog-list">{matches.slice(currentPage * 10, currentPage * 10 + 10).map(r => <li key={r.id}><div><strong>{r.title}</strong><span>{r.artist} · {r.version} · {r.id}</span><small>{r.genre} · {r.mood} · {r.bpm} BPM</small></div><button type="button" className="secondary-button" disabled={disabled} aria-pressed={selected?.id === r.id} onClick={() => onSelect(r)}>{selected?.id === r.id ? 'Selected' : 'Select recording'}</button></li>)}</ul>
    {!matches.length ? <p>No match. Ask the client for the artist, version or recording ID. You can still analyze the email for missing details.</p> : <div className="catalog-pagination"><button type="button" disabled={disabled || currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage + 1} of {pages}</span><button type="button" disabled={disabled || currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>}
    {selected ? <aside className="catalog-selection"><h4>Selected recording: {selected.title}</h4><p>{selected.artist} · {selected.version} · {selected.id}</p><dl><dt>Label</dt><dd>{selected.label}</dd><dt>Master contact</dt><dd>{selected.master_contact || 'Missing — needs follow-up'}</dd><dt>Publishing</dt><dd>{selected.publishing_status}</dd><dt>Available assets</dt><dd>{selected.assets.join(', ') || 'None listed — verify availability'}</dd></dl>{selected.metadata_warning ? <p className="analysis-error">{selected.metadata_warning}</p> : null}<p>Selection is not rights approval. These details are checked separately and never become client email evidence.</p><button type="button" disabled={disabled} onClick={() => onSelect(null)}>Clear selection</button></aside> : <p className="panel-note">No recording selected. Analysis can identify gaps, but recording identity remains unresolved. For multiple recordings, create a separate request for each; this screen does not split them automatically.</p>}
  </section>;
}
