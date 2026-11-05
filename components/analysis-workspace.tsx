"use client";

import { useRef, useState, type FormEvent } from "react";

import RecordingPicker, { type Recording } from "./recording-picker";

type Evidence = { message_id: string; exact_quote: string };
type Proposal = { proposal_id: string; field_key: string; proposed_value: unknown; evidence: Evidence[] };
type Issue = { issue_id: string; type: string; severity: string; field_keys: string[]; question: string };
type Result = {
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
  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (running.current || !email.trim()) return;
    running.current = true; setBusy(true); clearResult();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 70000);
    try {
      const response = await fetch("/api/analyze", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, timezone }), signal: controller.signal });
      const data: Result = await response.json();
      if (!response.ok || !data.ok) { setError(data.error?.message || "Analysis could not complete. Check the local configuration and retry explicitly."); return; }
      if (!Array.isArray(data.stages?.intake?.output?.proposed_changes) || !Array.isArray(data.stages?.review?.output?.issues)) {
        setError("The response was incomplete. Review the email manually or retry."); return;
      }
      setResult(data); setSubject(data.stages.follow_up?.output?.subject || ""); setDraft(data.stages.follow_up?.output?.body || "");
    } catch { setError("The connection failed or timed out. Your email is still here. An interrupted request may finish on the server; wait before retrying."); }
    finally { clearTimeout(timer); running.current = false; setBusy(false); }
  }
  async function copyDraft() {
    try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${draft}`); setCopyStatus("Draft copied. Nothing was sent."); }
    catch { setCopyStatus("Clipboard unavailable. Select and copy the draft manually."); }
  }
  const proposals = result?.stages?.intake?.output?.proposed_changes || [];
  const issues = result?.stages?.review?.output?.issues || [];
  return (
    <>
      <RecordingPicker selected={recording} disabled={busy} onSelect={r => { setRecording(r); clearResult(); }} onScenario={text => { setEmail(text); clearResult(); }} />
      <section className="request-section analysis-input" id="analyze" aria-labelledby="analyze-heading">
        <div className="section-heading"><div><p className="eyebrow">START WITH THE CLIENT EMAIL</p><h2 id="analyze-heading">Review a music request</h2></div><span className="count">Unsaved request</span></div>
        <form onSubmit={analyze} aria-busy={busy}>
          <label htmlFor="client-email">Client email</label>
          <textarea id="client-email" rows={7} maxLength={20000} value={email} disabled={busy} required
            placeholder="Paste the client's music-use request here…" onChange={e => { setEmail(e.target.value); setRecording(null); clearResult(); }} />
          <div className="input-actions">
            <div><label htmlFor="request-timezone">Coordinator timezone</label><input id="request-timezone" value={timezone} disabled={busy} required
              onChange={e => { setTimezone(e.target.value); clearResult(); }} aria-describedby="timezone-help" /><small id="timezone-help">For example, America/New_York. Client deadlines are never inferred from this.</small></div>
            <button className="secondary-button" type="button" disabled={busy} onClick={() => { setEmail(example); setRecording(null); clearResult(); }}>Use fictional example</button>
            <button className="primary-button" type="submit" disabled={busy || !email.trim()}>{busy ? "Analyzing…" : "Analyze email →"}</button>
          </div>
          <p className="prototype-note">Uses Claude API credits. The email is sent to Claude for analysis. Nothing is saved or sent to the client.</p>
        </form>
        <p role="status" className="run-status">{busy ? "Intake → Review → Follow-up. This can take up to a minute." : result ? "Analysis complete. All facts remain proposals for your review." : ""}</p>
        {error ? <div role="alert" className="analysis-error"><strong>Analysis needs attention</strong><p>{error}</p><p>The original email has not changed. You can edit it or select Analyze email to retry.</p></div> : null}
      </section>
      {result ? <section className="analysis-results" aria-label="Analysis results">
        <p className="prototype-note">{recording ? `Coordinator-selected recording: ${recording.id} · ${recording.artist} · ${recording.version}. Catalog information is displayed separately below the search; it is not agent evidence.` : "Recording identity remains unresolved. Confirm the recording before any handoff."}</p>
        <div className="result-heading"><h2>Your review workspace</h2><span className="count">Live Claude · not saved</span></div>
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
