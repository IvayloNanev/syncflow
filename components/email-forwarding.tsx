'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
type IncomingEmail={email_id:string;request_id:string;subject:string;sender:string;received_at:string};
export default function EmailForwarding({requestId,caseWorkspace=false}:{requestId?:string;caseWorkspace?:boolean}){
 const [deleting,setDeleting]=useState<string|null>(null);
 const [minimized,setMinimized]=useState(false);
 const [address,setAddress]=useState(''),[sender,setSender]=useState(''),[message,setMessage]=useState(''),[error,setError]=useState(''),[emails,setEmails]=useState<IncomingEmail[]>([]),[aliasPreview,setAliasPreview]=useState(false),[loaded,setLoaded]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let stopped=false;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function check(){try{
   const response=await fetch('/api/forwarding'+(requestId?'?request_id='+encodeURIComponent(requestId):''),{cache:'no-store',signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error);
   if(!stopped){setEmails(data.emails);setLoaded(true);setError('');}
  }catch(failure){if(!stopped)setError(failure instanceof Error?failure.message:'Unable to check incoming emails. Retrying…');}finally{if(!stopped)timer=setTimeout(check,5000);}}
  async function start(){try{const response=await fetch('/api/forwarding',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({request_id:requestId}),signal:controller.signal});const data=await response.json();if(!response.ok)throw Error(data.error);if(!stopped){setAddress(data.address);setSender(data.sender);setAliasPreview(data.aliasPreview===true);}await check();}catch(failure){if(!stopped)setError(failure instanceof Error?failure.message:'Unable to prepare receiving address.');}}
  void start();return()=>{stopped=true;controller.abort();clearTimeout(timer);};
 },[requestId,attempt]);
 async function deleteRequest(email:IncomingEmail){
  if(deleting||!window.confirm('Move this request to Deleted requests? Its emails and analysis history can be restored.'))return;
  setDeleting(email.request_id);setError('');
  try{
   const command=async(payload:unknown)=>{const response=await fetch('/api/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const data=await response.json();if(!response.ok)throw Error(data.error?.message||'Unable to delete request.');return data;};
   const current=await command({action:'get',request_id:email.request_id});
   await command({action:'set_deleted',request_id:email.request_id,expected_revision:current.request.revision,deleted:true,idempotency_key:crypto.randomUUID()});
   setEmails(items=>items.filter(item=>item.request_id!==email.request_id));setMessage('Request moved to Deleted requests.');
  }catch(failure){setError(failure instanceof Error?failure.message:'Unable to delete request.');}finally{setDeleting(null);}
 }
 return <section className="coordinator-inbox compact-inbox inbox-list-panel" aria-labelledby="inbox-heading">
 <div className="inbox-list-heading"><div className="inbox-identity"><h2 id="inbox-heading">{requestId?'Email replies':caseWorkspace?'Received emails':'Coordinator inbox'} <span>{emails.length}</span></h2>{address?<span className="inbox-visible-address">{address}</span>:null}</div>
 <button type="button" className="secondary-button inbox-toggle" aria-label={minimized?"Expand inbox":"Minimize inbox"} title={minimized?"Expand inbox":"Minimize inbox"} aria-expanded={!minimized} aria-controls="inbox-content" onClick={()=>setMinimized(value=>!value)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={minimized?"m6 9 6 6 6-6":"m6 15 6-6 6 6"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div>
 <div id="inbox-content" hidden={minimized}><details className="inbox-address-settings"><summary>Inbox address</summary><div>
 {address?<><label htmlFor="forwarding-address">{requestId?'Reply address':'Receiving address'}</label><div className="inbox-address"><input id="forwarding-address" readOnly value={address}/><button type="button" className="secondary-button" onClick={async()=>{try{await navigator.clipboard.writeText(address);setMessage('Address copied.');}catch{setMessage('Select and copy the address manually.');}}}>Copy address</button></div>{requestId?<small>Send replies from {sender}.</small>:null}{aliasPreview?<small>Local preview address.</small>:null}</>:<p>Preparing address…</p>}
 {message?<p role="status">{message}</p>:null}</div></details>
 {error?<p role="alert">{error} <button type="button" className="text-button" onClick={()=>setAttempt(n=>n+1)}>Retry</button></p>:null}
 <div className="inbox-messages" aria-label="Received emails">{emails.length?<ul>{emails.map(email=><li key={email.email_id}><div><strong>{email.subject||'Music-usage request'}</strong><span>{email.sender} · {new Date(email.received_at).toLocaleString()}</span></div><div className="inbox-message-actions"><Link className="primary-button" href={caseWorkspace?`/work/cases/${encodeURIComponent(email.request_id)}`:`/coordinator?request=${encodeURIComponent(email.request_id)}`}>Open request</Link><button type="button" className="secondary-button request-delete" disabled={!!deleting} onClick={()=>void deleteRequest(email)} aria-label={`Delete request: ${email.subject||'Music-usage request'}`}>{deleting===email.request_id?'Deleting…':'Delete'}</button></div></li>)}</ul>:loaded?<p>No {requestId?'replies':'emails'} yet.</p>:!error?<p role="status">Loading inbox…</p>:null}</div></div></section>;
}
