'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import CoordinatorBriefing from './coordinator-briefing';
import styles from '../app/work/work.module.css';
export default function WorkToday(){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[elapsed,setElapsed]=useState(0);const running=useRef(false);
 useEffect(()=>{if(!busy)return;const timer=setInterval(()=>setElapsed(value=>value+1),1000);return()=>clearInterval(timer);},[busy]);
 async function analyze(){if(running.current)return;running.current=true;setBusy(true);setElapsed(0);setError('');try{const response=await fetch('/api/priority-review',{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(55000)});const result=await response.json();if(!response.ok)throw Error(result.error||'Priorities could not be analyzed.');}catch(e){setError(e instanceof Error?e.message:'Priorities could not be analyzed.');}finally{running.current=false;setBusy(false);}}
 return <main className={styles.main}><div className={styles.title}><div><h1>Today</h1><p>Review priorities, then continue the work in each case.</p></div><Link className='primary-button' href='/work/new'>+ New case</Link></div><CoordinatorBriefing busy={busy} error={error} elapsed={elapsed} onAnalyze={()=>void analyze()} caseWorkspace/></main>;
}
