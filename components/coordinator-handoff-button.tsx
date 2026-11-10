'use client';
import {useRef,useState,type ReactNode} from 'react';
import {useRouter} from 'next/navigation';
import {transferToCoordinator} from './case-routing.js';
export default function CoordinatorHandoffButton({requestId,fingerprint,className,children}:{requestId:string;fingerprint?:string;className?:string;children:ReactNode}){
 const router=useRouter(),running=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 return <><button type="button" className={className} disabled={busy} onClick={async()=>{if(running.current)return;running.current=true;setBusy(true);setError('');try{const href=await transferToCoordinator(requestId,{fingerprint});router.push(href);}catch(e){setError(e instanceof Error?e.message:'Could not transfer this case.');}finally{running.current=false;setBusy(false);}}}>{busy?'Saving handoff…':children}</button>{error?<p role="alert">{error}</p>:null}</>;
}
