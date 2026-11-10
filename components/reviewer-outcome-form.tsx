'use client';
import {useState} from 'react';
export default function ReviewerOutcomeForm({name,busy,onSave}:{name:string;busy:boolean;onSave:(status:string,notes:string)=>Promise<void>}){
 const [status,setStatus]=useState('Approved'),[notes,setNotes]=useState('');
 return <form onSubmit={e=>{e.preventDefault();void onSave(status,notes);}} style={{display:'grid',gap:12,marginTop:16,paddingTop:16,borderTop:'1px solid #ddc18430'}}><strong>{name}</strong><label>Received decision<select value={status} disabled={busy} onChange={e=>setStatus(e.target.value)}><option>Approved</option><option>Changes requested</option><option>Declined</option><option>Pending</option></select></label><label>Reply or decision notes<textarea rows={3} required value={notes} disabled={busy} onChange={e=>setNotes(e.target.value)}/></label><button type="submit" className="secondary-button" disabled={busy||!notes.trim()}>Save reviewer outcome</button></form>;
}
