"use client";
import {useState} from 'react';
export type Reviewer = {id:string;name:string;role:string;status:string;notes:string;reviewed_revision:number;recorded_by:string;recorded_at:string;needs_reconfirmation:boolean};
export type ReviewTracking = {version:number;reviewers:Reviewer[];history:(Reviewer & {operation:string})[]};
const statuses = ['Pending','Approved','Changes requested','Declined'];
function ReviewerCard({reviewer,busy,onSave}:{reviewer:Reviewer;busy:boolean;onSave:(input:Record<string,unknown>)=>void}) {
  const [status,setStatus]=useState(reviewer.status);
  const [notes,setNotes]=useState(reviewer.notes);
  return <article className="reviewer-card"><h3>{reviewer.name} <small>{reviewer.role}</small></h3>
    <p>{reviewer.status}{reviewer.needs_reconfirmation ? ' · Reconfirmation required: request changed' : ''}</p>
    <label htmlFor={`status-${reviewer.id}`}>Decision for {reviewer.name}</label><select id={`status-${reviewer.id}`} value={status} disabled={busy} onChange={e=>setStatus(e.target.value)}>{statuses.map(s=><option key={s}>{s}</option>)}</select>
    <label htmlFor={`notes-${reviewer.id}`}>Review notes for {reviewer.name}</label><textarea id={`notes-${reviewer.id}`} rows={3} maxLength={4000} disabled={busy} value={notes} onChange={e=>setNotes(e.target.value)} />
    <button className="secondary-button" type="button" disabled={busy} onClick={()=>onSave({operation:'decision',reviewer_id:reviewer.id,status,notes})}>{reviewer.needs_reconfirmation ? 'Record reconfirmed decision' : 'Record reviewer decision'}</button>
    <small>Recorded by {reviewer.recorded_by} · {reviewer.recorded_at} · request revision {reviewer.reviewed_revision}</small>
  </article>;
}
export default function ReviewerTracking({tracking,busy,onSave}:{tracking:ReviewTracking;busy:boolean;onSave:(input:Record<string,unknown>)=>Promise<boolean>}) {
  const [name,setName]=useState('');const [role,setRole]=useState('Director');
  const approved=tracking.reviewers.filter(r=>r.status==='Approved'&&!r.needs_reconfirmation).length;
  return <details className="handoff-panel"><summary>Internal reviewers · {approved} / {tracking.reviewers.length} current approvals</summary>
    <p>The coordinator records decisions received outside SyncFlow. Assigning a reviewer here does not notify them or grant access. Approval here is an internal decision, not music rights clearance.</p>
    <form onSubmit={async e=>{e.preventDefault();if(await onSave({operation:'assign',name,role}))setName('');}}><label htmlFor="reviewer-name">Reviewer name</label><input id="reviewer-name" required maxLength={200} value={name} disabled={busy} onChange={e=>setName(e.target.value)} /><label htmlFor="reviewer-role">Reviewer role</label><input id="reviewer-role" required maxLength={200} value={role} disabled={busy} onChange={e=>setRole(e.target.value)} /><button className="primary-button" disabled={busy||!name.trim()||!role.trim()}>Assign reviewer</button></form>
    {!tracking.reviewers.length ? <p>No reviewers assigned. This does not mean internal review is complete.</p> : tracking.reviewers.map(r=><ReviewerCard key={`${r.id}-${tracking.version}`} reviewer={r} busy={busy} onSave={input=>{void onSave(input);}} />)}
    <p className="panel-note">Any request revision change conservatively requires prior decisions to be reconfirmed. Re-analysis alone does not invalidate decisions.</p>
    {tracking.history.length ? <details><summary>Reviewer decision history ({tracking.history.length})</summary>{tracking.history.map((r,i)=><p key={i}>{r.name} · {r.operation} · {r.status} · revision {r.reviewed_revision} · recorded by {r.recorded_by} at {r.recorded_at}{r.notes ? ` · ${r.notes}` : ''}</p>)}</details> : null}
  </details>;
}
