'use client';
import {useId,useState} from 'react';
import {useUnsavedGuard} from './use-unsaved-guard';
export default function InternalReviewRequest({busy,onSend}:{busy:boolean;onSend:(reason:string,question:string)=>Promise<boolean>}){
 const [reason,setReason]=useState(''),[question,setQuestion]=useState('');
 const panelId=useId();
 useUnsavedGuard(!!reason.trim()||!!question.trim());
 return <>
  <section className="result-panel internal-review-request" aria-label="Internal Review handoff">
   <form id={panelId} onSubmit={async event=>{
    event.preventDefault();
    if(busy||!reason.trim()||!question.trim())return;
    if(await onSend(reason,question)){setReason('');setQuestion('');}
   }}>
    <p id={`${panelId}-help`}>Enter the reason and decision needed, then send this case and its saved correspondence to Internal Review.</p>
    <label htmlFor={`${panelId}-reason`}>Reason for review</label>
    <textarea id={`${panelId}-reason`} rows={3} maxLength={2000} required disabled={busy} value={reason} onChange={event=>setReason(event.target.value)}/>
    <label htmlFor={`${panelId}-question`}>Decision needed</label>
    <textarea id={`${panelId}-question`} rows={3} maxLength={4000} required disabled={busy} value={question} onChange={event=>setQuestion(event.target.value)}/>
   </form>
  </section>
  <button type="submit" form={panelId} className="primary-button internal-review-submit" aria-describedby={`${panelId}-help`} disabled={busy||!reason.trim()||!question.trim()}>{busy?'Sending to Internal Review…':'Send to Internal Review'}</button>
 </>;
}
