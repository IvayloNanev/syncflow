'use client';
import {useEffect,useRef} from 'react';
import CaseDetails from './case-details';
import styles from './case-details-dialog.module.css';
export default function CaseDetailsDialog({requestId,title,onDismiss,onDeleted}:{requestId:string;title:string;onDismiss:()=>void;onDeleted:()=>void}){
 const dialogRef=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const dialog=dialogRef.current;if(!dialog)return;
  const previousOverflow=document.body.style.overflow;
  const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
  dialog.showModal();document.body.style.overflow='hidden';
  return()=>{dialog.close();document.body.style.overflow=previousOverflow;previousFocus?.focus({preventScroll:true});};
 },[]);
 return <dialog ref={dialogRef} className={styles.glass} aria-labelledby="case-panel-title" onCancel={event=>{event.preventDefault();onDismiss();}} onClick={event=>{if(event.target===event.currentTarget){const bounds=event.currentTarget.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)onDismiss();}}}>
  <header className={styles.header}><div><p>CASE FILE</p><h2 id="case-panel-title">{title}</h2></div><button type="button" className="secondary-button" autoFocus onClick={onDismiss}>Hide details</button></header>
  <div className={styles.content}><CaseDetails requestId={requestId} showHideButton={false} onClose={onDismiss} onDeleted={onDeleted}/></div>
 </dialog>;
}
