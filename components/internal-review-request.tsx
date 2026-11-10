'use client';
import {useState} from 'react';
import {useUnsavedGuard} from './use-unsaved-guard';
export default function InternalReviewRequest({busy,onSend}:{busy:boolean;onSend:(reason:string,question:string)=>Promise<boolean>}){
 const [reason,setReason]=useState(''),[question,setQuestion]=useState('');
 useUnsavedGuard(!!reason.trim()||!!question.trim());
 return <details className="result-panel internal-review-request"><summary>Send to Internal Review</summary><form onSubmit={async event=>{event.preventDefault();if(busy||!reason.trim()||!question.trim())return;if(await onSend(reason,question)){setReason('');setQuestion('');}}}><p>Record why the case needs an internal decision and what the manager needs to decide.</p><label htmlFor="internal-review-reason">Reason for review</label><textarea id="internal-review-reason" rows={3} maxLength={2000} required disabled={busy} value={reason} onChange={event=>setReason(event.target.value)}/><label htmlFor="internal-review-question">Decision needed</label><textarea id="internal-review-question" rows={3} maxLength={4000} required disabled={busy} value={question} onChange={event=>setQuestion(event.target.value)}/><button type="submit" className="primary-button" disabled={busy||!reason.trim()||!question.trim()}>{busy?'Sending request…':'Send request'}</button></form></details>;
}
