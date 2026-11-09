'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
type IncomingEmail={email_id:string;request_id:string;subject:string;sender:string;received_at:string};
export default function EmailForwarding({requestId}:{requestId?:string}){
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
 return <section className="coordinator-inbox compact-inbox inbox-list-panel" aria-labelledby="inbox-heading">
 <div className="inbox-list-heading"><h2 id="inbox-heading">{requestId?'Email replies':'Coordinator inbox'} <span>{emails.length}</span></h2>
 <details className="inbox-address-settings"><summary>Inbox address</summary><div>
 {address?<><label htmlFor="forwarding-address">{requestId?'Reply address':'Receiving address'}</label><div className="inbox-address"><input id="forwarding-address" readOnly value={address}/><button type="button" className="secondary-button" onClick={async()=>{try{await navigator.clipboard.writeText(address);setMessage('Address copied.');}catch{setMessage('Select and copy the address manually.');}}}>Copy address</button></div>{requestId?<small>Send replies from {sender}.</small>:null}{aliasPreview?<small>Local preview address.</small>:null}</>:<p>Preparing address…</p>}
 {message?<p role="status">{message}</p>:null}</div></details></div>
 {error?<p role="alert">{error} <button type="button" className="text-button" onClick={()=>setAttempt(n=>n+1)}>Retry</button></p>:null}
 <div className="inbox-messages" aria-label="Received emails">{emails.length?<ul>{emails.map(email=><li key={email.email_id}><div><strong>{email.subject||'Music-usage request'}</strong><span>{email.sender} · {new Date(email.received_at).toLocaleString()}</span></div><Link className="primary-button" href={`/coordinator?request=${encodeURIComponent(email.request_id)}`}>Open request</Link></li>)}</ul>:loaded?<p>No {requestId?'replies':'emails'} yet.</p>:!error?<p role="status">Loading inbox…</p>:null}</div></section>;
}
