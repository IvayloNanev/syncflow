import AnalysisWorkspace from "../components/analysis-workspace";

export default function Home() {
  return <main className="workspace">
    <header className="topbar">
      <a className="brand" href="#home" aria-label="SyncFlow home"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>SyncFlow</a>
      <nav aria-label="Main navigation"><a className="active" href="#analyze">Analyze a request</a></nav>
      <span className="environment">LOCAL PROTOTYPE</span>
    </header>
    <section className="intro" id="home"><div><p className="eyebrow">COORDINATOR WORKSPACE</p><h1>A clear next step<br />for every request.</h1><p className="lede">Turn a client email into proposed facts, open questions, and a draft you can review.</p></div></section>
    <AnalysisWorkspace />
    <footer>Agents propose. You review. Requests are saved locally on this computer. Human fact confirmation, shared access and approvals remain unfinished.</footer>
  </main>;
}
