import Link from "next/link";

const steps = [
  { number: "01", role: "CLIENT", title: "Start with the request.", text: "A song, a project, an idea. The client shares what they know about the intended music use." },
  { number: "02", role: "AGENTS + COORDINATOR", title: "Make the gaps visible.", text: "Agents organize the brief and suggest follow-up questions. The coordinator checks the recording and confirms the facts." },
  { number: "03", role: "COORDINATOR", title: "Move the conversation forward.", text: "Keep replies, confirmed details and internal review together, with a clear next action for the request." },
];

export default function Home() {
  return (
    <div className="portal-shell project-landing">
      <a className="project-skip" href="#project-main">Skip to project overview</a>
      <header className="portal-nav">
        <Link className="portal-brand" href="/" aria-label="SyncFlow home">syncflow<span>.</span></Link>
        <nav aria-label="Project navigation"><a href="#how-it-works">How it works</a><a href="#the-project">The project</a></nav>
        <span className="project-nav-label">MUSIC LICENSING, IN SYNC</span>
      </header>
      <main id="project-main">
        <section className="project-hero" aria-labelledby="project-title">
          <div className="project-hero-copy">
            <p className="portal-eyebrow">A CLEARER WORKFLOW FOR MUSIC REQUESTS</p>
            <h1 id="project-title">Less chasing.<br />More <em>in sync.</em></h1>
            <p className="project-lead">From the first music request to the next clear step. SyncFlow helps clients and sync coordinators keep the details, questions and decisions together.</p>
            <a className="portal-primary" href="#how-it-works">Explore the workflow <span aria-hidden="true">↓</span></a>
            <p className="project-byline">Built by Ivaylo Nanev &amp; Mosiah James</p>
          </div>
          <figure className="project-illustration" aria-label="Illustrative workflow: client brief, agent-assisted checks, then coordinator review">
            <div className="project-record" aria-hidden="true"><span>SF</span></div>
            <figcaption>ONE REQUEST. A CONNECTED CONVERSATION.</figcaption>
            <div className="project-example-card"><span className="project-step-dot">01</span><div><small>THE CLIENT BRIEF</small><strong>“We’d like to use this song…”</strong><p>Recording · campaign · Canada · six months</p></div></div>
            <div className="project-flow-line" aria-hidden="true">↓</div>
            <div className="project-example-card"><span className="project-step-dot">02</span><div><small>AGENT-ASSISTED CHECKS</small><strong>What’s here. What’s missing.</strong><p>Organize the details and prepare questions.</p></div></div>
            <div className="project-flow-line" aria-hidden="true">↓</div>
            <div className="project-example-card project-example-review"><span className="project-step-dot">03</span><div><small>HUMAN REVIEW</small><strong>A clear next step.</strong><p>The coordinator verifies and decides.</p></div></div>
            <p className="project-illustration-note">Illustrative workflow · no licensing decision is automated</p>
          </figure>
        </section>

        <section className="project-problem" id="the-project" aria-labelledby="problem-title">
          <div><p className="portal-eyebrow">THE PROBLEM WE’RE BUILDING FOR</p><h2 id="problem-title">The music is exciting.<br />The admin can get tangled.</h2></div>
          <div><p>A licensing request can arrive with a song title and a few lines about a campaign. The coordinator still needs to identify the right recording, clarify the intended use and keep track of the conversation before internal review.</p><p>SyncFlow brings that work into one place, so the next question and the reason behind it are easier to see.</p></div>
        </section>

        <section className="project-workflow" id="how-it-works" aria-labelledby="workflow-title">
          <div className="project-section-heading"><p className="portal-eyebrow">HOW IT WORKS</p><h2 id="workflow-title">From scattered details<br />to a shared next step.</h2></div>
          <div className="portal-path">{steps.map((step) => <article key={step.number}><div className="project-step-heading"><span>{step.number}</span><small>{step.role}</small></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
        </section>

        <section className="project-spaces" aria-labelledby="spaces-title">
          <div className="project-section-heading"><p className="portal-eyebrow">TWO SIDES. ONE WORKFLOW.</p><h2 id="spaces-title">A place for each person.</h2></div>
          <div className="project-space-grid">
            <article><span className="project-space-label">FOR CLIENTS</span><h3>Share the idea.</h3><p>Start a music-use request with the information you have. The current customer page submits it for coordinator review.</p><Link className="project-text-link" href="/customer">Explore the customer page <span aria-hidden="true">↗</span></Link></article>
            <article><span className="project-space-label">FOR COORDINATORS</span><h3>Keep the details moving.</h3><p>Review agent suggestions, confirm source-backed facts, draft a response and track internal review in the workspace.</p><Link className="project-text-link" href="/internal">Explore the internal workspace <span aria-hidden="true">↗</span></Link></article>
          </div>
        </section>
        <aside className="project-boundary"><strong>Assistance with the process. People own the decisions.</strong><p>SyncFlow supports intake, clarification and review. It does not grant music licenses, confirm rights clearance or automate contracts, invoices and payments.</p></aside>
      </main>
      <footer className="project-footer"><Link className="portal-brand" href="/">syncflow<span>.</span></Link><p>Local development preview · Fictional recording catalog<br />Private customer accounts and secure replies are not connected yet.</p><a href="#project-title">Back to top ↑</a></footer>
    </div>
  );
}
