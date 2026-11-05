"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import SavedRequests, { type SavedRequest, type RequestSummary, type AnalysisSummary } from "./saved-requests";
import { recordings } from "../catalog/recordings.js";
import RecordingPicker, { type Recording } from "./recording-picker";

type Evidence = { message_id: string; exact_quote: string };
type Proposal = { proposal_id: string; field_key: string; proposed_value: unknown; evidence: Evidence[] };
type Issue = { issue_id: string; type: string; severity: string; field_keys: string[]; question: string };
type Result = {
  catalog_review?: { recording: Recording | null; cleared: false; blockers: { code: string; question: string; audience: string }[] };
  ok: boolean;
  error?: { message?: string };
  coordinator_review_issue_ids?: string[];
  stages?: {
    intake?: { output?: { proposed_changes: Proposal[] } };
    review?: { output?: { issues: Issue[] } };
    follow_up?: { skipped?: boolean; output?: { subject: string; body: string } | null };
  };
};
const example = "Contact: Jordan Pike. Artist A / Track X (original recording) for an online ad in Canada. Budget CAD 5,000 for both rights. Deadline November 6, 2026.";
const label = (key: string) => key.replaceAll("_", " ");
function display(value: unknown): string {
  if (value === null) return "Not supplied";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${label(key)}: ${item === null ? "Not supplied" : String(item)}`).join("\n");
  return String(value);
}

export default function AnalysisWorkspace() {
  const [saved, setSaved] = useState<SavedRequest | null>(null);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [reply, setReply] = useState("");
  const [notice, setNotice] = useState("");
  const retryCommands = useRef(new Map<string, string>());
  const [recording, setRecording] = useState<Recording | null>(null);
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [draft, setDraft] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  function clearResult() { setResult(null); setError(""); setSubject(""); setDraft(""); setCopyStatus(""); }
  type Detail = { request: SavedRequest; catalog_review: Result["catalog_review"]; active_analysis: { result: Result } | null; analyses: AnalysisSummary[]; analysis_status?: string };
  async function command(payload: Record<string, unknown>) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 70000);
    try {
      const response = await fetch("/api/requests", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Request could not complete.");
      return data;
    } finally { clearTimeout(timer); }
  }
  function keyed(payload: Record<string, unknown>) {
    const signature = JSON.stringify(payload);
    let key = retryCommands.current.get(signature);
    if (!key) { key = crypto.randomUUID(); retryCommands.current.set(signature, key); }
    return { ...payload, idempotency_key: key };
  }
  async function refresh() { const data = await command({ action: "list" }); setRequests(data.requests); }
  useEffect(() => {
    let mounted = true;
    command({ action: "list" }).then(data => { if (mounted) setRequests(data.requests); })
      .catch(() => { if (mounted) setNotice("Saved requests could not load. Use Refresh saved requests to retry."); });
    return () => { mounted = false; };
  }, []);
  function showSaved(data: Detail) {
    clearResult(); setSaved(data.request); setEmail(data.request.messages[0].text); setTimezone(data.request.coordinator_timezone);
    setRecording(recordings.find(r => r.id === data.request.recording_id) || null); setAnalyses(data.analyses);
    if (data.active_analysis?.result?.ok) {
      const active = { ...data.active_analysis.result, catalog_review: data.catalog_review };
      setResult(active); setSubject(active.stages?.follow_up?.output?.subject || ""); setDraft(active.stages?.follow_up?.output?.body || "");
    }
  }
  async function perform(task: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(""); setNotice("");
    try { await task(); }
    catch (failure) { setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "Connection interrupted. Reopen or refresh before retrying; a command may have completed. Your unsent text is retained."); }
    finally { running.current = false; setBusy(false); }
  }
  async function save() {
    const payload = { action: "create", email, timezone, recording_id: recording?.id ?? null };
    const data: Detail = await command(keyed(payload)); showSaved(data); await refresh();
    setNotice("Request saved. Facts remain unconfirmed."); return data.request;
  }
  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(async () => {
      const record = saved || await save(); clearResult();
      const payload = { action: "analyze", request_id: record.id, expected_revision: record.revision };
      const data: Detail = await command(keyed(payload)); showSaved(data);
      if (data.analysis_status === "completed") { retryCommands.current.delete(JSON.stringify(payload)); setNotice("Analysis saved for this revision. All extracted facts remain proposals."); }
      else if (data.analysis_status === "running") setNotice("This run is still pending. Reopen the request to check it. Use Retry analysis with a new run only if you explicitly want another attempt.");
      else { retryCommands.current.delete(JSON.stringify(payload)); setNotice(`Analysis is ${data.analysis_status}. History is preserved. Review the saved request before explicitly retrying.`); }
      await refresh();
    });
  }
  function newRequest() {
    retryCommands.current.clear();
    setSaved(null); setEmail(""); setRecording(null); setReply(""); setAnalyses([]); setNotice(""); clearResult();
  }
  async function copyDraft() {
    try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${draft}`); setCopyStatus("Draft copied. Nothing was sent."); }
    catch { setCopyStatus("Clipboard unavailable. Select and copy the draft manually."); }
  }
  const proposals = result?.stages?.intake?.output?.proposed_changes || [];
  const issues = result?.stages?.review?.output?.issues || [];
  return (
    <>
      <SavedRequests requests={requests} saved={saved} analyses={analyses} busy={busy} reply={reply} onReply={setReply}
        onRefresh={() => { void perform(refresh); }} onNew={newRequest}
        onOpen={id => { void perform(async () => { const data = await command({ action: "get", request_id: id }); showSaved(data); setReply(""); setNotice("Saved request reopened."); }); }}
        onAppend={() => { void perform(async () => {
          if (!saved) return;
          const data = await command(keyed({ action: "reply", request_id: saved.id, expected_revision: saved.revision, text: reply }));
          showSaved(data); setReply(""); await refresh(); setNotice("Reply saved. Earlier analysis is outdated; analyze the new revision.");
        }); }} />
      <RecordingPicker selected={recording} disabled={busy || !!saved} onSelect={r => { setRecording(r); clearResult(); }} onScenario={text => { setEmail(text); clearResult(); }} />
      <section className="request-section analysis-input" id="analyze" aria-labelledby="analyze-heading">
        <div className="section-heading"><div><p className="eyebrow">START WITH THE CLIENT EMAIL</p><h2 id="analyze-heading">Review a music request</h2></div><span className="count">{saved ? `Saved · revision ${saved.revision}` : "Unsaved request"}</span></div>
        <form onSubmit={analyze} aria-busy={busy}>
          <label htmlFor="client-email">Client email</label>
          <textarea id="client-email" rows={7} maxLength={20000} value={email} disabled={busy || !!saved} required
            placeholder="Paste the client's music-use request here…" onChange={e => { setEmail(e.target.value); setRecording(null); clearResult(); }} />
          <div className="input-actions">
            <div><label htmlFor="request-timezone">Coordinator timezone</label><input id="request-timezone" value={timezone} disabled={busy || !!saved} required
              onChange={e => { setTimezone(e.target.value); clearResult(); }} aria-describedby="timezone-help" /><small id="timezone-help">For example, America/New_York. Client deadlines are never inferred from this.</small></div>
            <button className="secondary-button" type="button" disabled={busy || !!saved} onClick={() => { setEmail(example); setRecording(null); clearResult(); }}>Use fictional example</button>
            {!saved ? <button className="secondary-button" type="button" disabled={busy || !email.trim()} onClick={() => { void perform(async () => { await save(); }); }}>Save request</button> : null}
            <button className="primary-button" type="submit" disabled={busy || !email.trim()}>{busy ? "Working…" : saved ? "Analyze saved revision →" : "Save & analyze →"}</button>
          </div>
          <p className="prototype-note">Uses Claude API credits. The email is sent to Claude for analysis. Requests and analysis are saved on this computer. Nothing is sent to the client.</p>
        </form>
        <p role="status" className="run-status">{busy ? "Intake → Review → Follow-up. This can take up to a minute." : result ? "Saved analysis loaded. All facts remain proposals for your review." : ""}</p>
        {notice ? <p role="status" className="prototype-note">{notice}</p> : null}
        {saved && analyses.some(a => a.status === "running") ? <button type="button" disabled={busy} onClick={() => { retryCommands.current.delete(JSON.stringify({ action: "analyze", request_id: saved.id, expected_revision: saved.revision })); setNotice("A new run is enabled. Select Analyze saved revision to retry explicitly; this may use additional API credits."); }}>Retry analysis with a new run</button> : null}
        {error ? <div role="alert" className="analysis-error"><strong>Analysis needs attention</strong><p>{error}</p><p>The original email has not changed. Reopen the saved request before retrying an interrupted command. Add corrections as replies.</p></div> : null}
      </section>
      {result ? <section className="analysis-results" aria-label="Analysis results">
        <p className="prototype-note">{recording ? `Coordinator-selected recording: ${recording.id} · ${recording.artist} · ${recording.version}. Catalog blockers are checked separately on the server; catalog metadata is not email evidence.` : "Recording identity remains unresolved. Confirm the recording before any handoff."}</p>
        <div className="result-heading"><h2>Your review workspace</h2><span className="count">Saved Claude analysis</span></div>
        <article className="result-panel"><p className="eyebrow">CATALOG REVIEW · COORDINATOR ACTION</p><h3>Recording blockers</h3><p>Server-checked fictional catalog metadata. These internal tasks are separate from the client clarification draft. No rights are cleared.</p>{result.catalog_review?.blockers.map(b => <div className="issue" key={b.code}><h4>{label(b.code.toLowerCase())}</h4><p>{b.question}</p></div>)}</article>
        <div className="result-grid">
          <article className="result-panel facts-panel"><p className="eyebrow">1 · INTAKE</p><h3>Proposed facts <span>{proposals.length}</span></h3><p className="panel-note">Check the source quotes. These details are not confirmed.</p>
            {proposals.length ? proposals.map(p => <div className="fact" key={p.proposal_id}><h4>{label(p.field_key)}</h4><p className="fact-value">{display(p.proposed_value)}</p><details><summary>View source evidence</summary>{p.evidence.map((e, i) => <blockquote key={`${e.message_id}-${i}`}>{e.exact_quote}<small>Source: {e.message_id}</small></blockquote>)}</details></div>) : <p>No supplied facts were extracted.</p>}
          </article>
          <article className="result-panel issues-panel"><p className="eyebrow">2 · REVIEW</p><h3>Needs attention <span>{issues.length}</span></h3><p className="panel-note">Resolve these details before an internal handoff.</p>
            {issues.length ? issues.map(i => <div className="issue" key={i.issue_id}><span className="issue-kind">{label(i.type)} · {i.severity}</span><h4>{i.field_keys.map(label).join(", ")}</h4><p>{i.question}</p></div>) : <p>No checklist issues were found. Human review is still required.</p>}
            {result.coordinator_review_issue_ids?.length ? <p className="analysis-error">{result.coordinator_review_issue_ids.length} answered issues await coordinator confirmation.</p> : null}
          </article>
        </div>
        <article className="result-panel draft-panel"><p className="eyebrow">3 · FOLLOW-UP</p><h3>Clarification draft</h3>
          {result.stages?.follow_up?.skipped ? <p>No clarification draft is needed. Review the proposed facts before proceeding.</p> : <>
            <p className="panel-note">Edit the wording before sending it yourself. Edits stay in this browser view.</p>
            <label htmlFor="draft-subject">Subject</label><input id="draft-subject" value={subject} onChange={e => { setSubject(e.target.value); setCopyStatus(""); }} />
            <label htmlFor="draft-body">Email draft</label><textarea id="draft-body" rows={13} value={draft} onChange={e => { setDraft(e.target.value); setCopyStatus(""); }} />
            <button className="secondary-button" type="button" onClick={copyDraft}>Copy draft</button><span role="status" className="copy-status">{copyStatus}</span>
          </>}
        </article>
      </section> : null}
    </>
  );
}
