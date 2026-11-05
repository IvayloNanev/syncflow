"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { previewEmail } from "../catalog/email-preview.js";
import ReviewerTracking, {type ReviewTracking} from "./reviewer-tracking";
import InternalHandoff from "./internal-handoff";
import { reviewRecording } from "../catalog/review.js";
import RequestCoverage from "./request-coverage";
import FactReview, { type FactDecision, type FactProposal } from "./fact-review";
import SavedRequests, { type SavedRequest, type RequestSummary, type AnalysisSummary } from "./saved-requests";
import { recordings } from "../catalog/recordings.js";
import RecordingPicker, { type Recording } from "./recording-picker";

type Proposal = FactProposal;
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
const example = "Hi, this is Jordan Pike. We’d like to use Northern Lights by Maya Rivers (original recording) in a Canadian online advertising campaign for six months. Our budget is CAD 5,000 for both rights. Please respond by November 6, 2026.";
const label = (key: string) => key.replaceAll("_", " ");

export default function AnalysisWorkspace() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [recordingOverride, setRecordingOverride] = useState(false);
  const [allowUnresolved, setAllowUnresolved] = useState(false);
  const [reviewRun, setReviewRun] = useState<{ run_id: string; result: Result } | null>(null);
  const [reviewers,setReviewers]=useState<ReviewTracking>({version:0,reviewers:[],history:[]});
  const [decisions, setDecisions] = useState<FactDecision[]>([]);
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
  type Detail = { reviewer_tracking: ReviewTracking; review_analysis: { run_id: string; result: Result } | null; decisions: FactDecision[]; request: SavedRequest; catalog_review: Result["catalog_review"]; active_analysis: { result: Result } | null; analyses: AnalysisSummary[]; analysis_status?: string };
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
    setReviewers(data.reviewer_tracking || {version:0,reviewers:[],history:[]}); clearResult(); setReviewRun(data.review_analysis); setDecisions(data.decisions || []); setSaved(data.request); setEmail(data.request.messages[0].text); setTimezone(data.request.coordinator_timezone);
    setRecordingOverride(true); setRecording(recordings.find(r => r.id === data.request.recording_id) || null); setAnalyses(data.analyses);
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
    const payload = { action: "create", email, timezone, recording_id: effectiveRecording?.id ?? null };
    const data: Detail = await command(keyed(payload)); showSaved(data); await refresh();
    setNotice("Request saved. Facts remain unconfirmed."); return data.request;
  }
  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(async () => {
      if (!saved && !effectiveRecording && !allowUnresolved) { setError("The recording is unresolved. Choose a recording or acknowledge the identity gap before analyzing."); return; }
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
    setCatalogOpen(false); setRecordingOverride(false); setAllowUnresolved(false); retryCommands.current.clear();
    setReviewers({version:0,reviewers:[],history:[]}); setReviewRun(null); setDecisions([]); setSaved(null); setEmail(""); setRecording(null); setReply(""); setAnalyses([]); setNotice(""); clearResult();
  }
  async function copyDraft() {
    try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${draft}`); setCopyStatus("Draft copied. Nothing was sent."); }
    catch { setCopyStatus("Clipboard unavailable. Select and copy the draft manually."); }
  }
  const preview = previewEmail(saved ? saved.messages.map(m => m.text).join("\n") : email);
  const effectiveRecording = recordingOverride || saved ? recording : preview.match;
  const proposals = reviewRun?.result.stages?.intake?.output?.proposed_changes || [];
  const issues = result?.stages?.review?.output?.issues || [];
  const confirmedCount = (saved?.confirmed_fields || []).filter(f => f.state === "confirmed").length;
  const pendingCount = proposals.filter(p => !decisions.some(d => d.run_id === reviewRun?.run_id && d.proposal_id === p.proposal_id)).length;
  const navigationProps = { requests, saved, analyses, busy, reply, onReply: setReply,
    onRefresh: () => { void perform(refresh); }, onNew: newRequest,
    onOpen: (id: string) => { void perform(async () => { const data = await command({ action: "get", request_id: id }); showSaved(data); setReply(""); setNotice("Saved request reopened."); }); },
    onAppend: () => { void perform(async () => {
      if (!saved) return;
      const data = await command(keyed({ action: "reply", request_id: saved.id, expected_revision: saved.revision, text: reply }));
      showSaved(data); setReply(""); await refresh(); setNotice("Reply saved. Earlier analysis is outdated; analyze the new revision.");
    }); }
  };
  const stale = !!saved && analyses.length > 0 && !result;
  const blockers = result?.catalog_review?.blockers || [];
  const clientQuestions = issues.filter(i => !result?.coordinator_review_issue_ids?.includes(i.issue_id));
  function editEmail(value: string) {
    setEmail(value); setRecording(null); setRecordingOverride(false); setAllowUnresolved(false); clearResult();
  }
  function recoverIdentity() {
    const original = email;
    newRequest(); setEmail(original); setCatalogOpen(true);
    setNotice("Original email copied into a new unsaved request. The previous request and its history remain saved.");
  }
  return <div className={`app-shell${!saved && !email.trim() ? " email-only" : ""}`}>
    <a className="skip-link" href="#main-workspace">Skip to workspace</a>
    <aside className="app-sidebar" aria-label="Request navigation">
      <a className="brand" href="#main-workspace">syncflow<span className="brand-period">.</span></a>
      <p className="sidebar-caption">MUSIC LICENSING WORKSPACE</p>
      <SavedRequests {...navigationProps} />
      <div className="sidebar-bottom"><small>Saved on this computer · Single operator<br />Fictional catalog · Nothing sends automatically</small></div>
    </aside>
    <main className="main-workspace" id="main-workspace"><div className="workspace-body">
      <div className="workspace-title"><div><p className="eyebrow">SYNC REQUEST INTAKE</p><h1>{saved ? 'Request workspace' : 'Start with the client’s email.'}</h1><p>See the recording, resolve the gaps and prepare your next email.</p></div><span className="status-pill">{saved ? `Saved · revision ${saved.revision}` : 'New request'}</span></div>
      <div aria-live="polite">{busy ? <p className="busy-notice">Working on the request. Saved facts and history are preserved…</p> : notice ? <p className="notice">{notice}</p> : null}</div>
      {error ? <div role="alert" className="analysis-error"><strong>Action needs attention</strong><p>{error}</p></div> : null}
      <div className="intake-grid">
        <section className="result-panel analysis-input" aria-labelledby="analyze-heading">
          <p className="eyebrow">CLIENT CONVERSATION</p><h2 id="analyze-heading">{saved ? 'Email conversation' : 'Paste the request'}</h2>
          <form id="request-analysis-form" onSubmit={analyze} aria-busy={busy}>
            <div hidden={!!saved}><label htmlFor="client-email">Client email</label><textarea id="client-email" rows={12} maxLength={20000} value={email} disabled={busy || !!saved} required onChange={e => editEmail(e.target.value)} placeholder="Paste the client’s email here…" /></div>
            {!saved ? <button type="button" className="text-button" disabled={busy} onClick={() => editEmail(example)}>Try an example</button> : <p className="panel-note">Original email preserved. Add replies below.</p>}
            <details className="settings-disclosure"><summary>Request settings</summary><label htmlFor="request-timezone">Coordinator timezone</label><input id="request-timezone" value={timezone} disabled={busy || !!saved} required onChange={e => {setTimezone(e.target.value); clearResult();}} /></details>
            {!saved && email.trim() && !effectiveRecording ? <div className="identity-warning"><p>No exact recording selected. Analysis can clarify the request, but this identity gap will remain locked on the saved record.</p><label><input type="checkbox" checked={allowUnresolved} disabled={busy} onChange={e => setAllowUnresolved(e.target.checked)} /> Continue with unresolved recording identity</label></div> : null}
            <div className="form-footer"><small>Uses Claude API credits. Use fictional data.<br />Nothing is sent to the client.</small></div>
          </form>
          {saved && analyses.some(a => a.status === 'running') ? <button className="text-button" disabled={busy} onClick={() => { retryCommands.current.delete(JSON.stringify({action:'analyze',request_id:saved.id,expected_revision:saved.revision})); setNotice('New run enabled. Click Draft a response to retry; this uses additional API credits.'); }}>Enable a new analysis attempt</button> : null}
          {saved ? <SavedRequests {...navigationProps} variant="conversation" activeRunId={result ? reviewRun?.run_id : undefined} response={<div className="inline-next-action">        <section className="result-panel draft-panel" aria-labelledby="next-action-heading"><p className="eyebrow">NEXT ACTION</p><h2 id="next-action-heading">{stale ? 'Refresh the analysis' : result?.stages?.follow_up?.skipped ? 'Review facts and internal checks' : result ? 'Review and copy the client email' : 'Analyze this request'}</h2>
          {result && !result.stages?.follow_up?.skipped ? <><p className="panel-note">Questions for the client only. Internal checks remain in the summary above. This draft has not been sent.</p><label htmlFor="draft-subject">Subject</label><input id="draft-subject" value={subject} disabled={busy} onChange={e => {setSubject(e.target.value);setCopyStatus('');}} /><label htmlFor="draft-body">Email draft</label><textarea id="draft-body" rows={14} value={draft} disabled={busy} onChange={e => {setDraft(e.target.value);setCopyStatus('');}} /><button type="button" className="primary-button" disabled={busy} onClick={copyDraft}>Copy draft</button><p role="status">{copyStatus}</p></> : <p>{stale ? 'Use Draft a response. Confirmed facts and history are preserved.' : result ? 'No clarification email is needed. Confirm the supplied facts and complete the internal checks; this does not approve a licence.' : 'Use Draft a response to generate the checklist and any necessary email.'}</p>}
        </section>
</div>} onRecheck={() => {void perform(async () => {
            const appended: Detail = await command(keyed({action:'reply',request_id:saved.id,expected_revision:saved.revision,text:reply}));
            showSaved(appended); setReply(''); await refresh();
            const payload = {action:'analyze', request_id:saved.id,expected_revision:appended.request.revision};
            const checked: Detail = await command(keyed(payload)); showSaved(checked); await refresh();
            if (checked.analysis_status === 'completed') retryCommands.current.delete(JSON.stringify(payload));
            setNotice(checked.analysis_status === 'completed' ? 'Reply checked. Checklist and next response updated.' : 'Reply saved. Analysis needs attention; retry drafting the response.');
          });}} /> : null}
        </section>
        <aside className="result-panel request-summary" aria-labelledby="summary-heading">
          <p className="eyebrow">REQUEST SUMMARY</p><h2 id="summary-heading">What needs attention?</h2>
          <div className="preview-recording"><small>{saved ? 'SAVED RECORDING' : recordingOverride ? 'YOUR SELECTION' : 'PROVISIONAL CATALOG MATCH'}</small><h3>{effectiveRecording?.title || 'Recording unresolved'}</h3><p>{effectiveRecording ? `${effectiveRecording.artist} · ${effectiveRecording.version} · ${effectiveRecording.id}` : preview.candidates.length ? 'Several recordings may match. Confirm the artist and exact version.' : 'Paste a title, artist and version, or inspect the catalog.'}</p><button type="button" className="text-button" disabled={busy} onClick={() => setCatalogOpen(!catalogOpen)} aria-expanded={catalogOpen}>{catalogOpen ? 'Close catalog' : 'Inspect / change recording'}</button>{saved && !effectiveRecording ? <button type="button" className="text-button" disabled={busy} onClick={recoverIdentity}>Copy original email to resolve identity in a new request</button> : null}</div>
          <RequestCoverage email={saved ? saved.messages.map(m => m.text).join("\n") : email} analyzed={!!result} stale={stale} proposals={result ? proposals.filter(p => !decisions.some(d => d.run_id === reviewRun?.run_id && d.proposal_id === p.proposal_id)) : []} confirmed={saved?.confirmed_fields || []} issues={clientQuestions} />
          <button type="submit" form="request-analysis-form" className="primary-button" disabled={busy || !email.trim()}>{busy ? "Drafting response…" : "Draft a response"}</button>
          {stale ? <p className="stale-banner">Analysis and draft are outdated. Refresh to verify the updated conversation.</p> : null}
          {result ? <><h3>{blockers.length} internal checks</h3>{blockers.length ? <ul>{blockers.map(b => <li key={b.code}>{b.question}</li>)}</ul> : <p>No catalog checks reported.</p>}<p className="review-count">{pendingCount} facts awaiting confirmation · {confirmedCount} confirmed</p></> : null}
          <p className="panel-note">Catalog matches and confirmed request facts do not grant rights clearance.</p>
        </aside>
      </div>
      <div hidden={!catalogOpen} className="inline-catalog"><RecordingPicker selected={effectiveRecording} disabled={busy || !!saved} onSelect={r => {setRecordingOverride(true); setRecording(r); clearResult();}} onScenario={editEmail} /></div>
      {saved ? <div className="outcome-grid">
        <details className="fact-disclosure"><summary>{pendingCount} facts awaiting confirmation · Review evidence</summary><p className="panel-note">Decisions save immediately and make the draft outdated. Finish reviewing, then use Draft a response once.</p><FactReview confirmed={saved.confirmed_fields || []} proposals={proposals} runId={reviewRun?.run_id || null} decisions={decisions} busy={busy} onDecide={(proposal, decision) => {void perform(async () => {
          if (!reviewRun) return;
          const data = await command(keyed({action:'decide',request_id:saved.id,expected_revision:saved.revision,run_id:reviewRun.run_id,proposal_id:proposal.proposal_id,decision}));
          showSaved(data); await refresh(); setNotice(`${decision === 'accept' ? 'Accepted' : 'Rejected'} ${label(proposal.field_key)}. Finish reviewing, then refresh the analysis and draft.`);
        });}} /></details>
      </div> : null}
      {saved ? <InternalHandoff key={`handoff-${saved.id}`} request={saved} questions={clientQuestions} catalog={reviewRecording(saved.recording_id)} analysisCurrent={!!result} pendingCount={pendingCount} busy={busy} /> : null}
      {saved ? <ReviewerTracking key={`reviewers-${saved.id}`} tracking={reviewers} busy={busy} onSave={async input => {
        let success=false;
        await perform(async () => {
          const data: Detail = await command(keyed({action:'reviewer',request_id:saved.id,expected_revision:saved.revision,expected_review_version:reviewers.version,...input}));
          setReviewers(data.reviewer_tracking); success=true; setNotice('Reviewer record saved. No message was sent.');
        });
        return success;
      }} /> : null}
      <footer className="workspace-footer">Local prototype · Intake and coordination support · No automatic sending or rights approval</footer>
    </div></main>
  </div>;
}
