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
 return <section className="coordinator-inbox" aria-labelledby="inbox-heading"><div className="inbox-title"><div><p className="eyebrow">INCOMING EMAIL</p><h2 id="inbox-heading">{requestId?'Email replies to this request':'Coordinator inbox'}</h2><p>{requestId?'Send the next client reply to this address to keep it in this case.':'Send a music-usage request from Gmail to SyncFlow. It will appear here as a new request.'}</p></div><span className="status-pill">{emails.length} received</span></div>
 {address?<><label htmlFor="forwarding-address">{requestId?'This request’s email address':'Your SyncFlow email address'}</label><div className="inbox-address"><input id="forwarding-address" readOnly value={address}/><button type="button" className="secondary-button" onClick={async()=>{try{await navigator.clipboard.writeText(address);setMessage('Address copied. Paste it into the To field in Gmail.');}catch{setMessage('Select and copy the address manually.');}}}>Copy address</button></div>{aliasPreview?<p role="status">Short address preview — receiving at this address starts after the next deployment.</p>:null}<p className="panel-note">{requestId?<>Send replies from <strong>{sender}</strong>. </>:<>New requests can come from any email address. </>}Plain-text emails only; attachments aren’t imported.</p></>:!error?<p role="status">Preparing your receiving address…</p>:null}
 {error?<p role="alert">{error} <button type="button" className="text-button" onClick={()=>setAttempt(n=>n+1)}>Retry</button></p>:null}
 <div className="inbox-messages" aria-label="Received emails">{emails.length?<ul>{emails.map(email=><li key={email.email_id}><div><strong>{email.subject||'Music-usage request'}</strong><span>{email.sender} · {new Date(email.received_at).toLocaleString()}</span></div><Link className="primary-button" href={`/coordinator?request=${encodeURIComponent(email.request_id)}`}>Open request</Link></li>)}</ul>:loaded?<p>No emails received yet. Send your first request to the address above. This inbox updates automatically.</p>:null}</div><p role="status">{message}</p></section>;
}
