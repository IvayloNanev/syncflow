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
 return <div className={styles.agentActions} role="group" aria-label="Choose case agent"><span className={styles.currentAgent}>Agent: {destination==='internal'?'Internal Review':'Coordinator'}</span><button type="button" className="primary-button" aria-label="Go to Coordinator" title="Assign this case to Coordinator and open it" disabled={!!busy} onClick={()=>void open('coordinator')}>{busy==='coordinator'?'Opening…':'Coordinator'}</button><button type="button" className="primary-button" aria-label="Go to Internal Review" title="Assign this case to Internal Review and open it" disabled={!!busy} onClick={()=>void open('internal')}>{busy==='internal'?'Opening…':'Internal Review'}</button>{error?<p role="alert">{error}</p>:null}</div>;
}
