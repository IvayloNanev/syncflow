'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
type Item={request_id:string;client:string;project:string;status:string;responsible:string;reason:string;blocker:string;next_action:string;changed:boolean;changes:string[];explanation_source:string;deadline:{date?:string;time?:string;timezone?:string;supplied_text?:string}|null;handoff:{state:string;stage:string;label:string;destination:string;anchor:string};evidence:{kind:string;text:string}[]};
type Supervision={checked_at:string;saved_at:string|null;items:Item[];changed_count:number;finished_count:number};
export default function CoordinatorBriefing({busy,error,elapsed,onAnalyze}:{busy:boolean;error:string;elapsed:number;onAnalyze:()=>void}){
 const [data,setData]=useState<Supervision|null>(null),[failure,setFailure]=useState(''),[filter,setFilter]=useState('all'),[refresh,setRefresh]=useState(0);
 useEffect(()=>{
  let stopped=false;let timer:ReturnType<typeof setTimeout>;const controller=new AbortController();
  async function check(){
   try{const response=await fetch('/api/priority-review',{cache:'no-store',signal:controller.signal});const body=await response.json();if(!response.ok)throw Error(body.error||'Briefing could not refresh.');if(!stopped){setData(body.supervision);setFailure('');}}
   catch(e){if(!stopped)setFailure(e instanceof Error?e.message:'Briefing could not refresh.');}
   finally{if(!stopped)timer=setTimeout(()=>{if(document.visibilityState==='visible')void check();else timer=setTimeout(check,15000);},15000);}
  }
  const focus=()=>{clearTimeout(timer);setRefresh(n=>n+1);};
  void check();window.addEventListener('focus',focus);
  return()=>{stopped=true;controller.abort();clearTimeout(timer);window.removeEventListener('focus',focus);};
 },[busy,refresh]);
 const items=data?.items.filter(item=>filter==='all'?item.handoff.state!=='finished':filter==='changed'?item.changed:item.handoff.state===filter)||[];
 return <section className="daily-briefing supervisor-briefing" aria-labelledby="daily-briefing-heading">
  <div className="daily-briefing-header"><div><p className="eyebrow">YOUR WORKDAY</p><h2 id="daily-briefing-heading">What needs your attention?</h2><p>Priorities and handoffs across client conversations, analysis, catalogue checks and internal review.</p></div><button className="primary-button" disabled={busy} onClick={onAnalyze}>{busy?'Analyzing priorities…':'Analyze priorities'}</button></div>
  {busy?<div className="briefing-loading" role="status"><div className="briefing-loading-heading"><strong>Reviewing case evidence and preparing the briefing</strong><span>{elapsed}s</span></div><div className="briefing-loading-bar" aria-hidden="true"><span/></div></div>:null}
  {error?<p role="alert">{error}</p>:null}
  {failure?<p role="alert">{failure} Previously displayed information may be out of date. <button className="text-button" onClick={()=>setRefresh(n=>n+1)}>Retry</button></p>:null}
  {!data&&!failure?<p role="status">Checking current work…</p>:null}
  {data?<>
   <p className="panel-note">{data.saved_at?`Saved AI briefing: ${new Date(data.saved_at).toLocaleString()}.`:'No saved AI briefing yet. Current actions below come from saved workflow records.'} Live status checks every 15 seconds while this page is open. No email or approval is automatic.</p>
   {data.changed_count>0?<p role="status" className="briefing-stale">{data.changed_count} {data.changed_count===1?'case':'cases'} {data.saved_at?'changed since the saved briefing':'not yet included in a saved AI briefing'}. Current workflow guidance is shown until you analyze priorities again.</p>:null}
   <div className="priority-queue-filters" role="group" aria-label="Work queue">{[['all','Open work'],['action','Coordinator actions'],['blocked','Blocked'],['waiting','Waiting'],['finished','Finished'],['changed','Changed']].map(([value,label])=><button className="secondary-button" key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label} <span>{data.items.filter(item=>value==='all'?item.handoff.state!=='finished':value==='changed'?item.changed:item.handoff.state===value).length}</span></button>)}</div>
   <ol className="supervisor-queue">{items.map((item,index)=><li key={item.request_id} className={`supervisor-task task-${item.handoff.state}`}>
    <div className="history-section-title"><div><p className="eyebrow">{filter==='all'?`${index+1} · `:''}{item.handoff.state==='waiting'?'Awaiting internal review':item.handoff.state==='finished'?'Finished':item.handoff.state==='blocked'?'Blocker to resolve':'Coordinator action'}</p><h3>{item.client} · {item.project}</h3></div><span className="status-pill">{item.status}</span></div>
    <ul className="supervisor-task-bullets"><li><strong>Priority:</strong> {item.reason}</li><li><strong>Needs attention:</strong> {item.blocker}</li><li><strong>Next:</strong> {item.next_action}</li><li><strong>Responsible:</strong> {item.responsible}</li>{item.deadline?<li><strong>Deadline:</strong> {[item.deadline.date||item.deadline.supplied_text,item.deadline.time,item.deadline.timezone].filter(Boolean).join(' · ')}{!item.deadline.timezone?' · timezone needs confirmation':''}</li>:null}</ul>
    {item.changes.length?<p className="priority-change"><strong>Changed:</strong> {item.changes.join(' · ')}</p>:null}
    <details className="priority-evidence"><summary>Why this recommendation?</summary><p>{item.explanation_source==='ai'?'Saved AI explanation, checked against unchanged case evidence.':'Current saved-state guidance; no AI interpretation of these changes yet.'}</p>{item.evidence.map((e,index)=><blockquote key={index}><strong>{e.kind}: </strong>{e.text}</blockquote>)}</details>
    <Link className="primary-button" href={`/${item.handoff.destination}?request=${encodeURIComponent(item.request_id)}#${item.handoff.anchor}`}>{item.handoff.label}</Link>
   </li>)}</ol>
   {!items.length?<p className="client-empty">No cases in this view.</p>:null}
   <p className="panel-note">Internal review completion is not music rights clearance. Hand-off buttons open the next step; you review and execute it there.</p>
  </>:null}
 </section>;
}
