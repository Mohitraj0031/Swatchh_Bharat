// ---------- Backend: Express + MongoDB (Mongoose) ----------
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());          // allow the React app to call this API
app.use(express.json());  // read JSON request bodies

// ---------- 1. Database models ----------
// Area = a locality/ward whose cleanliness we monitor
const Area = mongoose.model('Area', new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  status: { type: String, enum: ['clean', 'attention', 'not_clean'], default: 'clean' },
  openIssues: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now },
}));

// Report = a citizen complaint (feedback) about an area
const Report = mongoose.model('Report', new mongoose.Schema({
  area: { type: mongoose.Schema.Types.ObjectId, ref: 'Area', required: true },
  issueType: { type: String, required: true },   // e.g. Garbage pile, Open drain
  description: { type: String, default: '' },
  reporter: { type: String, default: 'Anonymous' },
  status: { type: String, enum: ['Submitted', 'In Progress', 'Resolved'], default: 'Submitted' },
}, { timestamps: true }));                       // adds createdAt / updatedAt automatically

// ---------- 2. Smart logic: area status is calculated from open complaints ----------
// 0 open = clean, 1-2 = needs attention, 3 or more = not clean
async function recalcArea(areaId) {
  const open = await Report.countDocuments({ area: areaId, status: { $ne: 'Resolved' } });
  const status = open === 0 ? 'clean' : open < 3 ? 'attention' : 'not_clean';
  await Area.findByIdAndUpdate(areaId, { status, openIssues: open, updatedAt: new Date() });
}

// Simple admin protection: admin requests must send header "x-admin-key"
const adminOnly = (req, res, next) =>
  req.headers['x-admin-key'] === process.env.ADMIN_KEY ? next() : res.status(401).json({ error: 'Invalid admin key' });

// Wrapper so every route returns a clean error instead of crashing
const safe = (fn) => (req, res) => fn(req, res).catch((e) => res.status(400).json({ error: e.message }));

// ---------- 3. API routes ----------
app.get('/api/areas', safe(async (req, res) => res.json(await Area.find().sort('name'))));

app.post('/api/areas', adminOnly, safe(async (req, res) => res.status(201).json(await Area.create({ name: req.body.name }))));

app.get('/api/reports', safe(async (req, res) =>
  res.json(await Report.find().populate('area', 'name').sort('-createdAt').limit(100))));

// Citizens submit a complaint
app.post('/api/reports', safe(async (req, res) => {
  const report = await Report.create(req.body);
  await recalcArea(report.area);
  res.status(201).json(report);
}));

// Admin updates complaint progress (Submitted -> In Progress -> Resolved)
app.patch('/api/reports/:id', adminOnly, safe(async (req, res) => {
  const report = await Report.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  await recalcArea(report.area);
  res.json(report);
}));

// ---------- 4. Start server (and add sample areas on first run) ----------
mongoose.connect(process.env.MONGO_URI).then(async () => {
  if ((await Area.countDocuments()) === 0)
    await Area.insertMany(['Gandhi Maidan', 'Boring Road', 'Kankarbagh', 'Rajendra Nagar', 'Patliputra Colony'].map((name) => ({ name })));
  app.listen(process.env.PORT || 5000, () => console.log('API running on port', process.env.PORT || 5000));
}).catch((e) => console.error('MongoDB connection failed:', e.message));
