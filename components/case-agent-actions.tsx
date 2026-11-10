'use client';
import {useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import {selectCaseAgent} from './case-routing.js';
import styles from './case-register.module.css';
export default function CaseAgentActions({requestId,fingerprint,destination}:{requestId:string;fingerprint:string;destination:string}){
 const router=useRouter(),running=useRef(false);
 const [busy,setBusy]=useState(''),[error,setError]=useState('');
 async function open(destination:'coordinator'|'internal'){
  if(running.current)return;running.current=true;setBusy(destination);setError('');
  try{const href=await selectCaseAgent(requestId,destination,{fingerprint});window.dispatchEvent(new Event('syncflow:case-updated'));router.push(href);}
  catch(failure){setError(failure instanceof Error?failure.message:'Could not open this agent.');}
  finally{running.current=false;setBusy('');}
 }
 return <div className={styles.agentActions} role="group" aria-label="Choose case agent"><p className={styles.currentAgent}>Current agent: {destination==='internal'?'Internal Review':'Coordinator'}</p><small>Choosing an agent assigns this case to them.</small><button type="button" className="primary-button" disabled={!!busy} onClick={()=>void open('coordinator')}>{busy==='coordinator'?'Opening…':'Go to Coordinator'}</button><button type="button" className="primary-button" disabled={!!busy} onClick={()=>void open('internal')}>{busy==='internal'?'Opening…':'Go to Internal Review'}</button>{error?<p role="alert">{error}</p>:null}</div>;
}
