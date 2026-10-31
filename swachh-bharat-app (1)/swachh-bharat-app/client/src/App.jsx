import { useEffect, useState } from 'react';

// ---------- Constants ----------
const ISSUES = ['Garbage pile', 'Overflowing dustbin', 'Open drain', 'Littering', 'Other'];
const STEPS = ['Submitted', 'In Progress', 'Resolved'];
// How each area status looks: label, badge class, bar colour
const LOOK = {
  clean:     { label: 'Clean',           cls: 'ok',  color: '#1B5E3A' },
  attention: { label: 'Needs attention', cls: 'mid', color: '#E3A21A' },
  not_clean: { label: 'Not clean',       cls: 'bad', color: '#B3261E' },
};
// Cleanliness score out of 100: every open complaint removes 20 points
const score = (area) => Math.max(0, 100 - area.openIssues * 20);

export default function App() {
  // ---------- State ----------
  const [areas, setAreas] = useState([]);
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState({ area: '', issueType: ISSUES[0], description: '', reporter: '', photo: '' });
  const [coords, setCoords] = useState(null);      // GPS location of the reporter
  const [search, setSearch] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [msg, setMsg] = useState('');

  // ---------- Load data from backend ----------
  const load = async () => {
    try {
      setAreas(await (await fetch('/api/areas')).json());
      setReports(await (await fetch('/api/reports')).json());
    } catch { setMsg('Cannot reach the server. Is the backend running?'); }
  };
  useEffect(() => {
    load();
    // Ask the browser for the user's location once (used to geo-tag complaints)
    navigator.geolocation?.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }), () => {});
  }, []);

  // ---------- Photo: read the chosen file as base64 text ----------
  const pickPhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1_500_000) return setMsg('Photo is too large (max 1.5 MB).');
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, photo: reader.result });
    reader.readAsDataURL(file);
  };

  // ---------- Submit a complaint ----------
  const submit = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/reports', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, ...coords }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Thank you! Your complaint ID is ${data._id.slice(-6).toUpperCase()}` : data.error);
    if (res.ok) { setForm({ ...form, description: '', photo: '' }); load(); }
  };

  // ---------- Admin: change complaint status ----------
  const updateStatus = async (id, status) => {
    const res = await fetch(`/api/reports/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify({ status }),
    });
    res.ok ? load() : setMsg('Wrong admin key');
  };

  // ---------- Numbers shown on the page ----------
  const count = (s) => areas.filter((a) => a.status === s).length;
  const resolvedPct = reports.length
    ? Math.round((reports.filter((r) => r.status === 'Resolved').length / reports.length) * 100) : 0;
  const ranked = [...areas].sort((a, b) => score(b) - score(a)).slice(0, 3);   // leaderboard
  const shown = reports.filter((r) =>
    (r._id.slice(-6) + (r.area?.name || '')).toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      {/* ===== Top navigation ===== */}
      <div className="nav">
        <div className="logo">
          <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="17" fill="#1B5E3A" /><path d="M10 22c0-7 5-11 14-11 0 8-4 13-11 13" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></svg>
          Swachh Tracker
        </div>
        <div className="links"><a href="#areas">Areas</a><a href="#report">Report</a><a href="#track">Track</a><a href="#top">Leaderboard</a></div>
        <button className="btn btn-out" onClick={() => setShowAdmin(!showAdmin)}>{showAdmin ? 'Close admin' : 'Admin login'}</button>
      </div>

      {/* ===== Hero + live stats ===== */}
      <div className="hero">
        <div className="hero-text">
          <span className="bd mid">Swachh Bharat Mission</span>
          <h1>See how clean your area is. Report what is not.</h1>
          <p>Live cleanliness status for every ward, one-minute complaints, and real progress you can track until it is fixed.</p>
          <div className="cta">
            <a href="#report"><button className="btn btn-saffron">Report an issue</button></a>
            <a href="#track"><button className="btn btn-ghost">Track complaint</button></a>
          </div>
        </div>
        <div className="stats">
          <div className="stat"><b>{count('clean')}</b><small>Clean areas</small></div>
          <div className="stat"><b style={{ color: '#F6B73C' }}>{count('attention')}</b><small>Need attention</small></div>
          <div className="stat"><b style={{ color: '#FF9A92' }}>{count('not_clean')}</b><small>Not clean</small></div>
          <div className="stat"><b>{resolvedPct}%</b><small>Complaints resolved</small></div>
        </div>
      </div>

      {/* ===== Area cleanliness cards ===== */}
      <div className="wrap" id="areas">
        <h2>Area cleanliness status</h2>
        <p className="sub">Status updates automatically from open complaints in each area.</p>
        <div className="cards">
          {areas.map((a) => (
            <div className="card" key={a._id}>
              <div className="top"><b>{a.name}</b><span className={`bd ${LOOK[a.status].cls}`}>{LOOK[a.status].label}</span></div>
              <div className="bar" style={{ margin: '14px 0 8px' }}><i style={{ width: score(a) + '%', background: LOOK[a.status].color }} /></div>
              <small>Score {score(a)} / 100 · {a.openIssues} open issue(s)</small>
            </div>
          ))}
        </div>
      </div>

      <div className="two">
        {/* ===== Report form ===== */}
        <div className="card" id="report">
          <h2>Report an issue</h2>
          <p className="sub">Takes under a minute. You get a complaint ID to track it.</p>
          <form className="form" onSubmit={submit}>
            <div className="row2">
              <select className="in" required value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
                <option value="">Select area</option>
                {areas.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
              </select>
              <select className="in" value={form.issueType} onChange={(e) => setForm({ ...form, issueType: e.target.value })}>
                {ISSUES.map((i) => <option key={i}>{i}</option>)}
              </select>
            </div>
            <textarea className="in" rows="3" placeholder="Describe the problem and nearest landmark" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <label className="drop">
              {form.photo ? <img src={form.photo} alt="Selected problem" /> : 'Tap to add a photo of the problem'}
              <input type="file" accept="image/*" hidden onChange={pickPhoto} />
            </label>
            <div className="row2">
              <span className={`bd ${coords ? 'ok' : 'plain'}`}>{coords ? 'Location detected' : 'Location off'}</span>
              <input className="in" placeholder="Your name (optional)" value={form.reporter}
                onChange={(e) => setForm({ ...form, reporter: e.target.value })} />
            </div>
            <button className="btn btn-green">Submit complaint</button>
          </form>
          {msg && <p><b>{msg}</b></p>}
        </div>

        {/* ===== Track complaints ===== */}
        <div className="card" id="track">
          <h2>Track complaints</h2>
          <p className="sub">Search by complaint ID or area.</p>
          <input className="in" placeholder="Search, e.g. 4F2A9C" value={search} onChange={(e) => setSearch(e.target.value)} />
          {showAdmin && <input className="in" type="password" placeholder="Admin key" value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)} style={{ marginTop: 8 }} />}
          {shown.map((r) => {
            const step = STEPS.indexOf(r.status) + 1;   // 1, 2 or 3 bars filled
            return (
              <div className="item" key={r._id}>
                <div className="top">
                  <b>#{r._id.slice(-6).toUpperCase()} · {r.issueType}</b>
                  {showAdmin && adminKey ? (
                    <select value={r.status} onChange={(e) => updateStatus(r._id, e.target.value)}>
                      {STEPS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  ) : <span className={`bd ${step === 3 ? 'ok' : step === 2 ? 'mid' : 'plain'}`}>{r.status}</span>}
                </div>
                <small>{r.area?.name} · {new Date(r.createdAt).toLocaleDateString()}</small>
                <div className="steps">
                  {[1, 2, 3].map((n) => (
                    <div className="bar" key={n}><i style={{ width: n <= step ? '100%' : '0', background: step === 3 ? '#1B5E3A' : n === step && step === 2 ? '#E3A21A' : '#1B5E3A' }} /></div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== Leaderboard ===== */}
      <div className="wrap" id="top" style={{ paddingTop: 8 }}>
        <div className="card">
          <h2 style={{ fontSize: 20 }}>Cleanest areas right now</h2>
          <div className="rank">
            {ranked.map((a, i) => <div key={a._id}><b>{i + 1}. {a.name}</b><strong>{score(a)}</strong></div>)}
          </div>
        </div>
      </div>
      <div className="foot">Swachh Tracker · Built for the Swachh Bharat Mission · College project</div>
    </>
  );
}
