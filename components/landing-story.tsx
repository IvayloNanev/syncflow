"use client";

import { useEffect, useState } from "react";

const chapters = ["Client brief", "Intake extraction", "Checklist review", "Follow-up draft", "Client reply"];
const fields = [
  ["ARTIST", "Maya Rivers"], ["RECORDING", "Northern Lights · Instrumental"],
  ["USE", "Advertising campaign"], ["TERRITORY", "Canada"],
  ["TERM", "Six months"], ["BUDGET", "CAD $5,000 · scope unspecified"],
];

export default function LandingStory() {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setStep(current => (current + 1) % chapters.length), 3000);
    return () => window.clearInterval(timer);
  }, [playing]);

  return <section className="landing-story" aria-labelledby="story-title" data-step={step}>
    <div className="landing-story-toolbar"><div><p>THE WORKFLOW, IN MOTION</p><h2 id="story-title">Every detail has a source.</h2></div><button type="button" onClick={() => setPlaying(!playing)} aria-pressed={playing}>{playing ? "Pause walkthrough" : "Play walkthrough"}</button></div>
    <p className="landing-story-caption">Illustrative example · fictional data · no live agent calls or saved changes</p>
    <div className="landing-story-chapters" aria-label="Walkthrough steps">{chapters.map((chapter,index) => <button key={chapter} type="button" aria-current={step === index ? "step" : undefined} onClick={() => {setStep(index);setPlaying(false);}}><span>0{index+1}</span>{chapter}</button>)}</div>
    <div className="landing-story-grid">
      <article className="landing-story-card"><header><span className="landing-story-dots" aria-hidden="true">● ● ●</span><span>CLIENT MESSAGE / 01</span></header><div className="landing-story-body"><small>FROM ALEX · NORTHSTAR CREATIVE</small><p className="landing-story-email">Hi, we’d like <mark className={step>=1?"is-lit":""}>Northern Lights by Maya Rivers, instrumental</mark>, for an <mark className={step>=1?"is-lit blue":""}>advertising campaign</mark> in <mark className={step>=1?"is-lit pink":""}>Canada for six months</mark>. Our budget is <mark className={step>=1?"is-lit amber":""}>CAD $5,000</mark>.</p><p className="landing-story-source">Original message stays with the request. Highlighted details become proposals.</p></div></article>
      <article className={`landing-story-card ${step===1?"is-active":""}`}><header><span>REQUEST RECORD</span><span className="landing-story-tag">{step>=1?"Proposed facts":"Awaiting intake"}</span></header><dl>{fields.map(([label,value],index)=><div key={label} className={step>=1?"landing-story-field is-filled":"landing-story-field"} style={{animationDelay:`${index*80}ms`}}><dt>{label}</dt><dd>{step>=1?value:"—"}{step>=1&&<small>msg 1</small>}</dd></div>)}</dl><p className="landing-story-footnote">Proposed ≠ confirmed. A coordinator reviews the evidence.</p></article>
      <div className="landing-story-output"><article className={`landing-story-card ${step===2?"is-active":""}`}><header><span>CHECKLIST REVIEW</span><span>CODE VALIDATES</span></header><div className="landing-story-body">{step>=2?<><p className="landing-story-question">! Project name missing</p><p className="landing-story-question">! Media, music length and deadline missing</p><p className="landing-story-question">! Budget rights scope needs clarification</p></>:<p className="landing-story-placeholder">Waiting for extracted details…</p>}</div></article>
      <article className={`landing-story-card landing-story-draft ${step===3?"is-active":""}`}><header><span>FOLLOW-UP DRAFT</span><span className="landing-story-tag">NOT SENT</span></header><div className="landing-story-body">{step>=3?<p>Thanks, Alex. Could you share the project name, media platforms, length of music needed and response deadline? Does the CAD $5,000 budget cover master rights only or both rights?</p>:<p className="landing-story-placeholder">Questions appear after the checklist review.</p>}</div></article></div>
    </div>
    <div className={`landing-story-reply ${step===4?"is-visible":""}`}><span>REPLY / 02</span><p>{step===4?<>“Actually, worldwide; duration unchanged.” <strong>Propose a territory change. Keep six months. Reconfirm affected reviews.</strong></>:"A reply changes the request? Keep its history and review what changed."}</p></div>
    <p className="landing-story-status" aria-live="polite" aria-atomic="true">Step {step+1} of 5 · {chapters[step]} · Human confirmation required</p>
  </section>;
}
