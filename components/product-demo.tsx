'use client';

import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import styles from '../app/demo/demo.module.css';

const steps=['Daily Brief','New Inquiries','Coordinator','Internal Review','Case history'];
const subject='Music licensing request · Harbor campaign';
const email=`Hello,

I’m Alex Taylor at Harbor Studio. We would like to license “Northern Lights” by Maya Rivers, original recording, for our Harbor campaign.

We need 30 seconds for a paid advertisement on YouTube and Instagram in Canada. The campaign will run for three months, starting December 1. We need both master recording and publishing rights.

Our budget has not been decided. Please respond by Friday at 5 PM, America/Toronto.

Thank you,
Alex Taylor
alex.taylor@example.invalid`;
const reply='Our budget is CAD 5,000 for both master recording and publishing rights. Please change the territory from Canada to worldwide. All other details remain unchanged.';
const managerDecision='Investigate worldwide availability. Verify both rights owners and ask whether the budget can increase if needed. Do not promise clearance or pricing.';
const initial={saved:false,analyzed:false,replied:false,escalated:false,decided:false,completed:false};

export default function ProductDemo(){
 const [step,setStep]=useState(0);
 const [caseState,setCaseState]=useState(initial);
 const [notice,setNotice]=useState('');
 const heading=useRef<HTMLHeadingElement>(null);
 const previousStep=useRef(step);
 const {saved,analyzed,replied,escalated,decided,completed}=caseState;
 useEffect(()=>{
  if(previousStep.current!==step){
   heading.current?.focus({preventScroll:true});
   heading.current?.scrollIntoView({block:'start'});
  }
  previousStep.current=step;
 },[step]);
 function go(next:number,message=''){setNotice(message);setStep(next);}
 function reset(){setCaseState(initial);go(0,'Demo reset. All sample changes have been cleared.');}
 const fields=[
  ['Client / contact','Alex Taylor · Harbor Studio'],['Project','Harbor campaign'],
  ['Artist','Maya Rivers'],['Song title','Northern Lights'],['Recording version','Original'],
  ['Intended use','30-second advertisement'],['Media / platforms','YouTube and Instagram'],
  ['Territory',replied?'Worldwide':'Canada'],['Campaign term','Three months, starting December 1'],
  ['Amount of music','30 seconds'],['Budget / currency / scope',replied?'CAD 5,000 · both rights':'Not supplied'],
  ['Response deadline','Friday, 5 PM · America/Toronto'],
 ];
 const followUp=replied
  ? 'Hello Alex,\n\nThank you for confirming CAD 5,000 for both rights and updating the territory to worldwide. We will check the recording and relevant rights information before confirming availability, fees or permission to use the music.\n\nBest regards'
  : 'Hello Alex,\n\nThank you for your request for “Northern Lights.” Could you confirm the budget amount and currency available for both master recording and publishing rights? An approximate figure is fine if the budget is still under discussion.\n\nBest regards';
 return <main id="demo-main" className={styles.main}>
  <div className={styles.intro}><div><p className={styles.eyebrow}>EXPLORE SYNCFLOW</p><h1>A licensing request, from start to review.</h1><p>Try the workflow with a fictional client. Sample results are prewritten; no live AI runs and nothing is sent or saved to a workspace.</p></div><button className={styles.outline} onClick={reset}>Restart demo</button></div>
  <nav className={styles.steps} aria-label="Demo steps">{steps.map((label,index)=><button key={label} onClick={()=>go(index)} aria-current={step===index?'step':undefined}><span>{String(index+1).padStart(2,'0')}</span>{label}</button>)}</nav>
  <div className={styles.status} role="status" aria-live="polite">{notice}</div>
  <section className={styles.workspace} aria-labelledby="demo-step-heading">
   <div className={styles.workspaceHeading}><div><p className={styles.eyebrow}>INTERACTIVE DEMO · STEP {step+1} OF {steps.length}</p><h2 id="demo-step-heading" ref={heading} tabIndex={-1}>{steps[step]}</h2></div><span className={styles.sample}>Fictional sample</span></div>

   {step===0?<>
    <p className={styles.lead}>See what needs attention before opening a case.</p>
    <div className={styles.metrics}><div><strong>3</strong><span>Open requests</span></div><div><strong>1</strong><span>Overdue</span></div><div><strong>1</strong><span>Due today</span></div></div>
    <ol className={styles.queue} aria-label="Sample priority queue">
     <li><div><span className={styles.urgent}>Overdue · 1 day</span><h3>City lights campaign</h3><p>Manager decision pending. Follow up on the recorded commitment.</p></div><span className={styles.owner}>Internal Review</span></li>
     <li><div><span className={styles.accent}>Due today</span><h3>Autumn film</h3><p>Client reply received. Review the changed music duration.</p></div><span className={styles.owner}>Coordinator</span></li>
     <li><div><span className={styles.accent}>Upcoming deadline</span><h3>Harbor campaign</h3><p>A new inquiry needs a brief and budget clarification.</p></div><button className={styles.gold} onClick={()=>go(1)}>Explore this request</button></li>
    </ol>
    <p className={styles.note}>Daily Brief keeps overdue cases first, then today, upcoming and undated cases. In your workspace, AI ranks cases within those groups. This is a sample queue.</p>
   </>:null}

   {step===1?<>
    <p className={styles.lead}>Received emails and pasted requests become cases in one place.</p>
    <div className={styles.panel}><h3>Client email</h3><label htmlFor="demo-subject">Subject</label><input id="demo-subject" value={subject} readOnly/><label htmlFor="demo-email">Body</label><textarea id="demo-email" value={email} readOnly rows={11}/><div className={styles.actions}><button className={styles.gold} onClick={()=>{setCaseState(s=>({...s,saved:true}));go(2,'Sample inquiry saved. Open the sample analysis to see the Coordinator’s work.');}}>{saved?'Open sample case':'Save sample as a case'}</button><span className={styles.note}>This uses the example above. No email or personal data is needed.</span></div></div>
   </>:null}

   {step===2?<>
    <p className={styles.lead}>The Coordinator turns correspondence into a source-backed brief and a draft you review.</p>
    {!saved?<div className={styles.panel}><h3>Start with the sample inquiry</h3><p>Save the fictional Harbor request to continue, or load it directly here.</p><button className={styles.gold} onClick={()=>setCaseState(s=>({...s,saved:true}))}>Load sample case</button></div>:null}
    {saved&&!analyzed?<div className={styles.panel}><p className={styles.eyebrow}>HARBOR CAMPAIGN</p><h3>Sample case ready for analysis</h3><p>In the real workspace, opening a case runs the agent when a current analysis is needed. Here, you can reveal a prepared example.</p><button className={styles.gold} onClick={()=>{setCaseState(s=>({...s,analyzed:true}));setNotice('Sample analysis ready: 11 details provided and 1 missing budget.');}}>Show sample analysis</button></div>:null}
    {analyzed?<>
     {decided?<aside className={styles.decision}><h3>Recorded manager decision</h3><p>{managerDecision}</p><span className={styles.note}>Synthetic decision · returned to Coordinator</span></aside>:null}
     <div className={styles.columns}>
      <article className={styles.panel}><h3>Email conversation</h3><details open><summary>Original client email</summary><p className={styles.message}>{email}</p></details>{replied?<details open><summary>Client reply</summary><p>{reply}</p></details>:null}<h3>Client response draft</h3><span className={styles.note}>Prewritten example · not sent</span><label htmlFor="demo-client-draft" className={styles.srOnly}>Sample client response draft</label><textarea id="demo-client-draft" readOnly value={followUp} rows={10}/>
       {!replied?<div className={styles.callout}><h4>Continue the conversation</h4><p>Try a client reply that supplies the budget and changes Canada to worldwide.</p><button className={styles.outline} onClick={()=>{setCaseState(s=>({...s,replied:true}));setNotice('Sample reply added. Territory is now worldwide and budget is CAD 5,000.');}}>Add sample client reply</button></div>:null}
      </article>
      <article className={styles.panel}><p className={styles.eyebrow}>REQUEST SUMMARY</p><h3>Client details &amp; missing information</h3><div className={styles.coverage}><span>{replied?'12':'11'} provided</span><span className={!replied?styles.urgent:undefined}>{replied?'0':'1'} missing</span></div><dl className={styles.facts}>{fields.map(([name,value])=><div key={name}><dt>{name}</dt><dd className={value==='Not supplied'?styles.urgent:undefined}>{value}</dd></div>)}</dl><details><summary>Source evidence</summary><blockquote>{replied?'“Please change the territory from Canada to worldwide.”':'“on YouTube and Instagram in Canada”'}</blockquote><p className={styles.note}>{replied?'Client reply':'Original email'} · exact sample excerpt</p></details><h4>Internal checks remain</h4><p>Verify recording identity, publishing ownership, the master rights contact and available audio assets.</p><p className={styles.note}>Complete request details do not grant rights clearance.</p></article>
     </div>
     {!decided?<div className={styles.panel}><h3>Request an internal decision</h3><p>Use the sample reply to explore a handoff about worldwide usage and the budget.</p><label htmlFor="demo-reason">Reason for review</label><textarea id="demo-reason" readOnly rows={2} value={replied?'The client expanded the territory to worldwide with CAD 5,000 for both rights.':'Add the sample client reply above to prepare this handoff.'}/><label htmlFor="demo-question">Decision needed</label><textarea id="demo-question" readOnly rows={2} value="Should we investigate worldwide availability within this budget or ask the client to narrow the territory?"/><button className={styles.gold} disabled={!replied} onClick={()=>{setCaseState(s=>({...s,escalated:true}));go(3,'Sample case handed to Internal Review with the full saved conversation.');}}>Send sample to Internal Review</button></div>:<div className={styles.actions}><button className={styles.gold} onClick={()=>{setCaseState(s=>({...s,completed:true}));go(4,'Sample case completed. Its correspondence and decisions remain available in case history.');}}>Mark sample as completed</button><p className={styles.note}>This completes the case workflow, not a music licence.</p></div>}
    </>:null}
   </>:null}

   {step===3?<>
    <p className={styles.lead}>Internal Review reads the saved correspondence and prepares the question for a manager.</p>
    {!escalated?<div className={styles.panel}><h3>Explore a prepared handoff</h3><p>The sample client has changed the territory to worldwide and confirmed CAD 5,000 for both rights.</p><button className={styles.gold} onClick={()=>setCaseState(s=>({...s,saved:true,analyzed:true,replied:true,escalated:true}))}>Load sample handoff</button></div>:<>
     <div className={styles.columns}><article className={styles.panel}><h3>Manager email</h3><p className={styles.note}>Prewritten example · not sent</p><label htmlFor="demo-manager-email">Draft</label><textarea id="demo-manager-email" rows={13} readOnly value={`Hello,\n\nPlease review Harbor campaign and advise on the next step.\n\nThe original email requested Canada. The client’s reply changes this to worldwide and confirms CAD 5,000 for both master recording and publishing rights.\n\nShould we investigate worldwide availability within this budget or ask the client to narrow the territory?\n\nRights ownership, contacts and available assets still need verification.\n\nThank you`}/></article><article className={styles.panel}><h3>Handoff context</h3><dl className={styles.facts}><div><dt>Case</dt><dd>Harbor campaign</dd></div><div><dt>Changed scope</dt><dd>Canada to worldwide</dd></div><div><dt>Budget</dt><dd>CAD 5,000 · both rights</dd></div><div><dt>Decision owner</dt><dd>Manager</dd></div></dl><details><summary>Saved correspondence</summary><h4>Original email</h4><p className={styles.message}>{email}</p><h4>Client reply</h4><p>{reply}</p><p className={styles.note}>Generated drafts are retained separately and labelled as unsent.</p></details><p className={styles.note}>The real agent reads the full saved history before preparing its recommendation.</p></article></div>
     <div className={styles.panel}><h3>{decided?'Manager decision recorded':'Record the manager’s decision'}</h3><p>This example uses a fictional manager reply. Preparing an email does not count as a decision.</p><label htmlFor="demo-manager-decision">Sample manager reply and conditions</label><textarea id="demo-manager-decision" rows={3} readOnly value={managerDecision}/>{!decided?<button className={styles.gold} onClick={()=>{setCaseState(s=>({...s,decided:true}));setNotice('Sample manager decision recorded. Return to Coordinator to continue.');}}>Record sample manager decision</button>:<button className={styles.gold} onClick={()=>go(2,'The sample manager’s conditions are now visible to Coordinator.')}>Return sample to Coordinator</button>}</div>
    </>}
   </>:null}

   {step===4?<>
    <p className={styles.lead}>Reopen a case with its source messages and decisions intact.</p>
    <div className={styles.panel}><div className={styles.caseHeading}><h3>Harbor campaign</h3><span className={styles.sample}>{completed?'Completed':'Demo in progress'}</span></div>{!saved?<p>Explore the sample inquiry to build this case’s history.</p>:<>
     <ol className={styles.timeline}><li><strong>Original client email</strong><p>Canada · three-month campaign · budget undecided</p></li>{analyzed?<li><strong>Coordinator analysis</strong><p>Structured brief and clarification draft · not sent</p></li>:null}{replied?<li><strong>Client reply</strong><p>Worldwide · CAD 5,000 for both rights</p></li>:null}{escalated?<li><strong>Internal Review handoff</strong><p>Manager email prepared · not sent</p></li>:null}{decided?<li><strong>Recorded manager decision</strong><p>{managerDecision}</p></li>:null}{completed?<li><strong>Case completed</strong><p>The record remains available in Completed cases.</p></li>:null}</ol>
     {completed?<button className={styles.outline} onClick={()=>{setCaseState(s=>({...s,completed:false}));go(2,'Sample case reopened. In your workspace, find reopened cases under Cases → Pending cases.');}}>Reopen sample case</button>:<button className={styles.outline} onClick={()=>go(decided?2:escalated?3:analyzed?2:1)}>Continue the sample workflow</button>}
    </>}</div><div className={styles.finish}><h3>Ready to try your own workspace?</h3><p>Sign in to work with saved cases and live agents.</p><Link className={styles.gold} href="/login?mode=signup">Create an account</Link><button className={styles.outline} onClick={reset}>Explore again</button></div>
   </>:null}
  </section>
 </main>;
}
