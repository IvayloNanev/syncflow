import Link from "next/link";
import {loginDestination} from "../lib/auth-destination.js";
import {sessionClient,sharedConfigured} from "../lib/supabase/server";

export const dynamic='force-dynamic';

const steps = [
  { number: "01", role: "CLIENT", title: "Start with the request.", text: "A song, a project, an idea. The client shares what they know about the intended music use." },
  { number: "02", role: "AGENTS + COORDINATOR", title: "Make the gaps visible.", text: "Agents organize the brief and suggest follow-up questions. The coordinator reviews recording matches and exceptions." },
  { number: "03", role: "COORDINATOR", title: "Move the conversation forward.", text: "Keep replies, confirmed details and internal review together, with a clear next action for the request." },
];

export default async function Home() {
  const user=sharedConfigured()?(await (await sessionClient()).auth.getUser()).data.user:null;
  return (
    <div className="portal-shell project-landing project-electric">
      <a className="project-skip" href="#project-main">Skip to project overview</a>
      <header className="portal-nav">
        <Link className="portal-brand" href="/" aria-label="SyncFlow home">Sync<span>Flow</span><sup>↗</sup></Link>
        <nav className="page-navigation" aria-label="Project navigation"><a href="#the-project">The project</a><a href="#how-it-works">How it works</a></nav>
        <Link className="portal-primary landing-signin" href={user?"/dashboard":"/login"}>{user?"Open workspace":"Sign in"} <span aria-hidden="true">↗</span></Link>
      </header>
      <main id="project-main">
        <section className="project-hero" aria-labelledby="project-title">
          <div className="project-hero-copy">
            <p className="portal-eyebrow"><span className="project-live-dot" aria-hidden="true" /> THE SYNC &amp; LICENSING WORKSPACE</p>
            <h1 id="project-title">Sync<span>Flow</span><sup>↗</sup></h1>
            <p className="project-byline">A PROJECT BY IVAYLO NANEV &amp; MOSIAH JAMES</p>
          </div>
          <div className="project-hero-message">
            <span className="project-pill">LESS ADMIN. MORE MOMENTUM.</span>
            <h2>Great music.<br /><mark>Clear next steps.</mark></h2>
            <p className="project-lead">Turn a music-use request into an organized brief, the right questions and a conversation that keeps moving.</p>
            <div className="landing-entry-actions"><Link className="portal-primary" href={user?"/dashboard":loginDestination('/dashboard')}>{user?"Open workspace":"Sign in to SyncFlow"} <span aria-hidden="true">↗</span></Link><a className="project-text-link" href="#how-it-works">See the flow <span aria-hidden="true">↓</span></a></div>
          </div>
        </section>

        <section className="project-problem" id="the-project" aria-labelledby="problem-title">
          <div><p className="portal-eyebrow">THE PROBLEM WE’RE BUILDING FOR</p><h2 id="problem-title">The music is exciting.<br /><mark>The admin gets tangled.</mark></h2></div>
          <div><p>A licensing request can arrive with a song title and a few lines about a campaign. The coordinator still needs to identify the right recording, clarify the intended use and keep track of the conversation before internal review.</p><p>SyncFlow brings that work into one place, so the next question and the reason behind it are easier to see.</p></div>
        </section>

        <section className="project-workflow" id="how-it-works" aria-labelledby="workflow-title">
          <div className="project-section-heading"><p className="portal-eyebrow">HOW IT WORKS</p><h2 id="workflow-title">One request.<br /><mark>A connected workflow.</mark></h2></div>
          <div className="portal-path">{steps.map((step) => <article key={step.number}><div className="project-step-heading"><span>{step.number}</span><small>{step.role}</small></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
        </section>

        <section className="project-spaces" aria-labelledby="spaces-title">
          <div className="project-section-heading"><p className="portal-eyebrow">TWO SIDES. ONE WORKFLOW.</p><h2 id="spaces-title">A place for each person.</h2></div>
          <div className="project-space-grid">
            <article><span className="project-space-label">FOR COORDINATORS</span><h3>Start with the email.</h3><p>Paste the client email, inspect the music catalog, review missing details and prepare the client response.</p><Link className="project-text-link" href={user?"/coordinator":loginDestination("/coordinator")}>Open coordinator page <span aria-hidden="true">↗</span></Link></article>
            <article><span className="project-space-label">FOR INTERNAL REVIEW</span><h3>Prepare the handoff.</h3><p>Prepare summaries for the label team and record reviewer decisions, notes and reconfirmations.</p><Link className="project-text-link" href={user?"/internal":loginDestination("/internal")}>Open internal review <span aria-hidden="true">↗</span></Link></article>
          </div>
        </section>
        <aside className="project-boundary"><strong>Assistance with the process. People own the decisions.</strong><p>SyncFlow supports intake, clarification and review. It does not grant music licenses, confirm rights clearance or automate contracts, invoices and payments.</p></aside>
      </main>
      <footer className="project-footer"><Link className="portal-brand" href="/">Sync<span>Flow</span></Link><p>Music licensing workspace · Fictional recording catalog<br />Handoffs and decisions are recorded by the coordinator. Nothing sends automatically.</p><a href="#project-title">Back to top ↑</a></footer>
    </div>
  );
}
