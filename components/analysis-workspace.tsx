"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from "react";

import { previewEmail } from "../catalog/email-preview.js";
import {readEditorBackup,writeEditorBackup,clearEditorBackup} from "./editor-backup";
import { confirmDiscard, useUnsavedGuard } from "./use-unsaved-guard";
import AnalysisRecovery from "./analysis-recovery";
import RequestDashboard from "./request-dashboard";
import ReviewerTracking, {type ReviewTracking} from "./reviewer-tracking";
import InternalHandoff, {type HandoffState} from "./internal-handoff";
import { reviewRecording } from "../catalog/review.js";
import RequestCoverage from "./request-coverage";
import { valueText, type FactDecision, type FactProposal } from "./fact-review";
import SavedRequests, { type SavedRequest, type RequestSummary, type AnalysisSummary } from "./saved-requests";
import { recordings } from "../catalog/recordings.js";
import RecordingPicker, { type Recording } from "./recording-picker";

type BriefApproval={version:number;request_revision:number;analysis_run_id:string;approved_by:string;approved_at:string;outdated:boolean};
type Workflow = {brief_approved:boolean;can_approve_brief:boolean;brief_approval:BriefApproval|null;status:string;next_action:string;can_complete:boolean;completed:boolean;reasons:string[];completion:{needs_reconfirmation:boolean;completed_by:string;completed_at:string}|null;history:{completed_by:string;completed_at:string;request_revision:number}[]};
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

export default function AnalysisWorkspace({ mode = "coordinator", initialRequestId, shared = false }: {shared?:boolean;mode?: "coordinator" | "internal"; initialRequestId?: string}) {
  const router=useRouter();
  const [dashboardOpen,setDashboardOpen]=useState(mode === "internal" && !initialRequestId);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [recordingCandidate,setRecordingCandidate]=useState<Recording|null|undefined>(undefined);
  const [recordingReason,setRecordingReason]=useState("");
  const [recordingChanges,setRecordingChanges]=useState<{revision:number;previous_recording_id:string|null;recording_id:string|null;reason:string;actor_id:string;at:string}[]>([]);
  const [recordingOverride, setRecordingOverride] = useState(false);
  const [allowUnresolved, setAllowUnresolved] = useState(false);
  const [reviewRun, setReviewRun] = useState<{ run_id: string; result: Result } | null>(null);
  const [handoffDirty,setHandoffDirty]=useState(false);
  const [reviewerDirty,setReviewerDirty]=useState(false);
  const [loadingRequest,setLoadingRequest]=useState(!!initialRequestId);
  const [requestLoadFailed,setRequestLoadFailed]=useState(false);
  const [listState,setListState]=useState<"loading"|"ready"|"error">("loading");
  const [loadAttempt,setLoadAttempt]=useState(0);
  const headingRef=useRef<HTMLHeadingElement>(null);
  const [handoff,setHandoff]=useState<HandoffState|null>(null);
  const [briefHistory,setBriefHistory]=useState<BriefApproval[]>([]);
  const [workflow,setWorkflow]=useState<Workflow|null>(null);
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
  const [working, setBusy] = useState(false);
  const busy=working||loadingRequest;
  const running = useRef(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [draft, setDraft] = useState("");
  const [recoveredDraft,setRecoveredDraft]=useState<{subject:string;body:string}|null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const draftDirty = !!result && (subject !== (result.stages?.follow_up?.output?.subject || "") || draft !== (result.stages?.follow_up?.output?.body || ""));
  const unsavedText = reviewerDirty || handoffDirty || draftDirty || !!reply.trim() || (!saved && !!email.trim());
  useUnsavedGuard(unsavedText);
  function requestUrl(id:string){return `/${mode === "internal" ? "internal" : "coordinator"}?request=${encodeURIComponent(id)}`;}
  function backupEditors(next:Record<string,string>){if(saved)writeEditorBackup(saved.id,{reply,subject,body:draft,run:reviewRun?.run_id||"",...next});}
  function clearResult() { setResult(null); setError(""); setSubject(""); setDraft(""); setCopyStatus(""); }
  type Detail = { brief_approval_history:BriefApproval[];recording_changes: typeof recordingChanges; handoff:HandoffState; workflow: Workflow; reviewer_tracking: ReviewTracking; review_analysis: { run_id: string; result: Result } | null; decisions: FactDecision[]; request: SavedRequest; catalog_review: Result["catalog_review"]; active_analysis: { result: Result } | null; analyses: AnalysisSummary[]; analysis_status?: string };
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
  async function refresh() {
    setListState('loading');
    try {const data=await command({action:'list'});setRequests(data.requests);setListState('ready');}
    catch {setListState('error');}
  }
  const restoreInitial=useEffectEvent((data:Detail)=>showSaved(data));
  useEffect(() => {
    let mounted = true;
    command({ action: "list" }).then(data => { if (mounted) {setRequests(data.requests);setListState("ready");} })
      .catch(() => { if (mounted) setListState("error"); });
    if(!initialRequestId && mode === "coordinator") Promise.resolve().then(()=>{if(mounted){const backup=readEditorBackup("new");if(typeof backup?.email==="string")setEmail(backup.email);}});
    if(initialRequestId) command({action:"get",request_id:initialRequestId}).then(data=>{if(mounted){restoreInitial(data);setRequestLoadFailed(false);setLoadingRequest(false);setNotice("Saved request loaded.");}}).catch(()=>{if(mounted){setRequestLoadFailed(true);setLoadingRequest(false);}});
    return () => { mounted = false; };
  }, [initialRequestId,mode,loadAttempt]);
  function showSaved(data: Detail) {
    setBriefHistory(data.brief_approval_history||[]);setRecordingCandidate(undefined);setRecordingReason("");setRecordingChanges(data.recording_changes||[]); setHandoff(data.handoff); setWorkflow(data.workflow); setReviewers(data.reviewer_tracking || {version:0,reviewers:[],history:[]}); clearResult(); setReviewRun(data.review_analysis); setDecisions(data.decisions || []); setSaved(data.request); setEmail(data.request.messages[0].text); setTimezone(data.request.coordinator_timezone);
    setRecordingOverride(true); setRecording(recordings.find(r => r.id === data.request.recording_id) || null); setAnalyses(data.analyses);
    setRecoveredDraft(null);
    const backup=readEditorBackup(data.request.id);
    setReply(typeof backup?.reply==="string"?backup.reply:"");
    if (data.active_analysis?.result?.ok) {
      const active = { ...data.active_analysis.result, catalog_review: data.catalog_review };
      setResult(active); setSubject(active.stages?.follow_up?.output?.subject || ""); setDraft(active.stages?.follow_up?.output?.body || "");
      if(backup && backup.run === data.review_analysis?.run_id){if(typeof backup.subject==="string")setSubject(backup.subject);if(typeof backup.body==="string")setDraft(backup.body);}
    }
    if(backup?.body && (backup.run !== data.review_analysis?.run_id || !data.active_analysis?.result?.ok))setRecoveredDraft({subject:backup.subject||"",body:backup.body});
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
    const data: Detail = await command(keyed(payload)); clearEditorBackup("new"); showSaved(data); window.history.replaceState(null,"",requestUrl(data.request.id)); await refresh();
    setNotice("Request saved. Analysis will populate source-backed details automatically."); return data.request;
  }
  async function analyze(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if(!confirmDiscard(draftDirty || !!reply.trim())) return;
    await perform(async () => {
      if (!saved && !effectiveRecording && !allowUnresolved) { setError("The recording is unresolved. Choose a recording or acknowledge the identity gap before analyzing."); return; }
      const record = saved || await save(); clearResult();
      const payload = { action: "analyze", request_id: record.id, expected_revision: record.revision };
      const data: Detail = await command(keyed(payload)); showSaved(data);
      if (data.analysis_status === "completed") { retryCommands.current.delete(JSON.stringify(payload)); setNotice("Analysis saved for this revision. Source-backed details populated automatically. Review exceptions; no per-field confirmation required."); }
      else if (data.analysis_status === "running") setNotice("This run is still pending. Reopen the request to check it. Use Retry analysis with a new run only if you explicitly want another attempt.");
      else { retryCommands.current.delete(JSON.stringify(payload)); setNotice(`Analysis is ${data.analysis_status}. History is preserved. Review the saved request before explicitly retrying.`); }
      await refresh();
    });
  }
  function newRequest() {
    if(!confirmDiscard(unsavedText))return;
    window.history.replaceState(null,"",`/${mode === "internal" ? "internal" : "coordinator"}`);
    clearEditorBackup("new");
    setDashboardOpen(false); setCatalogOpen(false); setRecordingOverride(false); setAllowUnresolved(false); retryCommands.current.clear();
    setRecordingCandidate(undefined);setRecordingReason("");setRecordingChanges([]); setHandoffDirty(false); setReviewerDirty(false);setRequestLoadFailed(false);setLoadingRequest(false);setHandoff(null); setWorkflow(null); setReviewers({version:0,reviewers:[],history:[]}); setReviewRun(null); setDecisions([]); setSaved(null); setEmail(""); setRecording(null); setReply(""); setAnalyses([]); setNotice(""); clearResult();
  }
  async function copyDraft() {
    try { await navigator.clipboard.writeText(`Subject: ${subject}\n\n${draft}`); setCopyStatus("Draft copied. Nothing was sent."); }
    catch { setCopyStatus("Clipboard unavailable. Select and copy the draft manually."); }
  }
  const preview = previewEmail(saved ? saved.messages.map(m => m.text).join("\n") : email);
  const effectiveRecording = recordingOverride || saved ? recording : preview.match;
  const proposals = reviewRun?.result.stages?.intake?.output?.proposed_changes || [];
  const issues = result?.stages?.review?.output?.issues || [];
  const pendingCount = proposals.filter(p => !decisions.some(d => d.run_id === reviewRun?.run_id && d.proposal_id === p.proposal_id)).length;
  const navigationProps = { requests, saved, analyses, busy, reply, onReply: (value:string)=>{backupEditors({reply:value});setReply(value);},
    onRefresh: () => { void perform(refresh); }, onNew: newRequest,
    onOpen: (id: string) => { if(!confirmDiscard(unsavedText))return; setDashboardOpen(false); void perform(async () => { const data = await command({ action: "get", request_id: id }); showSaved(data); window.history.replaceState(null,"",requestUrl(id)); setNotice("Saved request reopened."); }); },
    onAppend: () => { void perform(async () => {
      if (!saved) return;
      const data = await command(keyed({ action: "reply", request_id: saved.id, expected_revision: saved.revision, text: reply }));
      showSaved(data); setReply(""); await refresh(); setNotice("Reply saved. Earlier analysis is outdated; analyze the new revision.");
    }); }
  };
  const selectedId=saved?.id;
  useEffect(()=>{if(selectedId&&!dashboardOpen&&!loadingRequest)headingRef.current?.focus();},[selectedId,dashboardOpen,loadingRequest]);
  const effectiveValue=(key:string)=>saved?.agent_fields?.find(f=>f.field_key===key)?.value??saved?.confirmed_fields.find(f=>f.field_key===key&&f.state==='confirmed')?.value;
  const project=effectiveValue('project');const contact=effectiveValue('client_contact');
  const stale = !!saved && analyses.length > 0 && !result;
  const blockers = result?.catalog_review?.blockers || [];
  const clientQuestions = issues.filter(i => !result?.coordinator_review_issue_ids?.includes(i.issue_id));
  function editEmail(value: string) {
    writeEditorBackup("new",{email:value});
    setEmail(value); setRecording(null); setRecordingOverride(false); setAllowUnresolved(false); clearResult();
  }
  return <div className="app-shell">
    <a className="skip-link" href="#main-workspace">Skip to workspace</a>
    <aside className="app-sidebar" aria-label="Request navigation">
      <a className="brand" href="#main-workspace">syncflow<span className="brand-period">.</span></a>
      <p className="sidebar-caption">MUSIC LICENSING WORKSPACE</p>
      {mode === "coordinator" ? <button className="new-request-button" disabled={busy} onClick={newRequest}>＋ New request</button> : <Link className="new-request-button" href={saved ? `/coordinator?request=${encodeURIComponent(saved.id)}` : "/coordinator"}>Open coordinator page</Link>}<button type="button" className="dashboard-nav" disabled={busy} onClick={()=>{if(!confirmDiscard(unsavedText))return;setDashboardOpen(true);void perform(refresh);}}>View all requests {listState==='ready'?`(${requests.length})`:listState==='loading'?"…":""}</button>
      <div className="sidebar-bottom"><small>{shared?"Shared workspace · Authorized team members":"Saved on this computer · Single operator"}<br />Fictional catalog · Nothing sends automatically</small></div>
    </aside>
    <main className="main-workspace" id="main-workspace"><div className="workspace-body">
      {dashboardOpen && saved ? <button type="button" className="dashboard-entry text-button" disabled={busy} onClick={()=>setDashboardOpen(false)}>Back to selected request</button> : null}
      <div aria-live="polite">{notice?<p className="notice">{notice}</p>:null}</div>
      {listState==='error'?<div role="alert" className="analysis-error"><strong>Requests could not load</strong><p>Your saved requests have not been deleted. Check your connection and try again.</p><button className="secondary-button" disabled={busy} onClick={()=>{void perform(refresh);}}>Retry loading requests</button></div>:null}
      {dashboardOpen && error ? <p role="alert" className="analysis-error">{error}</p> : null}
      {loadingRequest?<section className="result-panel" role="status" aria-busy="true"><h1>Opening saved request…</h1><p>Loading the conversation, analysis and reviewer records.</p></section>:requestLoadFailed&&!dashboardOpen?<section className="result-panel" role="alert"><h1>Couldn’t open this request</h1><p>Check your connection or choose another saved request. Your existing work is unchanged.</p><button className="primary-button" onClick={()=>{setLoadingRequest(true);setLoadAttempt(n=>n+1);}}>Retry opening request</button><button className="secondary-button" onClick={()=>{setDashboardOpen(true);void perform(refresh);}}>View all requests</button></section>:dashboardOpen ? <RequestDashboard requests={requests} loadState={listState} busy={busy} onOpen={navigationProps.onOpen} onNew={mode === "internal" ? () => {router.push("/coordinator");} : newRequest} onRefresh={navigationProps.onRefresh} /> : <>

      <div className="workspace-title"><div><p className="eyebrow">SYNC REQUEST INTAKE</p><h1 ref={headingRef} tabIndex={-1}>{saved ? `${mode === 'internal' ? 'Internal review' : 'Client coordination'} · ${valueText(project||contact||recording?.title||saved.id.slice(0,8))}` : mode === 'internal' ? 'Internal handoffs & decisions' : 'Start with the client’s email.'}</h1><p>{mode === "internal" ? "Prepare the reviewer handoff and record decisions received from your team." : "See the recording, resolve the gaps and prepare your next email."}</p></div><span className="status-pill">{saved ? `Saved · revision ${saved.revision}` : 'New request'}</span></div>
      {saved ? <section className="selected-request-context" aria-label="Selected request"><strong>{valueText(project || 'Project missing')}</strong><span>{valueText(contact || 'Client missing')}</span><span>{recording ? `${recording.title} · ${recording.artist} · ${recording.version}` : 'Recording unresolved'}</span><small>{saved.agent_fields?.length?"Includes agent-extracted details · ":""}Revision {saved.revision} · {workflow?.status || 'Status loading'}</small></section> : null}
      <div aria-live="polite">{busy ? <p className="busy-notice">Working on the request. Saved facts and history are preserved…</p> : null}</div>
      {error ? <div role="alert" className="analysis-error"><strong>Action needs attention</strong><p>{error}</p>{saved ? <button className="secondary-button" disabled={busy} onClick={()=>{if(!confirmDiscard(draftDirty || !!reply.trim()))return;void perform(async()=>{const data:Detail=await command({action:"get",request_id:saved.id});showSaved(data);setNotice("Saved request checked. Review its latest status before retrying.");});}}>Check saved request</button> : null}</div> : null}
      {recoveredDraft ? <details className="handoff-panel" open><summary>Recovered unsent email edits · outdated, review before reuse</summary><p>These are your tab-local editor notes, not a current generated response. They were not sent or confirmed.</p><strong>{recoveredDraft.subject}</strong><textarea aria-label="Recovered unsent email" value={recoveredDraft.body} readOnly rows={8}/></details> : null}
      {saved ? <p><Link className="secondary-button" href={`${mode === "internal" ? "/coordinator" : "/internal"}?request=${encodeURIComponent(saved.id)}`}>{mode === "internal" ? "← Back to this request in Coordinator" : "Open this request in Internal review →"}</Link></p> : null}
      {saved && workflow ? <section className="workflow-status" aria-label="Request status and next action"><div><p className="eyebrow">CURRENT STATUS</p><h2>{workflow.status}</h2><p>{workflow.next_action}</p></div><div><details><summary>Readiness checks ({workflow.reasons.length})</summary>{workflow.reasons.map((reason,i)=><p key={i}>{reason}</p>)}<p>Readiness refers to internal review only. Publishing verification and the licensing process remain separate.</p></details>
        {workflow.completion?.needs_reconfirmation ? <p className="stale-banner">Previous completion is outdated after a request or reviewer change.</p> : null}
        {mode === "internal" ? <nav className="review-next-actions" aria-label="Review actions"><Link href={`/coordinator?request=${encodeURIComponent(saved.id)}`}>Resolve client or recording gaps</Link><a href="#internal-handoff">Prepare handoff summary</a><a href="#internal-reviewers">Record reviewer decisions</a></nav>:<p>Reviewer decisions and completion are managed in Internal review.</p>}
        {workflow.history.length ? <details><summary>Completion history ({workflow.history.length})</summary>{workflow.history.map((event,i)=><p key={i}>Revision {event.request_revision} · {event.completed_by} · {event.completed_at}</p>)}</details> : null}
      </div></section> : null}
      {saved&&workflow?<section className="workflow-status coordinator-signoff" aria-label="Coordinator brief approval"><div><h2>{workflow.brief_approved?'Brief approved for internal review':'Coordinator brief review'}</h2><p>Review the recording and complete summary once. This approves the brief for internal review; it does not confirm each agent-extracted fact or grant music rights.</p>{workflow.brief_approval?<p>{workflow.brief_approval.outdated?'Previous approval is outdated. ':''}Approved by {workflow.brief_approval.approved_by} at {workflow.brief_approval.approved_at} · revision {workflow.brief_approval.request_revision}</p>:null}</div><div>{mode==='coordinator'&&!workflow.brief_approved?<><button className="primary-button" disabled={busy||!workflow.can_approve_brief||!reviewRun} onClick={()=>{if(!confirmDiscard(unsavedText))return;void perform(async()=>{const data:Detail=await command(keyed({action:'approve_brief',request_id:saved.id,expected_revision:saved.revision,analysis_run_id:reviewRun!.run_id}));showSaved(data);await refresh();setNotice('Coordinator approval saved for this request revision and analysis. No licence or rights clearance was granted.');});}}>Approve brief for internal review</button>{!workflow.can_approve_brief?<p>Resolve recording identity, missing details and checklist questions, then analyze successfully before approval.</p>:null}</>:!workflow.brief_approved?<Link className="secondary-button" href={`/coordinator?request=${encodeURIComponent(saved.id)}`}>Review and approve in Coordinator</Link>:<p>Current sign-off recorded. Changes require fresh approval.</p>}{briefHistory.length?<details><summary>Brief approval history ({briefHistory.length})</summary>{briefHistory.map(record=><p key={record.version}>Revision {record.request_revision} · analysis {record.analysis_run_id} · {record.approved_by} · {record.approved_at}</p>)}</details>:null}</div></section>:null}
      {mode === "coordinator" ? <>
      {saved ? <AnalysisRecovery latest={analyses.at(-1)} busy={busy} hasCurrentResult={!!result} onCheck={async()=>{if(!confirmDiscard(draftDirty || !!reply.trim()))return false;let success=false;await perform(async()=>{const data:Detail=await command({action:'get',request_id:saved.id});showSaved(data);success=true;setNotice('Saved analysis status refreshed. No new agent call was made.');});return success;}} onRetry={()=>{retryCommands.current.delete(JSON.stringify({action:'analyze',request_id:saved.id,expected_revision:saved.revision}));void analyze();}} /> : null}
      <div className="intake-grid live-intake-grid">
        <section id="client-brief" className="result-panel analysis-input" aria-labelledby="analyze-heading">
          <p className="eyebrow">01 / CLIENT BRIEF & REPLIES</p><h2 id="analyze-heading">{saved ? 'Email conversation' : 'Paste the request'}</h2>
          <form id="request-analysis-form" onSubmit={analyze} aria-busy={busy}>
            <div hidden={!!saved}><label htmlFor="client-email">Client email</label><textarea id="client-email" rows={12} maxLength={20000} value={email} disabled={busy || !!saved} required onChange={e => editEmail(e.target.value)} placeholder="Paste the client’s email here…" /></div>
            {!saved ? <button type="button" className="text-button" disabled={busy} onClick={() => {if(confirmDiscard(!!email.trim()))editEmail(example);}}>Try an example</button> : <p className="panel-note">Original email preserved. Add replies below.</p>}
            <details className="settings-disclosure"><summary>Request settings</summary><label htmlFor="request-timezone">Coordinator timezone</label><input id="request-timezone" value={timezone} disabled={busy || !!saved} required onChange={e => {setTimezone(e.target.value); clearResult();}} /></details>
            {!saved && email.trim() && !effectiveRecording ? <div className="identity-warning"><p>No exact recording selected. Analysis can clarify the request, but you will need to resolve this identity gap before internal review.</p><label><input type="checkbox" checked={allowUnresolved} disabled={busy} onChange={e => setAllowUnresolved(e.target.checked)} /> Continue with unresolved recording identity</label></div> : null}
            <div className="form-footer"><small>Saves this request, analyzes the conversation and drafts questions if needed. Uses Claude API credits. Use fictional data.<br />Nothing is sent to the client.</small></div>
          </form>
          {saved ? <SavedRequests {...navigationProps} variant="conversation" activeRunId={result ? reviewRun?.run_id : undefined} onRecheck={() => {if(!confirmDiscard(draftDirty))return;void perform(async () => {
            const appended: Detail = await command(keyed({action:'reply',request_id:saved.id,expected_revision:saved.revision,text:reply}));
            backupEditors({reply:""});showSaved(appended); setReply(''); await refresh();
            const payload = {action:'analyze', request_id:saved.id,expected_revision:appended.request.revision};
            const checked: Detail = await command(keyed(payload)); showSaved(checked); await refresh();
            if (checked.analysis_status === 'completed') retryCommands.current.delete(JSON.stringify(payload));
            setNotice(checked.analysis_status === 'completed' ? 'Reply checked. Checklist and next response updated.' : 'Reply saved. Analysis needs attention; retry drafting the response.');
          });}} /> : null}
        </section>
        <aside id="request-record" className="result-panel request-summary" aria-labelledby="summary-heading">
          <p className="eyebrow">02–03 / REQUEST RECORD & CHECKLIST</p><h2 id="summary-heading">What needs attention?</h2>
          <div className="preview-recording"><small>{saved ? 'SAVED RECORDING' : recordingOverride ? 'YOUR SELECTION' : 'PROVISIONAL CATALOG MATCH'}</small><h3>{effectiveRecording?.title || (!email.trim() && !saved ? 'Waiting for client email' : 'Recording unresolved')}</h3><p>{effectiveRecording ? `${effectiveRecording.artist} · ${effectiveRecording.version} · ${effectiveRecording.id}` : preview.candidates.length ? 'Several recordings may match. Confirm the artist and exact version.' : 'Paste a title, artist and version, or inspect the catalog.'}</p><button type="button" className="text-button" disabled={busy} onClick={() => setCatalogOpen(!catalogOpen)} aria-expanded={catalogOpen}>{catalogOpen ? 'Close catalog' : 'Inspect / change recording'}</button></div>
          <div id="request-checklist"><RequestCoverage email={saved ? saved.messages.map(m => m.text).join("\n") : email} analyzed={!!result} stale={stale} proposals={result ? proposals.filter(p => !decisions.some(d => d.run_id === reviewRun?.run_id && d.proposal_id === p.proposal_id)) : []} confirmed={saved?.confirmed_fields || []} issues={clientQuestions} agentFields={saved?.agent_fields || []} /></div>
          <button type="submit" form="request-analysis-form" className="primary-button" disabled={busy || !email.trim()}>{busy ? "Analyzing & drafting…" : "Analyze & draft response"}</button>
          {stale ? <p className="stale-banner">Analysis and draft are outdated. Use Analyze & draft response to check the updated conversation.</p> : null}
          {result ? <><h3>{blockers.length} internal checks</h3>{blockers.length ? <ul>{blockers.map(b => <li key={b.code}>{b.question}</li>)}</ul> : <p>No catalog checks reported.</p>}</> : null}

          <p className="panel-note">Catalog matches and confirmed request facts do not grant rights clearance.</p>
        </aside>
                <section className="result-panel draft-panel live-response-panel" id="client-response" aria-labelledby="next-action-heading"><p className="eyebrow">04 / CLIENT RESPONSE</p><h2 id="next-action-heading">{stale ? 'Analyze the updated request' : result?.stages?.follow_up?.skipped ? 'Review exceptions and internal checks' : result ? 'Review and copy the client email' : 'Analyze this request'}</h2>
          {result && !result.stages?.follow_up?.skipped ? <><p className="panel-note">{draftDirty ? "Edited draft · unsaved. Leaving or replacing this editor requires confirmation. " : "Generated draft · "}Questions for the client only. Internal checks remain in the summary above. This draft has not been sent.</p><label htmlFor="draft-subject">Subject</label><input id="draft-subject" value={subject} disabled={busy} onChange={e => {backupEditors({subject:e.target.value});setSubject(e.target.value);setCopyStatus('');}} /><label htmlFor="draft-body">Email draft</label><textarea id="draft-body" rows={14} value={draft} disabled={busy} onChange={e => {backupEditors({body:e.target.value});setDraft(e.target.value);setCopyStatus('');}} /><button type="button" className="primary-button" disabled={busy} onClick={copyDraft}>Copy draft</button><p role="status">{copyStatus}</p></> : <p>{stale ? 'Use Analyze & draft response. Confirmed facts and history are preserved.' : result ? 'No clarification email is needed. Resolve exceptions and complete the internal checks; this does not approve a licence.' : 'Use Analyze & draft response to generate the checklist and any necessary email.'}</p>}
        </section>

      </div>
      <div hidden={!catalogOpen} className="inline-catalog"><RecordingPicker selected={saved && recordingCandidate!==undefined ? recordingCandidate : effectiveRecording} disabled={busy} allowScenarios={!saved} onSelect={r => {if(saved)setRecordingCandidate(r);else {setRecordingOverride(true);setRecording(r);clearResult();}}} onScenario={editEmail} />
        {saved && recordingCandidate!==undefined ? <form className="recording-correction" onSubmit={e=>{e.preventDefault();if(!confirmDiscard(draftDirty || !!reply.trim()))return;void perform(async()=>{
          const data:Detail=await command(keyed({action:'change_recording',request_id:saved.id,expected_revision:saved.revision,recording_id:recordingCandidate?.id??null,reason:recordingReason}));
          showSaved(data);await refresh();setNotice('Recording correction saved. Conversation and confirmed client facts were preserved. Recheck the request and reconfirm prior reviews.');
        });}}><h3>Review the recording correction</h3><p>Saved: {saved.recording_id||'Unresolved'} → Proposed: {recordingCandidate?.id||'Unresolved'}</p><p>This changes the request revision, invalidates its analysis and handoff, and requires prior reviewer decisions to be reconfirmed. Confirmed client facts are preserved; check that the recording matches them.</p><label htmlFor="recording-reason">Reason for correction</label><textarea id="recording-reason" rows={3} required maxLength={2000} disabled={busy} value={recordingReason} onChange={e=>setRecordingReason(e.target.value)} /><button className="primary-button" disabled={busy||!recordingReason.trim()||(recordingCandidate?.id??null)===(saved.recording_id??null)}>Save recording correction</button><button className="secondary-button" type="button" disabled={busy} onClick={()=>{setRecordingCandidate(undefined);setRecordingReason('');}}>Cancel correction</button></form> : null}
        {recordingChanges.length ? <details><summary>Recording correction history ({recordingChanges.length})</summary>{recordingChanges.map(change=><p key={change.revision}>{change.previous_recording_id||'Unresolved'} → {change.recording_id||'Unresolved'} · {change.reason} · {change.actor_id} · {change.at}</p>)}</details> : null}</div>

      </> : !saved ? <p>Select a saved request from View all requests to prepare a handoff and record reviewer decisions.</p> : <p>Request {saved.id} · {saved.messages.length} source messages · {saved.recording_id || "Recording unresolved"}. Source emails and music catalog are on the Coordinator page.</p>}
      {mode === "internal" && saved && handoff ? <InternalHandoff key={`handoff-${saved.id}`} coordinatorApproved={!!workflow?.brief_approved} request={saved} questions={clientQuestions} catalog={reviewRecording(saved.recording_id)} analysisCurrent={!!result} pendingCount={pendingCount} busy={busy} savedDraft={handoff} onDirtyChange={setHandoffDirty} onSave={async(text,source)=>{
        let success=false;await perform(async()=>{
          const data:Detail=await command(keyed({action:'save_handoff',request_id:saved.id,expected_revision:saved.revision,expected_handoff_version:handoff.version,source_token:source,text}));
          setHandoff(data.handoff);success=true;setNotice('Handoff edits saved. Nothing was sent.');
        });return success;
      }} /> : null}
      {mode === "internal" && saved ? <ReviewerTracking key={`reviewers-${saved.id}`} requestId={saved.id} tracking={reviewers} busy={busy} onDirtyChange={setReviewerDirty} onSave={async input => {
        let success=false;
        await perform(async () => {
          const data: Detail = await command(keyed({action:'reviewer',request_id:saved.id,expected_revision:saved.revision,expected_review_version:reviewers.version,...input}));
          setHandoff(data.handoff); setWorkflow(data.workflow); setReviewers(data.reviewer_tracking); success=true; setNotice('Reviewer record saved. No message was sent.'); await refresh();
        });
        return success;
      }} /> : null}
      {mode==='internal'&&saved&&workflow?<section className="workflow-status review-completion" aria-label="Complete internal review"><h2>Complete internal review</h2>{!workflow.can_complete&&!workflow.completed?<><p>Finish these checks first:</p><ul>{workflow.reasons.map((reason,i)=><li key={i}>{reason}</li>)}</ul></>:null}        {mode === "internal" ? workflow.completed ? <p>Recorded by {workflow.completion?.completed_by} at {workflow.completion?.completed_at}. This is not rights clearance.</p> : <button type="button" className="primary-button" disabled={busy||!workflow.can_complete} onClick={()=>{void perform(async()=>{
          const data:Detail=await command(keyed({action:'complete_review',request_id:saved.id,expected_revision:saved.revision,expected_review_version:reviewers.version}));
          setHandoff(data.handoff); setWorkflow(data.workflow);setNotice('Internal review completion recorded. No licence or rights clearance was granted.'); await refresh();
        });}}>Mark internal review complete</button> : null}</section>:null}
      </>}
      <footer className="workspace-footer">{shared?"Shared team workspace":"Local workspace"} · Intake and coordination support · No automatic sending or rights approval</footer>
    </div></main>
  </div>;
}
