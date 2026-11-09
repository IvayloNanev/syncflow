'use client';
import {transferToCoordinator} from './case-routing.js';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
export default function CompleteCaseButton({requestId,revision,completed=false,disabled=false,beforeComplete}:{requestId:string;revision:number;completed?:boolean;disabled?:boolean;beforeComplete?:()=>Promise<void>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 return <div style={{marginTop:24}}><button type="button" className="secondary-button" disabled={busy||disabled} onClick={async()=>{if(busy||disabled)return;setBusy(true);setError('');try{await beforeComplete?.();const res=await fetch('/api/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'set_completed',request_id:requestId,expected_revision:revision,completed:!completed,idempotency_key:crypto.randomUUID()})});const value=await res.json();if(!res.ok)throw Error(value.error?.message||'Could not update this case.');router.push(completed?await transferToCoordinator(requestId):'/completed-cases');router.refresh();}catch(e){setError(e instanceof Error?e.message:'Could not update case.');}finally{setBusy(false);}}}>{busy?'Saving…':completed?'Reopen case':'Mark as completed'}</button>{error?<p role="alert">{error}</p>:null}</div>;
}
