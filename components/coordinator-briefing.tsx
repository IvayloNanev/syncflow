'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import styles from './coordinator-briefing.module.css';
type Item={priority:number;request_id:string;client:string;project:string;status:string;responsible:string;reason:string;blocker:string;next_action:string;changed:boolean;changes:string[];explanation_source:string;deadline:{date?:string;time?:string;timezone?:string;supplied_text?:string}|null;handoff:{state:string;stage:string;label:string;destination:string;anchor:string};evidence:{kind:string;text:string}[]};
type Supervision={decision_source?:string;checked_at:string;saved_at:string|null;items:Item[];changed_count:number;finished_count:number};
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
 const open=data?.items.filter(item=>item.handoff.state!=='finished')||[];
 const matches=(item:Item,value:string)=>value==='all'?item.handoff.state!=='finished':value==='overdue'?item.priority===0&&item.handoff.state!=='finished':value==='today'?item.priority===1&&item.handoff.state!=='finished':value==='changed'?item.changed:value==='waiting'?item.status==='Internal review pending':item.handoff.state===value;
 const items=data?.items.filter(item=>matches(item,filter))||[];
 const urgency=(item:Item)=>item.handoff.state==='finished'?['Complete','finished']:item.priority===0?['Overdue','urgent']:item.priority===1?['Due today','today']:item.priority===2?['Due soon','today']:item.handoff.state==='waiting'?['Waiting on review','waiting']:item.handoff.state==='blocked'?['Needs attention','blocked']:['Ready for action','action'];
 return <section className={styles.dashboard} aria-labelledby="daily-briefing-heading">
  <div className={styles.heading}><div><p className={styles.eyebrow}>WORKDAY OVERVIEW</p><h2 id="daily-briefing-heading">A clear view of what’s next.</h2><p>Your priorities, blockers and handoffs in one place.</p></div><button className="primary-button" disabled={busy} onClick={onAnalyze}>{busy?'Analyzing priorities…':'✦ Analyze priorities'}</button></div>
  {busy?<div className="briefing-loading" role="status"><div className="briefing-loading-heading"><strong>Reviewing case evidence and preparing the briefing</strong><span>{elapsed}s</span></div><div className="briefing-loading-bar" aria-hidden="true"><span/></div></div>:null}
  {error?<p role="alert">{error}</p>:null}
  {failure?<p role="alert">{failure} Previously displayed information may be out of date. <button className="text-button" onClick={()=>setRefresh(n=>n+1)}>Retry</button></p>:null}
  {!data&&!failure?<p role="status">Checking current work…</p>:null}
  {data?<>
   <div className={styles.metrics}>{[['all','Open requests','Across your workspace'],['overdue','Overdue','Time-sensitive follow-up'],['today','Due today','Keep these moving'],['waiting','Awaiting review','With your reviewers']].map(([value,label,note])=><button key={value} className={`${styles.metric} ${styles[value]||''}`} aria-pressed={filter===value} onClick={()=>setFilter(value)}><span>{label}</span><strong>{data.items.filter(item=>matches(item,value)).length}</strong><small>{note}</small></button>)}</div>
   <div className={styles.queueHeading}><div><p className={styles.eyebrow}>PRIORITY QUEUE</p><h3>{filter==='all'?'Your next moves':filter==='overdue'?'Overdue requests':filter==='today'?'Due today':filter==='finished'?'Completed work':'Focused work'}</h3></div><span className={styles.live}><i/>{data.decision_source==='ai'?'AI-recommended order · current evidence':'Workflow order · AI decision needed'}</span></div>
   <div className={styles.filters} role="group" aria-label="Work queue">{[['all','All open'],['action','Your actions'],['blocked','Blockers'],['waiting','Waiting'],['finished','Finished'],['changed','Changed']].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}<span>{data.items.filter(item=>matches(item,value)).length}</span></button>)}</div>
   <ol className={styles.queue}>{items.map((item,index)=>{const [label,tone]=urgency(item);const featured=item.request_id===open[0]?.request_id&&filter==='all';return <li key={item.request_id} className={`${styles.card} ${styles[tone]} ${featured?styles.featured:''}`}>
    <div className={styles.cardTop}><span className={styles.rank}>{featured?(data.decision_source==='ai'?'AI’S FIRST PRIORITY':'WORKFLOW FIRST PRIORITY'):`#${(open.findIndex(row=>row.request_id===item.request_id)+1)||index+1}`}</span><span className={styles.badge}><i/>{label}</span></div>
    {featured?<p className={styles.eyebrow}>{data.decision_source==='ai'?'Do this first · chosen by your briefing agent':'Run Analyze priorities for the agent’s recommendation'}</p>:null}<h3>{item.project||'Untitled request'}</h3><p className={styles.client}>{item.client}</p>
    <p className={styles.reason}>{item.reason}</p>
    <div className={styles.next}><span>{item.handoff.state==='waiting'?'WAITING FOR':'NEXT ACTION'}</span><p>{item.next_action}</p></div>
    <dl className={styles.meta}><div><dt>Responsible</dt><dd>{item.responsible}</dd></div><div><dt>Deadline</dt><dd>{item.deadline?[item.deadline.date||item.deadline.supplied_text,item.deadline.time,item.deadline.timezone].filter(Boolean).join(' · '):'Not supplied'}{item.deadline&&!item.deadline.timezone?' · timezone unconfirmed':''}</dd></div></dl>
    <details className={styles.evidence}><summary>Reason & evidence <span>＋</span></summary><p><strong>{item.status}:</strong> {item.blocker}</p>{item.changes.length?<p><strong>Changed:</strong> {item.changes.join(' · ')}</p>:null}<p>{item.explanation_source==='ai'?'Saved AI explanation, checked against unchanged evidence.':'Current workflow guidance from saved case records.'}</p>{item.evidence.map((e,i)=><blockquote key={i}><strong>{e.kind}: </strong>{e.text}</blockquote>)}</details>
    <Link className={`primary-button ${styles.continue}`} href={item.handoff.destination==='internal'?`/internal?case=${encodeURIComponent(item.request_id)}`:`/coordinator?request=${encodeURIComponent(item.request_id)}#briefing-handoff`}>{item.handoff.destination==='internal'?'Internal review':'Coordinator'} · {item.handoff.label}</Link>
   </li>;})}</ol>
   {!items.length?<div className={styles.empty}><strong>All clear in this view.</strong><p>Choose another filter to see the rest of your work.</p></div>:null}
   <footer className={styles.footer}><span>{data.saved_at?`AI briefing saved ${new Date(data.saved_at).toLocaleString()}`:'Analyze priorities to add an AI briefing.'}{data.changed_count>0?` · ${data.changed_count} cases have fresh changes.`:''}</span><span>Actions and approvals stay with you. Internal review is not rights clearance.</span></footer>
  </>:null}
 </section>;
}
