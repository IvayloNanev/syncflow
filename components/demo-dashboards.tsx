'use client';

import {useEffect, useRef, useState} from 'react';
import briefing from './coordinator-briefing.module.css';
import register from './case-register.module.css';
import glass from './case-details-dialog.module.css';
import styles from '../app/demo/demo.module.css';

export type DemoCase = {
 id:string; project:string; client:string; company:string; track:string;
 owner:'Coordinator'|'Internal Review'; urgency:'overdue'|'today'|'upcoming'|'finished';
 status:string; deadline:string; reason:string; action:string; message:string;
 completed:boolean; deleted?:boolean;
};
export const sampleCases:DemoCase[] = [
 {id:'city',project:'City lights campaign',client:'Jordan Lee',company:'City Studio',track:'Glass Satellites',owner:'Internal Review',urgency:'overdue',status:'Internal review pending',deadline:'Overdue · yesterday, 5 PM · America/Toronto',reason:'The client commitment has passed while a manager decision is pending.',action:'Follow up with the manager and agree a revised response deadline.',message:'Please confirm whether worldwide use is possible. Our client response was due yesterday at 5 PM America/Toronto. We are waiting for your update.',completed:false},
 {id:'autumn',project:'Autumn film',client:'Sam Rivera',company:'River Films',track:'Paper Skies',owner:'Coordinator',urgency:'today',status:'Needs clarification',deadline:'Today, 5 PM · America/Toronto',reason:'The client changed the requested excerpt from 30 to 60 seconds.',action:'Review the revised duration and prepare a clarification response.',message:'Our Autumn film now needs 60 seconds of Paper Skies instead of 30. The Canada territory and three-month term are unchanged. Please respond today at 5 PM America/Toronto.',completed:false},
 {id:'harbor',project:'Harbor campaign',client:'Alex Taylor',company:'Harbor Studio',track:'Northern Lights',owner:'Coordinator',urgency:'upcoming',status:'Needs analysis',deadline:'Friday, 5 PM · America/Toronto',reason:'A new inquiry needs analysis and budget clarification.',action:'Open the case to review the client email and prepare a brief.',message:'We would like Northern Lights by Maya Rivers, original recording, for a 30-second paid advertisement on YouTube and Instagram in Canada. Three months from December 1. Both rights are needed. Our budget has not been decided.',completed:false},
 {id:'winter',project:'Winter campaign',client:'Casey Reed',company:'Cedar Agency',track:'Northern Lights',owner:'Coordinator',urgency:'finished',status:'Case completed',deadline:'Completed sample',reason:'The internal decision is recorded and the workflow is complete.',action:'Review the preserved correspondence or reopen the sample case.',message:'Thank you for the update on our Winter campaign. We have recorded the conditions and no further coordination is required at this stage.',completed:true},
];
const labels:Record<string,string>={all:'All open',action:'Your actions',blocked:'Blockers',waiting:'Waiting',finished:'Finished',changed:'Changed',overdue:'Overdue',today:'Due today'};
const matches=(c:DemoCase,filter:string)=>filter==='finished'?c.completed:!c.completed&&(filter==='all'||filter==='overdue'&&c.urgency==='overdue'||filter==='today'&&c.urgency==='today'||filter==='waiting'&&c.owner==='Internal Review'||filter==='action'&&c.owner==='Coordinator'||filter==='blocked'&&c.status==='Needs clarification'||filter==='changed'&&c.id==='autumn');

type Props={cases:DemoCase[];onOpen:(item:DemoCase)=>void;onAgent:(id:string,agent:'Coordinator'|'Internal Review')=>void};
export function DemoWorkspace({cases,onOpen,onAgent}:Props){
 const [filter,setFilter]=useState('all');
 const [query,setQuery]=useState('');
 const [client,setClient]=useState('');
 const [refreshed,setRefreshed]=useState(false);
 const visible=cases.filter(c=>!c.deleted);
 const queue=visible.filter(c=>matches(c,filter));
 const clients=visible.filter(c=>(!client||c.client===client)&&`${c.client} ${c.company} ${c.project} ${c.track}`.toLowerCase().includes(query.toLowerCase()));
 return <>
  <div className={styles.dashboardWelcome}><div><p className={styles.eyebrow}>YOUR WORKSPACE</p><h3>Welcome, visitor</h3><p>Generate your daily priorities report.</p></div><button className={styles.gold} onClick={()=>setRefreshed(true)}>✦ Refresh sample report</button></div>
  {refreshed?<p role="status" className={styles.note}>Sample report refreshed. In your workspace, this action runs Daily Brief against saved case evidence.</p>:null}
  <section className={briefing.dashboard} aria-label="Daily priorities report">
   <div className={briefing.metrics}>{[['all','Open requests','Across your workspace'],['overdue','Overdue','Time-sensitive follow-up'],['today','Due today','Keep these moving'],['waiting','Awaiting review','With your reviewers']].map(([value,label,note])=><button key={value} className={`${briefing.metric} ${briefing[value]||''}`} aria-pressed={filter===value} onClick={()=>setFilter(value)}><span>{label}</span><strong>{visible.filter(c=>matches(c,value)).length}</strong><small>{note}</small></button>)}</div>
   <div className={briefing.queueHeading}><div><p className={briefing.eyebrow}>PRIORITY QUEUE</p><h3>Your next moves</h3></div><span className={briefing.live}>Sample order · overdue first</span></div>
   <div className={briefing.filters} role="group" aria-label="Work queue">{['all','action','blocked','waiting','finished','changed'].map(value=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{labels[value]} <span>{visible.filter(c=>matches(c,value)).length}</span></button>)}</div>
   <ol className={briefing.queue}>{queue.map((c,index)=><li key={c.id} className={`${briefing.card} ${briefing[c.urgency==='overdue'?'urgent':c.urgency]} ${index===0&&filter==='all'?briefing.featured:''}`}><div className={briefing.cardTop}><span className={briefing.rank}>{index===0&&filter==='all'?'FIRST PRIORITY':`#${index+1}`}</span><span className={briefing.badge}>{c.completed?'Completed':c.urgency==='overdue'?'Overdue':c.urgency==='today'?'Due today':'Upcoming deadline'}</span></div><h3>{c.project}</h3><p className={briefing.client}>{c.client} ({c.company})</p><p className={briefing.reason}>{c.reason}</p><div className={briefing.next}><span>NEXT ACTION</span><p>{c.action}</p></div><dl className={briefing.meta}><div><dt>Responsible</dt><dd>{c.owner}</dd></div><div><dt>Deadline</dt><dd>{c.deadline}</dd></div></dl><details className={briefing.evidence}><summary>Reason &amp; evidence</summary><p>{c.status}</p><blockquote>{c.message}</blockquote></details><div className={styles.actions}><button className={styles.gold} onClick={()=>onAgent(c.id,c.owner)}>Go to {c.owner}</button><button className={styles.outline} onClick={()=>onOpen(c)}>Open details</button></div></li>)}</ol>
   {!queue.length?<p className={briefing.empty}>All clear in this view. Choose another filter.</p>:null}
  </section>
  <section aria-labelledby="demo-clients"><div className={styles.caseHeading}><div><p className={styles.eyebrow}>CLIENT DIRECTORY</p><h3 id="demo-clients">{client||'Clients'}</h3></div>{client?<button className={styles.outline} onClick={()=>setClient('')}>Back to clients</button>:null}</div><label className={styles.searchLabel} htmlFor="demo-client-search">Find a client or request<input id="demo-client-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Client, project or song"/></label><div className={styles.clientGrid}>{clients.map(c=><article className={styles.panel} key={c.id}><h3>{c.client}</h3><p>{c.company} · 1 request</p><p>{c.project} · {c.status}</p><p className={styles.note}>{c.completed?'Completed request':'1 open request'}</p>{client?<><p>{c.action}</p><div className={styles.actions}><button className={styles.gold} onClick={()=>onAgent(c.id,c.owner)}>Go to {c.owner}</button><button className={styles.outline} onClick={()=>onOpen(c)}>Conversation history</button></div></>:<button className={styles.outline} onClick={()=>setClient(c.client)}>Open client file</button>}</article>)}</div>{!clients.length?<p>No clients match your search.</p>:null}</section>
 </>;
}

export function DemoCaseRegister({cases,onOpen,onAgent,agent}:{agent?:'Coordinator'|'Internal Review'}&Props){
 const [filter,setFilter]=useState('pending');
 const [query,setQuery]=useState('');
 const available=cases.filter(c=>!c.deleted&&(!agent||c.owner===agent));
 const rows=available.filter(c=>(filter==='completed'?c.completed:!c.completed)&&`${c.project} ${c.client} ${c.track}`.toLowerCase().includes(query.toLowerCase()));
 return <div className={`${register.triagePage} ${styles.register}`}><div className={register.caseToolbar}><label htmlFor={`demo-search-${agent||'cases'}`}>Find a case<input id={`demo-search-${agent||'cases'}`} type="search" placeholder="Search client, project or song" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className={register.caseFilters} role="group" aria-label="Case status">{['pending','completed'].map(value=><button className={styles.gold} key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{value==='pending'?'Pending cases':'Completed cases'} <span>{available.filter(c=>value==='completed'?c.completed:!c.completed).length}</span></button>)}</div></div><div className={register.listHeading} aria-hidden="true"><span>Case</span><span>Client</span><span>Status</span><span>Response deadline</span><span/></div><ul className={register.caseRows}>{rows.map(c=><li key={c.id}><div className={register.caseName}><h2><button className={register.caseTitleButton} onClick={()=>onOpen(c)} aria-haspopup="dialog">{c.project}{c.completed?' ✓':''}</button></h2></div><p className={register.caseClient}>{c.client} ({c.company})</p><span className={register.caseCategory}>{c.status}</span><div className={register.caseDeadline}><span>Deadline</span><p>{c.deadline}</p></div><div className={styles.rowActions}><span>Agent: {c.owner}</span><button className={styles.gold} onClick={()=>onAgent(c.id,'Coordinator')}>Coordinator</button><button className={styles.gold} onClick={()=>onAgent(c.id,'Internal Review')}>Internal Review</button><button className={styles.outline} onClick={()=>onOpen(c)}>Open details</button></div></li>)}</ul>{!rows.length?<p>No cases match these filters.</p>:null}</div>;
}

export function DemoDetails({item,children,onDismiss}:{item:DemoCase;children?:React.ReactNode;onDismiss:()=>void}){
 const dialogRef=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=dialogRef.current;if(!dialog)return;const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;const overflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';return()=>{dialog.close();document.body.style.overflow=overflow;previousFocus?.focus({preventScroll:true});};},[]);
 return <dialog ref={dialogRef} className={`${glass.glass} ${styles.demoDialog}`} aria-labelledby="demo-case-title" onCancel={e=>{e.preventDefault();onDismiss();}}><header className={glass.header}><div><p>FICTIONAL CASE FILE</p><h2 id="demo-case-title">{item.project}</h2></div><button className={styles.outline} autoFocus onClick={onDismiss}>Hide details</button></header><div className={glass.content}><dl className={styles.facts}><div><dt>Client</dt><dd>{item.client} ({item.company})</dd></div><div><dt>Recording</dt><dd>{item.track}</dd></div><div><dt>Status</dt><dd>{item.status}</dd></div></dl><h3>Full correspondence</h3><article className={styles.panel}><h4>Original email</h4><p>{item.message}</p></article>{children}</div></dialog>;
}
