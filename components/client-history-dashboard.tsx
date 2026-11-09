'use client';
import Link from 'next/link';
import CoordinatorBriefing from './coordinator-briefing';
import {useEffect,useRef,useState} from 'react';
import {clientGroups,clientFile,priorityClientGroups,priorityActionState} from '../requests/client-history.js';
import type {SavedRequest,RequestSummary,AnalysisSummary} from './saved-requests';
type Summary=RequestSummary&{updated_at?:string;created_at?:string};
type History={request:SavedRequest;analyses:AnalysisSummary[];active_analysis:{result:{stages?:{follow_up?:{output?:{subject:string;body:string}|null}}}}|null};
const date=(value?:string)=>value?new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}): 'Date unavailable';
async function readRequest(payload:Record<string,string>,signal:AbortSignal){
 const response=await fetch('/api/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal});
 const data=await response.json();if(!response.ok)throw new Error('Saved history could not load. Try again.');return data;
}
function stageOf(r:Summary){
 if(['Internal review complete','Case completed'].includes(r.status||''))return 'complete';
 if(r.status==='Needs coordinator review')return 'approval';
 if(['Ready for internal review','Internal review pending','Ready to complete internal review','Changes requested','Declined'].includes(r.status||''))return 'review';
 return 'attention';
}
function clientCopy(text:string){
 return text.replace(/^FICTIONAL TEST CASE — not a real client request\.\s*/, '')
 .replace('Fictional client reply: please use the scope in our original message. This is test data.', 'Thanks for following up. The scope in our original email is confirmed. Please let us know if you need anything else to move this forward.')
 .replace('Fictional client reply: the campaign details remain unchanged. Please continue the review.', 'The campaign details are unchanged. Could you confirm the next steps and when we can expect an update?')
 .replace('Fictional scope change: the campaign now also includes the United States. Please recheck this change.', 'We’ve expanded the campaign to include the United States alongside Canada. Could you review the revised territory and let us know if it affects the clearance or fee?');
}
export default function ClientHistoryDashboard({testWorkspace=false}:{testWorkspace?:boolean}){
 const [aiStale,setAiStale]=useState(false),[refreshError,setRefreshError]=useState('');
 const [aiElapsed,setAiElapsed]=useState(0);
 const [aiReport,setAiReport]=useState<{generated_at:string;reviewed_count:number;items:{blocker:string;next_action:string;client:string;client_key:string;project:string;request_id:string;citations:{message_id:string;exact_quote:string}[];destination:string}[]}|null>(null),[aiBusy,setAiBusy]=useState(false),[aiError,setAiError]=useState('');
 const [requests,setRequests]=useState<Summary[]>([]),[load,setLoad]=useState<'loading'|'ready'|'error'>('loading'),[attempt,setAttempt]=useState(0);
 const [queueView,setQueueView]=useState<'all'|'action'|'waiting'>('all');
 const [clientView,setClientView]=useState<'attention'|'all'>('all');
 const [search,setSearch]=useState(''),[selected,setSelected]=useState<string|null>(null);
 const [opened,setOpened]=useState<string|null>(null),[history,setHistory]=useState<History|null>(null),[historyState,setHistoryState]=useState<'loading'|'ready'|'error'>('loading'),[historyAttempt,setHistoryAttempt]=useState(0);
 useEffect(()=>{if(!aiBusy)return;const timer=setInterval(()=>setAiElapsed(n=>n+1),1000);return()=>clearInterval(timer);},[aiBusy]);
 const loadedFingerprint=useRef('');
 const hasLoaded=useRef(false);
 const aiController=useRef<AbortController|null>(null);
 const fileHeading=useRef<HTMLHeadingElement>(null);
 const returnFocus=useRef<string|null>(null);
 useEffect(()=>()=>{aiController.current?.abort();},[]);
 useEffect(()=>{if(selected)fileHeading.current?.focus();else if(returnFocus.current){document.getElementById(returnFocus.current)?.focus();returnFocus.current=null;}},[selected]);
 const historyTrigger=useRef<HTMLButtonElement|null>(null);
 const historyHeading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{const controller=new AbortController();readRequest({action:'list'},controller.signal).then(data=>{if(!controller.signal.aborted){const fingerprint=JSON.stringify(data.requests);if(loadedFingerprint.current!==fingerprint){setAiStale(true);loadedFingerprint.current=fingerprint;}setRequests(data.requests);hasLoaded.current=true;setRefreshError('');setLoad('ready');}}).catch(()=>{if(!controller.signal.aborted){if(hasLoaded.current){setRefreshError('Could not refresh case files. Displayed information may be out of date.');setAiStale(true);}else setLoad('error');}});return()=>controller.abort();},[attempt]);
 useEffect(()=>{const refresh=()=>{if(document.visibilityState==='visible')setAttempt(n=>n+1);};const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};},[]);
 useEffect(()=>{if(!opened)return;const controller=new AbortController();readRequest({action:'get',request_id:opened},controller.signal).then(data=>{if(!controller.signal.aborted){setHistory(data);setHistoryState('ready');}}).catch(()=>{if(!controller.signal.aborted)setHistoryState('error');});return()=>controller.abort();},[opened,historyAttempt]);
 useEffect(()=>{if(opened)historyHeading.current?.focus();},[opened,historyState]);
 const displayed=requests;
 const groups=clientGroups(displayed);
 const needsAttention=(r:Summary)=>stageOf(r)!=='complete';
 const query=search.trim().toLowerCase();
 const attentionClients=groups.filter(group=>group.requests.some(needsAttention));
 const scoped=requests.filter(r=>(clientView==='all'||(aiReport?aiReport.items.some(item=>item.request_id===r.id):!!aiError&&needsAttention(r)))&&(!query||[r.contact,r.project,r.track,r.preview,r.id].some(value=>value?.toLowerCase().includes(query))));
 const queueRequests=aiReport&&clientView==='attention'?scoped.filter(r=>queueView==='all'||priorityActionState(r)===queueView):scoped;
 const visible=aiReport&&clientView==='attention'?priorityClientGroups(queueRequests,aiReport.items):clientGroups(scoped);
 const active=clientFile(requests,selected);
 const rows=(active?.requests as Summary[]||[]).toSorted((a,b)=>Number(needsAttention(b))-Number(needsAttention(a))||(b.updated_at||'').localeCompare(a.updated_at||''));
 async function runAiReview(){
  if(aiController.current)return;
  const controller=new AbortController();aiController.current=controller;
  const fingerprint=loadedFingerprint.current;
  const timeout=setTimeout(()=>controller.abort(),55000);
  setAiElapsed(0);setAiBusy(true);setAiError('');
  try{
   const response=await fetch('/api/priority-review',{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:controller.signal});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'AI review could not finish.');
   setAiReport(data.report);if(data.report){setQueueView('all');}
   setAiStale(loadedFingerprint.current!==fingerprint);if(!data.report)setAiError('No open cases need attention.');
  }catch(error){setAiStale(true);setAiError(controller.signal.aborted?'Analysis stopped. You can try again.':error instanceof Error?error.message:'AI review could not finish.');}
  finally{clearTimeout(timeout);aiController.current=null;setAiBusy(false);}
 }
 function showHistory(id:string){
  setOpened(id);
  setHistory(null);setHistoryState('loading');setHistoryAttempt(n=>n+1);
 }
 return <main className="client-dashboard team-workspace"><div className="workspace-title"><div><p className="eyebrow">YOUR WORKSPACE</p><h1>Daily briefing</h1><p>Review priorities, then continue the work in Coordinator.</p></div><Link href="/coordinator" className="primary-button">＋ New request</Link></div>
 {refreshError&&<p role="status" className="briefing-stale">{refreshError}</p>}
 {load==='loading'?<p role="status" aria-busy="true">Loading client history…</p>:load==='error'?<div role="alert" className="analysis-error"><p>Client history could not load. Your saved requests are unchanged.</p><button className="secondary-button" onClick={()=>{setOpened(null);setLoad('loading');setAttempt(n=>n+1);}}>Retry loading history</button></div>:<>





 {!active&&<CoordinatorBriefing busy={aiBusy} error={aiError} elapsed={aiElapsed} onAnalyze={runAiReview}/>}
 {!active&&aiStale&&aiReport?<p className="sr-only" role="status">Client directory briefing may be outdated. Use the live work queue above.</p>:null}
 {!active&&<div className="history-search"><label htmlFor="client-history-search">Find a client or request</label><input id="client-history-search" type="search" placeholder="Client, project, song or request ID" value={search} onChange={e=>{setSearch(e.target.value);setSelected(null);setOpened(null);}}/></div>}
 {!active&&<div className="dashboard-main-views"><div className="client-view-tabs" role="group" aria-label="Client view"><button aria-pressed={clientView==='attention'} onClick={()=>{setClientView('attention');setSelected(null);setOpened(null);}}>Clients who need attention <span>{attentionClients.length}</span></button><button aria-pressed={clientView==='all'} onClick={()=>{setClientView('all');setSelected(null);setOpened(null);}}>Clients <span>{groups.length}</span></button></div></div>}


 {(!displayed.length?<section className="result-panel"><h2>Your client history starts here</h2><p>Save a client’s request to build its conversation history. No saved requests yet.</p><Link href="/coordinator" className="primary-button">Create your first request</Link></section>:<>
 {!active&&clientView==='attention'&&aiReport?<div className="priority-queue-filters" role="group" aria-label="Priority queue view">{([['all','All priorities'],['action','Coordinator actions'],['waiting','Awaiting internal review']] as const).map(([value,label])=><button key={value} type="button" className="secondary-button" aria-pressed={queueView===value} onClick={()=>setQueueView(value)}>{label} <span>{aiReport.items.filter(item=>value==='all'||priorityActionState(requests.find(r=>r.id===item.request_id))===value).length}</span></button>)}<p className="panel-note">Ordered by priority. Awaiting internal review means a reviewer decision is pending; it does not mean the client has been contacted.</p></div>:null}
 <div className="history-columns client-directory">{!active&&<section className="client-directory-panel" aria-labelledby="client-list-heading"><div className="history-section-title"><h2 id="client-list-heading">{clientView==='attention'?'Clients who need attention':'Clients'}</h2></div><div className="client-history-grid">{visible.map(group=><article key={group.key} className="client-history-card"><strong>{group.name}</strong><span>{group.requests.length} {group.requests.length===1?'request':'requests'} · {group.message_count} {group.message_count===1?'message':'messages'}</span>{clientView==='attention'&&aiReport&&<ul className="client-card-ai-reasons">{aiReport.items.filter(item=>group.requests.some((r:Summary)=>r.id===item.request_id)).map(item=><li key={item.request_id}><span className={`priority-action-state ${priorityActionState(requests.find(r=>r.id===item.request_id))}`}>{priorityActionState(requests.find(r=>r.id===item.request_id))==='waiting'?'Awaiting internal review':'Coordinator action'}</span><strong>{item.project}:</strong> {item.blocker}<p><strong>Next:</strong> {item.next_action}</p><p className="priority-owner">Responsible: {requests.find(r=>r.id===item.request_id)?.responsible||'Coordinator'}</p>{item.citations.length?<details className="priority-evidence"><summary>Source evidence</summary>{item.citations.map((citation,index)=><blockquote key={`${citation.message_id}-${index}`}>{citation.exact_quote}</blockquote>)}<small>Email excerpts support the briefing; reviewer status comes from the saved workflow.</small></details>:null}<Link className="secondary-button" href={`/${item.destination}?request=${encodeURIComponent(item.request_id)}`}>{item.destination==='internal'?'Continue in Internal review':'Continue in Coordinator'}</Link></li>)}</ul>}{clientView==='attention'&&!aiReport&&<p>{group.requests.map((r:Summary)=>r.blocker).filter(Boolean).join(' ')||'Open this client file to review the saved case status.'}</p>}<span className="client-attention-count">{group.requests.filter(needsAttention).length} open {group.requests.filter(needsAttention).length===1?'request':'requests'}</span><small>Last request update {date(group.updated_at)}</small><button id={`client-open-${encodeURIComponent(group.key)}`} type="button" className="secondary-button client-open-button" onClick={()=>{setSelected(group.key);setOpened(null);}}>Open client file</button></article>)}</div>{!visible.length&&<p className="client-empty">{query?'No clients match your search.':aiReport&&queueView!=='all'?'No cases in this queue.':clientView==='attention'&&!aiReport?'Click Analyze priorities to see which clients need attention.':'No clients need attention. Choose Clients to view everyone.'}</p>}</section>}
 {active&&<section aria-labelledby="request-history-heading"><button className="secondary-button back-to-clients" onClick={()=>{returnFocus.current=`client-open-${encodeURIComponent(selected||'')}`;setSelected(null);setOpened(null);setHistory(null);}}>Back to clients</button><h2 ref={fileHeading} tabIndex={-1} id="request-history-heading">{active?`${active.name} · ${rows.length} ${rows.length===1?'case':'cases'}`:'Select a client'}</h2>{rows.length?<ul className="client-request-list">{rows.map(r=><li className="result-panel" key={r.id}><div className="history-section-title"><h3>{r.project||r.track||'Untitled request'}</h3><span className="status-pill">{r.status||'Status unavailable'}</span></div><dl className="dashboard-request-facts"><div><dt>Client file</dt><dd><Link className="client-file-link" href={`/coordinator?request=${encodeURIComponent(r.id)}`}>{r.contact||'Unidentified client'}</Link></dd></div><div><dt>Song</dt><dd>{r.track||r.recording_id||'Recording unresolved'}</dd></div><div><dt>Missing / blocker</dt><dd>{r.blocker||'Open the request to review missing details.'}</dd></div><div><dt>Next action</dt><dd>{r.next_action||'Open the request to review its current state.'}</dd></div><div><dt>Responsible</dt><dd>{r.responsible||'Coordinator'}</dd></div></dl><p className="panel-note">{r.message_count} {r.message_count===1?'message':'messages'} · revision {r.revision} · updated {date(r.updated_at)}{r.agent_extracted?' · Includes agent-extracted details':''}</p><div className="history-actions"><Link className="primary-button" href={`/${stageOf(r)==='review'||stageOf(r)==='complete'?'internal':'coordinator'}?request=${encodeURIComponent(r.id)}`}>{stageOf(r)==='complete'?'View review record':stageOf(r)==='review'?'Open internal review':stageOf(r)==='approval'?'Review & sign off':'Open client file'}</Link><button type="button" className="secondary-button" onClick={e=>{historyTrigger.current=e.currentTarget;showHistory(r.id);}}>Conversation history</button></div></li>)}</ul>:<p role="status">No requests match your search. Clear the search, select another stage or show all requests.</p>}</section>}</div>
 </>)}
 </>}
 {opened?<section className="result-panel history-reader" aria-labelledby="history-reader-heading"><div className="history-section-title"><h2 ref={historyHeading} tabIndex={-1} id="history-reader-heading">Conversation history</h2><button className="secondary-button" onClick={()=>{setOpened(null);setHistory(null);historyTrigger.current?.focus();}}>Close history</button></div>{historyState==='loading'?<p role="status" aria-busy="true">Loading saved conversation…</p>:historyState==='error'?<div role="alert"><p>Conversation could not load.</p><button className="secondary-button" onClick={()=>{setHistoryState('loading');setHistoryAttempt(n=>n+1);}}>Retry conversation</button></div>:history?<><p>{`Original client email and appended replies · revision ${history.request.revision}`}</p><ol className="message-timeline history-message-list">{history.request.messages.map((message,i)=><li key={message.message_id}><h3>{i===0?'Original client email':`Client reply ${i}`}</h3><small>{date(message.received_at)}</small><p className="message-body">{testWorkspace?clientCopy(message.text):message.text}</p>{testWorkspace&&clientCopy(message.text)!==message.text&&<details><summary>Original saved text</summary><p className="message-body">{message.text}</p></details>}</li>)}</ol>{history.analyses.length?<details><summary>Saved analysis history ({history.analyses.length})</summary>{history.analyses.map(run=><article key={run.run_id}><h3>Revision {run.base_revision} · {run.status}</h3>{run.draft?<><strong>{run.draft.subject}</strong><p className="message-body">{run.draft.body}</p><small>Generated draft · no sending status recorded</small></>:<p>No saved email draft for this run.</p>}</article>)}</details>:<p>No saved analysis yet.</p>}{<p><Link className="primary-button" href={`/coordinator?request=${encodeURIComponent(history.request.id)}`}>Continue this request</Link></p>}</>:null}</section>:null}
 </main>;
}
