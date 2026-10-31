// ---------- Backend: Express + MongoDB (Mongoose) ----------
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const app = express();
const useMockData = process.env.USE_MOCK_DATA === 'true';
app.use(cors());          // allow the React app to call this API
app.use(express.json({ limit: '3mb' }));  // read JSON bodies (photos arrive as base64 text)

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
  photo: { type: String, default: '' },          // base64 image (optional)
  lat: Number, lng: Number,                       // GPS location (optional)
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['Submitted', 'In Progress', 'Resolved'], default: 'Submitted' },
}, { timestamps: true }));                       // adds createdAt / updatedAt automatically

const User = mongoose.model('User', new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
}, { timestamps: true }));

const mockAreas = [
  { _id: '664000000000000000000001', name: 'Gandhi Maidan', status: 'attention', openIssues: 1, updatedAt: new Date() },
  { _id: '664000000000000000000002', name: 'Boring Road', status: 'clean', openIssues: 0, updatedAt: new Date() },
  { _id: '664000000000000000000003', name: 'Kankarbagh', status: 'not_clean', openIssues: 3, updatedAt: new Date() },
  { _id: '664000000000000000000004', name: 'Rajendra Nagar', status: 'clean', openIssues: 0, updatedAt: new Date() },
  { _id: '664000000000000000000005', name: 'Patliputra Colony', status: 'attention', openIssues: 1, updatedAt: new Date() },
];
const mockReports = [
  { _id: '665000000000000000000001', area: mockAreas[0]._id, issueType: 'Overflowing dustbin', description: 'Dustbin near the main gate is full.', reporter: 'Sample citizen', status: 'Submitted', createdAt: new Date(), updatedAt: new Date() },
  { _id: '665000000000000000000002', area: mockAreas[2]._id, issueType: 'Garbage pile', description: 'Garbage has collected beside the road.', reporter: 'Sample citizen', status: 'In Progress', createdAt: new Date(Date.now() - 86400000), updatedAt: new Date() },
  { _id: '665000000000000000000003', area: mockAreas[4]._id, issueType: 'Open drain', description: 'The drain needs cleaning.', reporter: 'Sample citizen', status: 'Resolved', createdAt: new Date(Date.now() - 172800000), updatedAt: new Date() },
];
const mockUsers = [
  { _id: '663000000000000000000001', name: 'Demo Admin', email: 'admin@example.com', passwordHash: bcrypt.hashSync('admin123', 10), role: 'admin' },
  { _id: '663000000000000000000002', name: 'Demo Citizen', email: 'user@example.com', passwordHash: bcrypt.hashSync('user1234', 10), role: 'user' },
];

const nextMockId = () => `665${Date.now().toString(16).padStart(21, '0').slice(-21)}`;
const getMockArea = (areaId) => mockAreas.find((area) => area._id === areaId);
const recalcMockArea = (areaId) => {
  const area = getMockArea(areaId);
  if (!area) return;
  const openIssues = mockReports.filter((report) => report.area === areaId && report.status !== 'Resolved').length;
  area.openIssues = openIssues;
  area.status = openIssues === 0 ? 'clean' : openIssues < 3 ? 'attention' : 'not_clean';
  area.updatedAt = new Date();
};

// ---------- 2. Smart logic: area status is calculated from open complaints ----------
// 0 open = clean, 1-2 = needs attention, 3 or more = not clean
async function recalcArea(areaId) {
  const open = await Report.countDocuments({ area: areaId, status: { $ne: 'Resolved' } });
  const status = open === 0 ? 'clean' : open < 3 ? 'attention' : 'not_clean';
  await Area.findByIdAndUpdate(areaId, { status, openIssues: open, updatedAt: new Date() });
}

const publicUser = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role });
const issueToken = (user) => jwt.sign(publicUser(user), process.env.JWT_SECRET, { expiresIn: '1d' });

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired login' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
};

// Wrapper so every route returns a clean error instead of crashing
const safe = (fn) => (req, res) => fn(req, res).catch((e) => res.status(400).json({ error: e.message }));

// ---------- 3. API routes ----------
app.post('/api/auth/register', safe(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Name, email, and a password of at least 6 characters are required' });
  const normalizedEmail = email.toLowerCase().trim();

  if (useMockData) {
    if (mockUsers.some((user) => user.email === normalizedEmail))
      return res.status(409).json({ error: 'Email is already registered' });
    const user = { _id: nextMockId(), name, email: normalizedEmail, passwordHash: await bcrypt.hash(password, 10), role: 'user' };
    mockUsers.push(user);
    return res.status(201).json({ token: issueToken(user), user: publicUser(user) });
  }

  if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ error: 'Email is already registered' });
  const user = await User.create({ name, email: normalizedEmail, passwordHash: await bcrypt.hash(password, 10), role: 'user' });
  res.status(201).json({ token: issueToken(user), user: publicUser(user) });
}));

app.post('/api/auth/login', safe(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email?.toLowerCase().trim();
  const user = useMockData
    ? mockUsers.find((item) => item.email === normalizedEmail)
    : await User.findOne({ email: normalizedEmail });
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash)))
    return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: issueToken(user), user: publicUser(user) });
}));

app.get('/api/areas', safe(async (req, res) => {
  if (useMockData) return res.json([...mockAreas].sort((a, b) => a.name.localeCompare(b.name)));
  return res.json(await Area.find().sort('name'));
}));

app.post('/api/areas', requireAuth, requireAdmin, safe(async (req, res) => {
  if (useMockData) {
    const area = { _id: nextMockId(), name: req.body.name, status: 'clean', openIssues: 0, updatedAt: new Date() };
    mockAreas.push(area);
    return res.status(201).json(area);
  }
  return res.status(201).json(await Area.create({ name: req.body.name }));
}));

app.get('/api/reports', safe(async (req, res) => {
  if (useMockData) {
    return res.json([...mockReports].sort((a, b) => b.createdAt - a.createdAt).map((report) => ({
      ...report, area: { _id: report.area, name: getMockArea(report.area)?.name },
    })));
  }
  return res.json(await Report.find().select('-photo').populate('area', 'name').sort('-createdAt').limit(100));
}));

// Citizens submit a complaint
app.post('/api/reports', requireAuth, safe(async (req, res) => {
  if (useMockData) {
    if (!getMockArea(req.body.area)) return res.status(400).json({ error: 'Selected area does not exist' });
    const report = { _id: nextMockId(), ...req.body, createdBy: req.user.id, status: 'Submitted', createdAt: new Date(), updatedAt: new Date() };
    mockReports.unshift(report);
    recalcMockArea(report.area);
    return res.status(201).json(report);
  }
  const report = await Report.create({ ...req.body, createdBy: req.user.id });
  await recalcArea(report.area);
  res.status(201).json(report);
}));

// Admin updates complaint progress (Submitted -> In Progress -> Resolved)
app.patch('/api/reports/:id', requireAuth, requireAdmin, safe(async (req, res) => {
  if (useMockData) {
    const report = mockReports.find((item) => item._id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    report.status = req.body.status;
    report.updatedAt = new Date();
    recalcMockArea(report.area);
    return res.json(report);
  }
  const report = await Report.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  await recalcArea(report.area);
  res.json(report);
}));

// ---------- 4. Start server (MongoDB mode or local mock mode) ----------
const startServer = () => app.listen(process.env.PORT || 5000, () =>
  console.log(`API running on port ${process.env.PORT || 5000}${useMockData ? ' (mock data)' : ''}`));

const ensureAdmin = async () => {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required');
  if (!(await User.exists({ email })))
    await User.create({ name: 'Administrator', email, passwordHash: await bcrypt.hash(password, 10), role: 'admin' });
};

if (useMockData) {
  startServer();
} else {
  mongoose.connect(process.env.MONGO_URI).then(async () => {
    if ((await Area.countDocuments()) === 0)
      await Area.insertMany(['Gandhi Maidan', 'Boring Road', 'Kankarbagh', 'Rajendra Nagar', 'Patliputra Colony'].map((name) => ({ name })));
    await ensureAdmin();
    startServer();
  }).catch((e) => console.error('MongoDB connection failed:', e.message));
}
