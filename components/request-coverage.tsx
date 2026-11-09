"use client";

import { useEffect, useRef, useState } from "react";
import { coverageRows } from '../catalog/coverage-view.js';
import { valueText, type ConfirmedFact, type FactProposal } from './fact-review';


function AnimatedCoverageBar({states,label}:{states:{key:string;state:string}[];label:string}) {
 const barRef=useRef<HTMLDivElement>(null);
 const [visible,setVisible]=useState(false);
 useEffect(()=>{
  const element=barRef.current;if(!element)return;
  const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{threshold:0.5});
  observer.observe(element);return()=>observer.disconnect();
 },[]);
 return <div ref={barRef} className={`coverage-bar coverage-animated${visible?' is-visible':''}`} role="img" aria-label={label}>
  {states.map((row,index)=><span key={row.key} className={`coverage-segment ${row.state}`} style={{animationDelay:`${index*90}ms`}}/>)}
 </div>;
}

export default function RequestCoverage({email, analyzed, stale, proposals, confirmed, issues, agentFields = []}: {
  email: string; analyzed: boolean; stale: boolean; proposals: FactProposal[]; confirmed: ConfirmedFact[];
  issues: {field_keys: string[]; question: string}[];
  agentFields?: {field_key:string;value:unknown;evidence:{message_id:string;exact_quote:string}[]}[];
}) {
  const [filter,setFilter]=useState<string|null>(null);
  const rows = coverageRows({email,analyzed,stale,proposals,confirmed,issues}).map(row=>{
    const automatic=analyzed&&!stale ? agentFields.find(f=>f.field_key===row.key) : undefined;
    const evidence=automatic?.evidence || (row.source==='confirmed' ? confirmed.find(f=>f.field_key===row.key)?.evidence : proposals.find(p=>p.field_key===row.key)?.evidence) || [];
    return {...row,...(automatic ? {value:automatic.value,source:'agent',hasProposal:false} : {}),evidence};
  });
  if (!rows.length) return <section className="coverage" aria-label="Email detail coverage"><p className="panel-note">Paste the client’s email to preview the recording and request details. Nothing is missing until there is a request to check.</p></section>;
  const provided = rows.filter(r => r.state === 'provided').length;
  const missing = rows.filter(r => r.state === 'missing').length;
  const attention = rows.filter(r => r.state === 'attention').length;
  return <section className="coverage" aria-label="Email detail coverage">
    <p className="panel-note">{stale ? 'Confirmed values are preserved below. Other excerpts are a conversation preview; recheck to assess the latest changes.' : analyzed ? 'Request details populated automatically. Review missing or conflicting information; source evidence is available below.' : 'Instant preview: detected excerpts only. Analyze to verify meaning and missing details.'}</p>
    <div className="coverage-totals" aria-label="Filter request details">{[{key:'provided',label:'Provided',count:provided},{key:'missing',label:analyzed&&!stale?'Missing':'Not detected',count:missing},{key:'attention',label:'Needs clarification',count:attention}].map(item=><button key={item.key} type="button" className={`coverage-filter coverage-filter-${item.key}`} aria-pressed={filter===item.key} onClick={()=>setFilter(filter===item.key?null:item.key)}><strong>{item.count}</strong><span>{item.label}</span></button>)}</div>
    {filter ? <div className="coverage-filter-note"><span role="status">Showing {filter==='provided'?'provided':filter==='missing'?'missing / not detected':'needs clarification'} details</span><button type="button" className="text-button" onClick={()=>setFilter(null)}>Show all</button></div> : null}
    <AnimatedCoverageBar key={`${analyzed}:${stale}:${rows.map(row=>row.state).join(',')}`} states={rows} label={`${provided} provided, ${missing} ${analyzed && !stale ? 'missing' : 'not detected'}, ${attention} need clarification, across 12 details`}/>

    <div className="coverage-list">{rows.filter(row=>!filter||row.state===filter).map(row => <article key={row.key} className={`coverage-row ${row.state}`}>
      <span className="coverage-icon" aria-hidden="true">{row.state === 'attention' ? '!' : row.source === 'confirmed' ? '✓' : row.state === 'missing' ? '−' : '✓'}</span>
      <div><div className="coverage-row-label"><h3>{row.label}</h3><span>{row.source === 'agent' ? 'Automatically recorded' : row.source === 'confirmed' ? 'Human-confirmed' : row.state === 'missing' ? analyzed && !stale ? 'Missing' : 'Not detected' : row.source === 'proposed' ? 'Extracted · needs attention' : 'Preview · not analyzed'}</span></div>
      <p>{row.value == null ? analyzed && !stale ? 'Not supplied — clarification needed' : 'Not detected in the email' : valueText(row.value)}</p>
      {row.source === 'confirmed' && row.hasProposal ? <p className="coverage-question">{row.changed ? 'Proposed change (not confirmed)' : 'New proposal (not yet reviewed)'}: {valueText(row.proposal)}. Review its source evidence before deciding.</p> : null}
      {row.evidence.length ? <details className="summary-evidence"><summary>Source evidence</summary>{row.evidence.map((e,i)=><blockquote key={i}>{e.exact_quote}<small>Message: {e.message_id}</small></blockquote>)}</details> : null}
      {row.questions.map((q,i) => <p className="coverage-question" key={i}>{q.question}</p>)}</div>
    </article>)}{filter&&!rows.some(row=>row.state===filter)?<p className="panel-note" role="status">No details in this category.</p>:null}</div>
  </section>;
}
