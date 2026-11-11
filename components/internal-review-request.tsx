'use client';
import {useId,useState} from 'react';
import {useUnsavedGuard} from './use-unsaved-guard';
export default function InternalReviewRequest({busy,onSend}:{busy:boolean;onSend:(reason:string,question:string)=>Promise<boolean>}){
 const [reason,setReason]=useState(''),[question,setQuestion]=useState(''),[expanded,setExpanded]=useState(false);
 const panelId=useId();
 useUnsavedGuard(!!reason.trim()||!!question.trim());
 return <><button type="button" className="primary-button internal-review-toggle" aria-expanded={expanded} aria-controls={panelId} onClick={()=>setExpanded(value=>!value)}>Send to Internal Review</button>{expanded?<section id={panelId} className="result-panel internal-review-request"><form onSubmit={async event=>{event.preventDefault();if(busy||!reason.trim()||!question.trim())return;if(await onSend(reason,question)){setReason('');setQuestion('');}}}><p>Record why the case needs an internal decision and what the manager needs to decide.</p><label htmlFor={`${panelId}-reason`}>Reason for review</label><textarea id={`${panelId}-reason`} rows={3} maxLength={2000} required disabled={busy} value={reason} onChange={event=>setReason(event.target.value)}/><label htmlFor={`${panelId}-question`}>Decision needed</label><textarea id={`${panelId}-question`} rows={3} maxLength={4000} required disabled={busy} value={question} onChange={event=>setQuestion(event.target.value)}/><button type="submit" className="primary-button" disabled={busy||!reason.trim()||!question.trim()}>{busy?'Sending request…':'Send request'}</button></form></section>:null}</>;
}
