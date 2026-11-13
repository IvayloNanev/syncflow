'use client';
import {useState} from 'react';
import styles from '../app/demo/demo.module.css';
export default function DemoSessionBanner({expiresAt}:{expiresAt:string}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function exit(){setBusy(true);setError('');try{const response=await fetch('/api/demo/session',{method:'DELETE'});if(!response.ok)throw Error();window.location.replace('/');}catch{setError('Could not exit the demo. Please retry.');setBusy(false);}}
 return <aside className={styles.liveBanner} aria-label="Guest demo session"><div><strong>Live AI demo</strong><span>Private guest workspace · fictional data · 12 model calls maximum · expires within 2 hours.</span><span className={styles.srOnly}>Session expires {expiresAt}.</span>{error?<p role="alert">{error}</p>:null}</div><button className={styles.outline} disabled={busy} onClick={()=>void exit()}>{busy?'Exiting…':'Exit demo'}</button></aside>;
}
