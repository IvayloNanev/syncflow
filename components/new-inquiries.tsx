'use client';
import {useEffect,useRef,useState} from 'react';
import {previewEmail} from '../catalog/email-preview.js';
import {confirmDiscard,useUnsavedGuard} from './use-unsaved-guard';
import {clearEditorBackup,readEditorBackup,writeEditorBackup} from './editor-backup';
import styles from './new-inquiries.module.css';
type Inquiry={email_id:string;subject:string;sender:string;body:string;received_at:string};
export default function NewInquiries(){
 const [emails,setEmails]=useState<Inquiry[]>([]),[body,setBody]=useState(''),[subject,setSubject]=useState(''),[selectedId,setSelectedId]=useState('');
 const [address,setAddress]=useState(''),[inboxError,setInboxError]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [loaded,setLoaded]=useState(false),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false);
 const [attempt,setAttempt]=useState(0);
 const serializedLength=body.length+(subject.trim()?subject.trim().length+11:0);
 const bodyLimit=20000-(subject.trim()?subject.trim().length+11:0);
 const confirmationRef=useRef<HTMLDialogElement>(null);
 const contentRef=useRef<HTMLTextAreaElement>(null),running=useRef(false),createKey=useRef<{body:string;key:string}|null>(null);
 useUnsavedGuard((!!body.trim()||!!subject.trim())&&!selectedId);

 useEffect(()=>{
  let stopped=false;
  const backup=readEditorBackup('new');
  Promise.resolve().then(()=>{if(!stopped&&typeof backup?.email==='string'){setBody(backup.email);setSubject(backup.subject||'');setSelectedId(backup.inquiry_id||'');if(backup.idempotency_key)createKey.current={body:backup.subject?`Subject: ${backup.subject.trim()}\n\n${backup.email}`:backup.email,key:backup.idempotency_key};}});
  return()=>{stopped=true;};
 },[]);
 useEffect(()=>{
  let stopped=false;const controller=new AbortController();let timer:ReturnType<typeof setTimeout>;
  async function check(){try{const res=await fetch('/api/forwarding',{cache:'no-store',signal:controller.signal});const data=await res.json();if(!res.ok)throw Error(data.error||'Incoming emails could not load.');if(!stopped){setEmails(data.emails||[]);setLoaded(true);setInboxError('');}}catch(failure){if(!stopped)setInboxError(failure instanceof Error?failure.message:'Incoming emails could not load.');}finally{if(!stopped)timer=setTimeout(check,5000);}}
  void fetch('/api/forwarding',{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:controller.signal}).then(async res=>{const data=await res.json();if(!res.ok)throw Error(data.error);if(!stopped)setAddress(data.address);}).catch(failure=>{if(!stopped)setInboxError(failure instanceof Error?failure.message:'Receiving address unavailable.');});
  void check();return()=>{stopped=true;controller.abort();clearTimeout(timer);};
 },[attempt]);
 function choose(inquiry:Inquiry){
  if(saving||!confirmDiscard(!selectedId&&(!!body.trim()||!!subject.trim())))return;
  const envelope=`From: ${inquiry.sender}\nSubject: ${inquiry.subject}\n`;
  const emailBody=inquiry.body.startsWith(envelope)?inquiry.body.slice(envelope.length).replace(/^\n/,''):inquiry.body;
  setSaved(false);setSelectedId(inquiry.email_id);setSubject(inquiry.subject);setBody(emailBody);setError('');setNotice('');writeEditorBackup('new',{subject:inquiry.subject,email:emailBody,inquiry_id:inquiry.email_id});contentRef.current?.focus();
 }
 function pasteNew(){if(saving||!confirmDiscard(!selectedId&&(!!body.trim()||!!subject.trim())))return;setSaved(false);setSelectedId('');setSubject('');setBody('');setNotice('');clearEditorBackup('new');contentRef.current?.focus();}
 async function save(){
  if(running.current||!body.trim())return;
  if(serializedLength>20000){setError('Shorten the subject or body before saving. Emails can contain up to 20,000 characters including the subject.');return;}
  running.current=true;setSaving(true);setError('');setNotice('');
  try{
   const email=subject.trim()?`Subject: ${subject.trim()}\n\n${body}`:body;
   const timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;
   if(!selectedId&&createKey.current?.body!==email)createKey.current={body:email,key:crypto.randomUUID()};
   if(!selectedId)writeEditorBackup('new',{subject,email:body,idempotency_key:createKey.current!.key});
   const payload=selectedId?{email_id:selectedId,timezone}:{action:'create',email,timezone,recording_id:previewEmail(email).match?.id??null,idempotency_key:createKey.current!.key};
   const res=await fetch(selectedId?'/api/inquiries':'/api/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
   const data=await res.json();if(!res.ok)throw Error(typeof data.error==='string'?data.error:data.error?.message||'Case could not be saved.');
   const id=selectedId?data.requestId:data.request?.id;if(typeof id!=='string')throw Error('Could not confirm the saved case. Retry to check it.');
   setSaved(true);confirmationRef.current?.showModal();clearEditorBackup('last-inquiry-case');clearEditorBackup('new');
   setEmails(items=>items.filter(item=>item.email_id!==selectedId));setSelectedId('');setSubject('');setBody('');createKey.current=null;setNotice('');window.dispatchEvent(new Event('syncflow:case-updated'));
  }catch(failure){setError(failure instanceof Error?failure.message:'Case could not be saved. Your email is retained.');}
  finally{running.current=false;setSaving(false);}
 }
 return <main className={styles.page}><header><h1>New Inquiries</h1><p>Review a received email or paste one below, then save it as a case.</p></header>
 <section className={styles.panel} aria-labelledby="inquiry-heading"><div className={styles.heading}><h2 id="inquiry-heading">Client email</h2>{address?<details className={styles.address}><summary>Receiving address</summary><input aria-label="Receiving address" readOnly value={address}/><button type="button" className="secondary-button" onClick={async()=>{try{await navigator.clipboard.writeText(address);setNotice('Address copied.');}catch{setNotice('Select and copy the receiving address.');}}}>Copy address</button></details>:null}</div>
 {inboxError?<p role="status">{inboxError} <button type="button" className="text-button" onClick={()=>setAttempt(n=>n+1)}>Retry</button></p>:null}
 {emails.length?<div className={styles.received} role="group" aria-label="Received inquiries">{emails.map(email=><button key={email.email_id} type="button" className="secondary-button" aria-pressed={selectedId===email.email_id} disabled={saving} onClick={()=>choose(email)}><strong>{email.subject||'No subject'}</strong><span>{email.sender} · {new Date(email.received_at).toLocaleString()}</span></button>)}</div>:!loaded&&!inboxError?<p role="status">Checking incoming emails…</p>:null}
 {selectedId?<div className={styles.selection}><p>Received email · original content preserved</p><button type="button" className="secondary-button" disabled={saving} onClick={pasteNew}>Paste another email</button></div>:null}
 <div className={styles.fields}><div className={styles.field}><label htmlFor="inquiry-subject">Subject (optional)</label><input className={styles.subject} id="inquiry-subject" type="text" maxLength={500} value={subject} readOnly={!!selectedId} disabled={saving} onChange={e=>{setSubject(e.target.value);setSaved(false);setNotice('');writeEditorBackup('new',{subject:e.target.value,email:body});}} placeholder="Email subject"/></div>
 <div className={styles.field}><label htmlFor="inquiry-email">Body</label><textarea className={styles.body} ref={contentRef} id="inquiry-email" rows={8} maxLength={bodyLimit} aria-describedby="inquiry-character-count" value={body} readOnly={!!selectedId} disabled={saving} onChange={e=>{setBody(e.target.value);setSaved(false);setNotice('');writeEditorBackup('new',{subject,email:e.target.value});}} placeholder="Paste the client’s email body here…"/>
 <p className={styles.characterCount} id="inquiry-character-count" role={serializedLength>20000?"alert":undefined}>{20000-serializedLength} characters remaining, including the subject.</p></div></div>
 {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
 {!saved?<div className={styles.actions}><button type="button" className="primary-button" disabled={saving||!body.trim()||serializedLength>20000} onClick={()=>void save()}>{saving?'Saving case…':'Save as a case'}</button></div>:null}
 </section><dialog ref={confirmationRef} className={styles.confirmation} aria-labelledby="case-saved-title"><div className={styles.confirmationMark} aria-hidden="true">✓</div><h2 id="case-saved-title">Inquiry is saved in Cases.</h2><button type="button" className="secondary-button" autoFocus onClick={()=>confirmationRef.current?.close()}>Dismiss</button></dialog></main>;
}
