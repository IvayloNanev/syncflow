"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { previewEmail } from "../catalog/email-preview.js";
import RequestFields from "./request-fields";
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
  const [step, setStep] = useState("brief");
  const [reviewRun, setReviewRun] = useState<{ run_id: string; result: Result } | null>(null);
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
  type Detail = { review_analysis: { run_id: string; result: Result } | null; decisions: FactDecision[]; request: SavedRequest; catalog_review: Result["catalog_review"]; active_analysis: { result: Result } | null; analyses: AnalysisSummary[]; analysis_status?: string };
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
    clearResult(); setReviewRun(data.review_analysis); setDecisions(data.decisions || []); setSaved(data.request); setEmail(data.request.messages[0].text); setTimezone(data.request.coordinator_timezone);
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
    const payload = { action: "create", email, timezone, recording_id: effectiveRecording?.id ?? null };
    const data: Detail = await command(keyed(payload)); showSaved(data); await refresh();
    setNotice("Request saved. Facts remain unconfirmed."); return data.request;
  }
  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(async () => {
      const record = saved || await save(); clearResult();
      const payload = { action: "analyze", request_id: record.id, expected_revision: record.revision };
      const data: Detail = await command(keyed(payload)); showSaved(data);
      if (data.analysis_status === "completed") { setStep("draft"); retryCommands.current.delete(JSON.stringify(payload)); setNotice("Analysis saved for this revision. All extracted facts remain proposals."); }
      else if (data.analysis_status === "running") setNotice("This run is still pending. Reopen the request to check it. Use Retry analysis with a new run only if you explicitly want another attempt.");
      else { retryCommands.current.delete(JSON.stringify(payload)); setNotice(`Analysis is ${data.analysis_status}. History is preserved. Review the saved request before explicitly retrying.`); }
      await refresh();
    });
  }
  function newRequest() {
    setStep("brief"); retryCommands.current.clear();
    setReviewRun(null); setDecisions([]); setSaved(null); setEmail(""); setRecording(null); setReply(""); setAnalyses([]); setNotice(""); clearResult();
  }
  async function copyDraft() {
    try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${draft}`); setCopyStatus("Draft copied. Nothing was sent."); }
    catch { setCopyStatus("Clipboard unavailable. Select and copy the draft manually."); }
  }
  const preview = previewEmail(email);
  const effectiveRecording = recording || (!saved ? preview.match : null);
  const proposals = reviewRun?.result.stages?.intake?.output?.proposed_changes || [];
  const issues = result?.stages?.review?.output?.issues || [];
  const confirmedCount = (saved?.confirmed_fields || []).filter(f => f.state === "confirmed").length;
  const pendingCount = proposals.filter(p => !decisions.some(d => d.run_id === reviewRun?.run_id && d.proposal_id === p.proposal_id)).length;
  const navigationProps = { requests, saved, analyses, busy, reply, onReply: setReply,
    onRefresh: () => { void perform(refresh); }, onNew: newRequest,
    onOpen: (id: string) => { void perform(async () => { const data = await command({ action: "get", request_id: id }); showSaved(data); setReply(""); setStep("brief"); setNotice("Saved request reopened."); }); },
    onAppend: () => { void perform(async () => {
      if (!saved) return;
      const data = await command(keyed({ action: "reply", request_id: saved.id, expected_revision: saved.revision, text: reply }));
      showSaved(data); setReply(""); await refresh(); setNotice("Reply saved. Earlier analysis is outdated; analyze the new revision.");
    }); }
  };
  const tabs = [{ id: "brief", name: "Request", number: "01" }, { id: "recording", name: "Recording", number: "02" },
    { id: "review", name: "Review", number: "03" }, { id: "draft", name: "Follow-up", number: "04" }];
  return <div className="app-shell">
    <a className="skip-link" href="#main-workspace">Skip to workspace</a>
    <aside className="app-sidebar" aria-label="Request navigation">
      <a className="brand" href="#main-workspace" aria-label="SyncFlow workspace"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>syncflow<span className="brand-period">.</span></a>
      <p className="sidebar-caption">MUSIC LICENSING WORKSPACE</p>
      <SavedRequests {...navigationProps} />
      <div className="sidebar-bottom"><div className="local-indicator"><span aria-hidden="true" />Local workspace</div><small>Saved on this computer<br />Agents propose. You decide.</small><div className="operator"><span className="operator-avatar" aria-hidden="true">CO</span><span>Coordinator<small>Single operator · Prototype</small></span></div></div>
    </aside>
    <main className="main-workspace" id="main-workspace">
      <header className="workspace-topbar"><div className="breadcrumb">Workspace <span aria-hidden="true">/</span> <strong>{saved ? `Request ${saved.id.slice(0, 8)}` : 'New request'}</strong></div><span className="topbar-note">Sync & visual media</span></header>
      <div className="workspace-body">
        <div className="workspace-title"><div><p className="eyebrow">FROM CLIENT EMAIL TO CLEAR NEXT STEPS</p><h1>{saved ? 'Request workspace' : 'Let’s get the details right.'}</h1><p>{saved ? 'Keep the conversation, recording and reviewed facts together.' : 'Paste an email. See the song and gaps. Analyze to draft your next email.'}</p></div><span className={saved ? 'status-pill saved-status' : 'status-pill'}>{saved ? `Saved · revision ${saved.revision}` : 'New · unsaved'}</span></div>
        <div className="request-context"><div className="record-art" aria-hidden="true"><span /></div><div><span className="eyebrow">{effectiveRecording ? 'MATCHED RECORDING' : 'RECORDING'}</span><strong>{effectiveRecording ? effectiveRecording.title : 'No recording selected yet'}</strong><small>{effectiveRecording ? `${effectiveRecording.artist} · ${effectiveRecording.version} · ${effectiveRecording.id}` : saved ? 'Identity unresolved. Start a new request to select a recording.' : 'Match the client’s song to the right artist and version.'}</small></div><button type="button" className="text-button" disabled={busy} onClick={() => setStep("recording")}>{effectiveRecording ? 'View recording' : saved ? 'View identity gap' : 'Find recording'} <span aria-hidden="true">↗</span></button></div>
        <nav className="stage-nav" aria-label="Request stages">{tabs.map(tab => <button key={tab.id} type="button" disabled={busy} aria-current={step === tab.id ? "step" : undefined} onClick={() => setStep(tab.id)}><span className="stage-number">{tab.number}</span>{tab.name}{tab.id === 'review' && pendingCount > 0 ? <span className="tab-count">{pendingCount}</span> : null}</button>)}</nav>
        <div className="workspace-feedback" aria-live="polite">{busy ? <p className="busy-notice"><span className="loading-dot" />Working on your request. Intake → Review → Follow-up can take up to a minute.</p> : notice ? <p className="notice"><span aria-hidden="true">✓</span>{notice}</p> : null}</div>
        {error ? <div role="alert" className="analysis-error"><strong>We couldn’t finish that action</strong><p>{error}</p><small>Your text is retained. Reopen the saved request before retrying an interrupted command.</small></div> : null}
        <div className="stage-content" id={`stage-${step}`}>
          <section hidden={step !== 'brief'} aria-labelledby="analyze-heading">
            <div className="content-columns"><div className="primary-column">
              <section className="result-panel analysis-input" id="analyze"><div className="section-heading"><div><p className="eyebrow">01 / THE CLIENT BRIEF</p><h2 id="analyze-heading">{saved ? 'Original request' : 'What’s the client asking for?'}</h2></div>{saved ? <span className="count">Read only</span> : null}</div>
                <p className="panel-note">{saved ? 'The original email is preserved. Add new information as a reply below.' : 'Paste their email. We’ll pull out the details and highlight what still needs an answer.'}</p>
                <form onSubmit={analyze} aria-busy={busy}><label htmlFor="client-email">Client email</label><textarea id="client-email" rows={9} maxLength={20000} value={email} disabled={busy || !!saved} required placeholder="Hi, we’d like to use a song in our upcoming campaign…" onChange={e => { setEmail(e.target.value); setRecording(null); clearResult(); }} />
                  <div className="email-meta"><span>{email.length.toLocaleString()} / 20,000 characters</span>{!saved ? <button className="text-button" type="button" disabled={busy} onClick={() => { setEmail(example); setRecording(null); clearResult(); }}>Try an example</button> : null}</div>
                  <details className="settings-disclosure"><summary>Request settings <span>{timezone}</span></summary><label htmlFor="request-timezone">Coordinator timezone</label><input id="request-timezone" value={timezone} disabled={busy || !!saved} required onChange={e => { setTimezone(e.target.value); clearResult(); }} aria-describedby="timezone-help" /><small id="timezone-help">Use an IANA timezone, such as America/New_York. Client deadlines are never inferred from it.</small></details>
                  <div className="form-footer"><small>Analysis uses Claude API credits.<br />Nothing is sent to the client.</small><div className="button-group">{!saved ? <button className="secondary-button" type="button" disabled={busy || !email.trim()} onClick={() => { void perform(async () => { await save(); }); }}>Save request</button> : null}<button className="primary-button" type="submit" disabled={busy || !email.trim()}>{busy ? 'Working…' : saved ? 'Analyze & draft next email →' : 'Analyze & draft next email →'}</button></div></div>
                  <small className="privacy-note">The email is sent to Claude for analysis. Use fictional data in this prototype.</small>
                </form>
                {saved && analyses.some(a => a.status === "running") ? <button className="text-button" type="button" disabled={busy} onClick={() => { retryCommands.current.delete(JSON.stringify({ action: "analyze", request_id: saved.id, expected_revision: saved.revision })); setNotice("A new run is enabled. Select Analyze saved revision to retry explicitly; this may use additional API credits."); }}>Retry analysis with a new run</button> : null}
              </section>
              
            </div><aside className="request-fields-column"><section className="result-panel instant-preview" aria-labelledby="instant-preview-heading"><p className="eyebrow">STEP 1 / INSTANT EMAIL PREVIEW</p><h2 id="instant-preview-heading">Song & missing details</h2><p className="panel-note">Updates as you paste. Quick local checks — the agent verifies these when you click Analyze.</p>{!email.trim() ? <p>Paste an email to see the matching song and likely gaps here.</p> : <><div className="preview-recording"><strong>{effectiveRecording ? effectiveRecording.title : preview.candidates.length ? 'Choose the exact recording' : 'No unique catalog match'}</strong><p>{effectiveRecording ? `${effectiveRecording.artist} · ${effectiveRecording.version} · ${effectiveRecording.id}` : preview.candidates.length ? `${preview.candidates.length} possible recordings. Artist or version needs clarification.` : 'The title, artist or version may be missing, conflicting or outside this catalog.'}</p><button className="text-button" type="button" disabled={busy} onClick={() => setStep('recording')}>{effectiveRecording ? 'Change / inspect recording' : 'Browse catalog options'} →</button></div><h3>Likely missing or needs clarification</h3>{preview.missing.filter(item => item !== 'Exact catalog recording' || !effectiveRecording).length ? <ul>{preview.missing.filter(item => item !== 'Exact catalog recording' || !effectiveRecording).map(item => <li key={item}>{item}</li>)}</ul> : <p>No obvious gaps detected by the quick check. Analyze to check ambiguity, dates and conflicts.</p>}<p className="panel-note">A catalog match is not rights clearance. These hints do not confirm any facts.</p></>}</section><details className="extracted-details"><summary>Detailed agent-filled record{reviewRun ? ' · available' : ' · after analysis'}</summary><RequestFields confirmed={saved?.confirmed_fields || []} proposals={proposals} decisions={decisions} runId={reviewRun?.run_id || null} busy={busy} analyzed={!!reviewRun} stale={!result && !!reviewRun} issues={issues} onReview={() => setStep('review')} /></details></aside></div>{saved ? <div className="result-panel conversation-card"><SavedRequests {...navigationProps} variant="conversation" /></div> : null}
          </section>
          <section hidden={step !== 'recording'} aria-label="Recording catalog"><RecordingPicker selected={effectiveRecording} disabled={busy || !!saved} onSelect={r => { setRecording(r); clearResult(); }} onScenario={text => { setEmail(text); clearResult(); }} /><div className="stage-footer"><span>One recording per request. Create separate requests for multiple songs.</span><button type="button" className="primary-button" onClick={() => setStep('brief')}>Back to request →</button></div></section>
          <section hidden={step !== 'review'} aria-label="Fact and issue review">
            {!saved ? <div className="empty-state"><span className="empty-symbol" aria-hidden="true">◎</span><h2>Start with the client’s request.</h2><p>Save and analyze an email to see proposed facts, source evidence and missing details.</p><button className="primary-button" type="button" onClick={() => setStep('brief')}>Go to request →</button></div> : <>
              <div className="review-overview"><div><span>{confirmedCount}</span><small>Confirmed facts</small></div><div><span>{pendingCount}</span><small>Proposals to review</small></div><div><span>{result ? issues.length : '—'}</span><small>Client questions</small></div><div><span>{result ? result.catalog_review?.blockers.length ?? 0 : '—'}</span><small>Catalog blockers</small></div></div>
              {!result && analyses.length > 0 ? <div className="stale-banner"><strong>The checklist and draft need a fresh analysis.</strong><p>Replies or review decisions changed this request. Confirmed facts are preserved.</p><button type="button" className="text-button" onClick={() => setStep('brief')}>Return to request to analyze →</button></div> : null}
              <FactReview confirmed={saved.confirmed_fields || []} proposals={proposals} runId={reviewRun?.run_id || null} decisions={decisions} busy={busy} onDecide={(proposal, decision) => { void perform(async () => {
                if (!reviewRun) return;
                const data = await command(keyed({ action: 'decide', request_id: saved.id, expected_revision: saved.revision, run_id: reviewRun.run_id, proposal_id: proposal.proposal_id, decision }));
                showSaved(data); await refresh(); setNotice(`${decision === 'accept' ? 'Accepted' : 'Rejected'} ${label(proposal.field_key)}. Decision saved. Review remaining proposals or analyze again to refresh the checklist.`);
              }); }} />
              {result ? <div className="blocker-columns"><article className="result-panel issues-panel"><p className="eyebrow">CLIENT DETAILS / REVIEW CHECK</p><h3>Questions to resolve <span className="count">{issues.length}</span></h3><p className="panel-note">Missing or conflicting information from the conversation.</p>{issues.length ? issues.map(i => <div className="issue" key={i.issue_id}><span className="issue-kind">{label(i.type)} · {i.severity}</span><h4>{i.field_keys.map(label).join(', ')}</h4><p>{i.question}</p></div>) : <p className="empty-inline">No checklist issues found. Human review is still required.</p>}{result.coordinator_review_issue_ids?.length ? <p className="analysis-error">{result.coordinator_review_issue_ids.length} answered issues await coordinator confirmation.</p> : null}</article>
              <article className="result-panel"><p className="eyebrow">INTERNAL / CATALOG CHECK</p><h3>Recording blockers <span className="count">{result.catalog_review?.blockers.length ?? 0}</span></h3><p className="panel-note">Internal tasks, separate from questions for the client. Catalog data never proves clearance.</p>{result.catalog_review?.blockers.length ? result.catalog_review.blockers.map(b => <div className="issue" key={b.code}><span className="issue-kind">Coordinator action</span><h4>{label(b.code.toLowerCase())}</h4><p>{b.question}</p></div>) : <p className="empty-inline">No catalog blockers reported. This is not rights approval.</p>}</article></div> : null}
              <div className="stage-footer"><span>Confirm the evidence before moving a request forward.</span><button type="button" className="primary-button" onClick={() => setStep('draft')}>View follow-up draft →</button></div>
            </>}
          </section>
          <section hidden={step !== 'draft'} aria-label="Client follow-up draft">
            {result ? <div className="content-columns"><article className="result-panel draft-panel"><div className="section-heading"><div><p className="eyebrow">STEP 2 / GENERATED NEXT STEP</p><h2>Your next-step email is ready.</h2></div><span className="count">Draft only</span></div>{result.stages?.follow_up?.skipped ? <div className="empty-state compact"><h3>No clarification draft needed.</h3><p>Review the proposed facts before proceeding.</p></div> : <><p className="panel-note">Review and edit these questions, then copy them into your email.</p><label htmlFor="draft-subject">Subject</label><input id="draft-subject" value={subject} onChange={e => { setSubject(e.target.value); setCopyStatus(''); }} /><label htmlFor="draft-body">Email draft</label><textarea id="draft-body" rows={16} value={draft} onChange={e => { setDraft(e.target.value); setCopyStatus(''); }} /><div className="form-footer"><small>Edits stay in this browser view.<br />Copy before leaving or refreshing.</small><button className="primary-button" type="button" onClick={copyDraft}>Copy draft <span aria-hidden="true">↗</span></button></div><p role="status" className="copy-status">{copyStatus}</p></>}</article><aside className="guidance-column"><div className="guidance-card"><span className="guidance-icon" aria-hidden="true">↗</span><h3>A draft, with you<br />in the loop.</h3><p>These questions come from missing or conflicting client details. Internal catalog tasks stay in the Review stage.</p><p>Nothing sends automatically. Check the wording and send it from your own email.</p></div><div className="quiet-note"><strong>When the client replies</strong><p>Go back to Request and append their reply. Analyze the new revision to update the checklist.</p><button type="button" className="text-button" onClick={() => setStep('brief')}>Go to conversation →</button></div></aside></div> : <div className="empty-state"><span className="empty-symbol" aria-hidden="true">↗</span><h2>{saved ? 'A fresh draft starts with analysis.' : 'Your next email starts here.'}</h2><p>{saved ? 'Analyze the current saved revision to generate questions from the latest information.' : 'Save and analyze the client’s email first. Your clarification draft will appear here.'}</p><button type="button" className="primary-button" onClick={() => setStep('brief')}>Go to request →</button></div>}
          </section>
        </div>
        <footer className="workspace-footer"><span>SyncFlow / Coordinator workspace</span><span>Fictional catalog · Local prototype</span></footer>
      </div>
    </main>
  </div>;
}
