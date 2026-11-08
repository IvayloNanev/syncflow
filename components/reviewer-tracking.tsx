"use client";
import {useEffect,useState} from 'react';
import {readEditorBackup,writeEditorBackup,clearEditorBackup} from './editor-backup';
export type Reviewer = {id:string;name:string;role:string;status:string;notes:string;reviewed_revision:number;recorded_by:string;recorded_at:string;needs_reconfirmation:boolean};
export type ReviewTracking = {version:number;reviewers:Reviewer[];history:(Reviewer & {operation:string})[]};
type Draft={status:string;notes:string;version:number};
type Editors={name:string;role:string;decisions:Record<string,Draft>};
const empty:Editors={name:'',role:'Director',decisions:{}};
const statuses = ['Pending','Approved','Changes requested','Declined'];
export default function ReviewerTracking({requestId,tracking,busy,onSave,onDirtyChange}:{requestId:string;tracking:ReviewTracking;busy:boolean;onSave:(input:Record<string,unknown>)=>Promise<boolean>;onDirtyChange:(dirty:boolean)=>void}) {
 const [editors,setEditors]=useState<Editors>(empty);
 const [recovered,setRecovered]=useState(false);
 const backupKey=`reviewers-${requestId}`;
 useEffect(()=>{let mounted=true;Promise.resolve().then(()=>{const raw=readEditorBackup(backupKey)?.editors;if(!raw)return;try{const value=JSON.parse(raw);if(mounted&&typeof value.name==='string'&&typeof value.role==='string'&&value.decisions&&typeof value.decisions==='object'){setEditors(value);setRecovered(true);}}catch{}});return()=>{mounted=false;};},[backupKey]);
 const dirty=!!editors.name.trim()||editors.role!=='Director'||Object.keys(editors.decisions).length>0;
 useEffect(()=>{onDirtyChange(dirty);return()=>onDirtyChange(false);},[dirty,onDirtyChange]);
 function edit(next:Editors){setEditors(next);if(!next.name&&next.role==='Director'&&!Object.keys(next.decisions).length)clearEditorBackup(backupKey);else writeEditorBackup(backupKey,{editors:JSON.stringify(next)});}
 function change(reviewer:Reviewer,patch:Partial<Draft>){edit({...editors,decisions:{...editors.decisions,[reviewer.id]:{...(editors.decisions[reviewer.id]??{status:reviewer.status,notes:reviewer.notes,version:tracking.version}),...patch}}});}
 const approved=tracking.reviewers.filter(r=>r.status==='Approved'&&!r.needs_reconfirmation).length;
 return <details className="handoff-panel" id="internal-reviewers" open><summary>Internal reviewers · {approved} / {tracking.reviewers.length} current approvals</summary>
  <p>The coordinator records decisions received outside SyncFlow. Assigning a reviewer does not notify them or grant access. Internal approval is not music rights clearance.</p>
  <p role="status">{dirty?'Unsaved reviewer edits · recovery copy kept in this tab.': 'Reviewer records saved.'}{recovered&&dirty?' Recovered your unfinished notes.':''}</p>
  <form onSubmit={async e=>{e.preventDefault();if(await onSave({operation:'assign',name:editors.name,role:editors.role}))edit({...editors,name:'',role:'Director'});}}>
   <label htmlFor="reviewer-name">Reviewer name</label><input id="reviewer-name" required maxLength={200} value={editors.name} disabled={busy} onChange={e=>edit({...editors,name:e.target.value})}/>
   <label htmlFor="reviewer-role">Reviewer role</label><input id="reviewer-role" required maxLength={200} value={editors.role} disabled={busy} onChange={e=>edit({...editors,role:e.target.value})}/>
   <button className="primary-button" disabled={busy||!editors.name.trim()||!editors.role.trim()}>Assign reviewer</button>
  </form>
  {!tracking.reviewers.length?<p>No reviewers assigned. Assign the person whose decision you need next.</p>:tracking.reviewers.map(reviewer=>{const draft=editors.decisions[reviewer.id];return <article className="reviewer-card" key={reviewer.id}><h3>{reviewer.name} <small>{reviewer.role}</small></h3>
   <p>{reviewer.status}{reviewer.needs_reconfirmation?' · Reconfirmation required: request changed':''}</p>
   {draft&&draft.version!==tracking.version?<p className="stale-banner">The reviewer record changed since these notes were started. Compare the saved decision before recording your edits.</p>:null}
   <label htmlFor={`status-${reviewer.id}`}>Decision for {reviewer.name}</label><select id={`status-${reviewer.id}`} value={draft?.status??reviewer.status} disabled={busy} onChange={e=>change(reviewer,{status:e.target.value})}>{statuses.map(s=><option key={s}>{s}</option>)}</select>
   <label htmlFor={`notes-${reviewer.id}`}>Review notes for {reviewer.name}</label><textarea id={`notes-${reviewer.id}`} rows={3} maxLength={4000} disabled={busy} value={draft?.notes??reviewer.notes} onChange={e=>change(reviewer,{notes:e.target.value})}/>
   <button className="secondary-button" type="button" disabled={busy} onClick={async()=>{if(await onSave({operation:'decision',reviewer_id:reviewer.id,status:draft?.status??reviewer.status,notes:draft?.notes??reviewer.notes})){const decisions={...editors.decisions};delete decisions[reviewer.id];edit({...editors,decisions});}}}>{reviewer.needs_reconfirmation?'Record reconfirmed decision':'Record reviewer decision'}</button>
   <small>Recorded by {reviewer.recorded_by} · {reviewer.recorded_at} · request revision {reviewer.reviewed_revision}</small>
  </article>;})}
  <p className="panel-note">A changed request or analysis requires prior decisions to be reconfirmed.</p>
  {!!tracking.history.length&&<details><summary>Reviewer decision history ({tracking.history.length})</summary>{tracking.history.map((r,i)=><p key={i}>{r.name} · {r.operation} · {r.status} · revision {r.reviewed_revision} · recorded by {r.recorded_by} at {r.recorded_at}{r.notes?` · ${r.notes}`:''}</p>)}</details>}
 </details>;
}
