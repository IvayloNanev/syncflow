const sampleRequests = [
  {
    id: "R-204",
    client: "Northlight Studio · Track X",
    status: "Needs coordinator review",
    deadline: "Nov 6",
    blocker: "Project name missing",
    nextAction: "Review proposals",
  },
  {
    id: "R-207",
    client: "Harbor & Pine · Track Q",
    status: "Internal review pending",
    deadline: "Nov 8",
    blocker: "1 of 2 approvals",
    nextAction: "Record reviewer decision",
  },
  {
    id: "R-209",
    client: "Lumen Games · Track M",
    status: "Awaiting client information",
    deadline: "Nov 10",
    blocker: "Territory question",
    nextAction: "Wait for client reply",
  },
];

export default function Home() {
  return (
    <main className="workspace">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="SyncFlow home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          SyncFlow
        </a>
        <nav aria-label="Main navigation">
          <a className="active" href="#requests">
            Requests
          </a>
          <a href="#dashboard">Dashboard</a>
        </nav>
        <span className="environment">LOCAL PROTOTYPE</span>
      </header>

      <section className="intro" id="home">
        <div>
          <p className="eyebrow">COORDINATOR WORKSPACE</p>
          <h1>Keep every request moving.</h1>
          <p className="lede">
            Review client details, resolve blockers, and track internal handoffs
            in one place.
          </p>
        </div>
        <a className="primary-button" href="#requests">
          View requests <span aria-hidden="true">→</span>
        </a>
      </section>

      <section className="request-section" id="requests">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR WORK QUEUE</p>
            <h2>Active requests</h2>
          </div>
          <span className="count">{sampleRequests.length} requests</span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Request</th>
                <th scope="col">Status</th>
                <th scope="col">Deadline</th>
                <th scope="col">Blocker</th>
                <th scope="col">Next action</th>
              </tr>
            </thead>
            <tbody>
              {sampleRequests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <span className="request-id">{request.id}</span>
                    <span className="client-name">{request.client}</span>
                  </td>
                  <td>
                    <span className="status-pill">{request.status}</span>
                  </td>
                  <td>{request.deadline}</td>
                  <td>{request.blocker}</td>
                  <td className="next-action">{request.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="prototype-note">
          Fictional sample requests for the prototype. No client messages are
          sent from SyncFlow.
        </p>
      </section>

      <footer id="dashboard">
        Agents can propose changes; only a coordinator can confirm them.
      </footer>
    </main>
  );
}
