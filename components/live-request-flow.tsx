import Link from "next/link";
import styles from "./live-request-flow.module.css";

export default function LiveRequestFlow({hasEmail,saved,current,busy,error,issueCount,replyCount,draftReady,skipped}:{hasEmail:boolean;saved:boolean;current:boolean;busy:boolean;error:boolean;issueCount:number;replyCount:number;draftReady:boolean;skipped:boolean}) {
 const steps=[
  {title:'Client brief',href:'#client-brief',status:saved?'Saved source email':hasEmail?'Email entered · not saved':'Paste the client email',done:saved},
  {title:'Extracted details',href:'#request-record',status:current?'Source-backed details recorded':saved?'Analyze this saved request':'Populates after analysis',done:current},
  {title:'Checklist',href:'#request-checklist',status:current?(issueCount?`${issueCount} questions to resolve`:'No client checklist issues'):'Waiting for analysis',done:current&&!issueCount},
  {title:'Response draft',href:'#client-response',status:draftReady?'Ready to edit · not sent':current&&skipped?'No clarification email needed':'Generated from current questions',done:draftReady||current&&skipped},
  {title:'Client reply',href:saved?'#client-reply':'#client-brief',status:replyCount?`${replyCount} replies saved · add the next reply`:saved?'Paste reply and recheck':'Available after the request is saved',done:replyCount>0},
 ];
 return <section className={styles.flow} aria-label="Live request workflow" aria-busy={busy}><div className={styles.heading}><strong>Your request workflow</strong><span role="status">{busy?'Updating saved request…':error?'Action needs attention':current?'Current saved analysis':saved?'Analysis needed':'Start with the client email'}</span></div><nav aria-label="Request workflow steps">{steps.map((step,index)=><Link key={step.title} href={step.href} className={`${styles.step} ${step.done?styles.done:''}`}><span className={styles.number}>{step.done?'✓':`0${index+1}`}</span><span><strong>{step.title}</strong><small>{step.status}</small></span></Link>)}</nav></section>;
}
