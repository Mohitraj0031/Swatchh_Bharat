import { useEffect, useState } from 'react';

// Label text for each cleanliness status
const LABEL = { clean: 'Clean', attention: 'Needs Attention', not_clean: 'Not Clean' };
const ISSUES = ['Garbage pile', 'Overflowing dustbin', 'Open drain', 'Littering', 'Other'];

export default function App() {
  // ---------- State (data the page remembers) ----------
  const [areas, setAreas] = useState([]);
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({ area: '', issueType: ISSUES[0], description: '', reporter: '' });
  const [search, setSearch] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [msg, setMsg] = useState('');

  // ---------- Load data from the backend ----------
  const load = async () => {
    setAreas(await (await fetch('/api/areas')).json());
    setReports(await (await fetch('/api/reports')).json());
  };
  useEffect(() => { load(); }, []); // runs once when the page opens

  // ---------- Citizen submits a complaint ----------
  const submit = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    });
    const data = await res.json();
    // The last 6 characters of the database id act as the tracking ID
    setMsg(res.ok ? `Thank you! Your complaint ID is ${data._id.slice(-6).toUpperCase()}` : data.error);
    if (res.ok) { setForm({ ...form, description: '' }); load(); }
  };

  // ---------- Admin changes complaint status ----------
  const updateStatus = async (id, status) => {
    const res = await fetch(`/api/reports/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return setMsg('Wrong admin key');
    load();
  };

  // ---------- Numbers for the dashboard ----------
  const count = (s) => areas.filter((a) => a.status === s).length;
  const shown = reports.filter((r) =>
    (r._id.slice(-6) + r.area?.name).toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <header><h1>🧹 Swachh Bharat Cleanliness Tracker</h1><p>Report. Track. Keep our city clean.</p></header>
      <main>
        {/* 1. Dashboard summary */}
        <section>
          <h2>Overview</h2>
          <div className="grid">
            <div className="card stat">{count('clean')}<small>Clean areas</small></div>
            <div className="card stat">{count('attention')}<small>Need attention</small></div>
            <div className="card stat">{count('not_clean')}<small>Not clean</small></div>
          </div>
        </section>

        {/* 2. Area cleanliness status */}
        <section>
          <h2>Area Cleanliness Status</h2>
          <div className="grid">
            {areas.map((a) => (
              <div className="card" key={a._id}>
                <b>{a.name}</b><br />
                <span className={`badge ${a.status}`}>{LABEL[a.status]}</span>
                <small> {a.openIssues} open issue(s)</small>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Feedback / complaint form */}
        <section>
          <h2>Report an Issue</h2>
          <form onSubmit={submit}>
            <select required value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
              <option value="">Select area</option>
              {areas.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
            <select value={form.issueType} onChange={(e) => setForm({ ...form, issueType: e.target.value })}>
              {ISSUES.map((i) => <option key={i}>{i}</option>)}
            </select>
            <textarea placeholder="Describe the problem (landmark, details)" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <input placeholder="Your name (optional)" value={form.reporter}
              onChange={(e) => setForm({ ...form, reporter: e.target.value })} />
            <button>Submit Complaint</button>
          </form>
          {msg && <p><b>{msg}</b></p>}
        </section>

        {/* 4. Track complaints (admins can update status) */}
        <section>
          <h2>Track Complaints</h2>
          <input placeholder="Search by complaint ID or area" value={search} onChange={(e) => setSearch(e.target.value)} />
          <input placeholder="Admin key (only for officials)" type="password" value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)} style={{ marginTop: 8 }} />
          {shown.map((r) => (
            <div className="row" key={r._id}>
              <span><b>#{r._id.slice(-6).toUpperCase()}</b> {r.issueType} - {r.area?.name}</span>
              {adminKey ? (
                <select value={r.status} onChange={(e) => updateStatus(r._id, e.target.value)}>
                  {['Submitted', 'In Progress', 'Resolved'].map((s) => <option key={s}>{s}</option>)}
                </select>
              ) : <span>{r.status}</span>}
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
