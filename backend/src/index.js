'use strict';
const path = require('path');
// Load .env from the app root directory (works regardless of CWD)
// __dirname = /opt/hr-suite/src, so '../.env' = /opt/hr-suite/.env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');

const projectsRouter       = require('./routes/projects');
const tasksRouter          = require('./routes/tasks');
const employeesRouter      = require('./routes/employees');
const timeEntriesRouter    = require('./routes/time-entries');
const syncRouter           = require('./routes/sync');
const jobPostingsRouter    = require('./routes/job-postings');
const jobApplicationsRouter = require('./routes/job-applications');
const authLocalRouter      = require('./routes/auth-local');
const authGoogleRouter     = require('./routes/auth-google');
const appUsersRouter          = require('./routes/app-users');
const jobRequisitionsRouter   = require('./routes/job-requisitions');
const sendEmailRouter         = require('./routes/send-email');
const notificationsRouter        = require('./routes/notifications');
const performanceAppraisalsRouter = require('./routes/performance-appraisals');
const aiScreenRouter              = require('./routes/ai-screen');
const jobOffersRouter             = require('./routes/job-offers');
const { runSync }          = require('./services/sync');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.CORS_ORIGIN || 'http://localhost:4200',
    'http://localhost:4201',
    'http://localhost:4202',
  ],
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────
app.use('/api/v1/projects',         projectsRouter);
app.use('/api/v1/tasks',            tasksRouter);
app.use('/api/v1/employees',        employeesRouter);
app.use('/api/v1/time-entries',     timeEntriesRouter);
app.use('/api/v1/sync',             syncRouter);
app.use('/api/v1/job-postings',     jobPostingsRouter);
app.use('/api/v1/job-applications', jobApplicationsRouter);
app.use('/api/v1/auth-local',       authLocalRouter);
app.use('/api/v1/app-users',        appUsersRouter);
app.use('/api/v1/job-requisitions', jobRequisitionsRouter);
app.use('/api/v1/send-email',       sendEmailRouter);
app.use('/api/v1/notifications',    notificationsRouter);
app.use('/api/v1/appraisals',       performanceAppraisalsRouter);
app.use('/api/v1/ai',               aiScreenRouter);
app.use('/api/v1/job-offers',       jobOffersRouter);
app.use('/api/v1/auth/google',      authGoogleRouter);

// ── 404 handler ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler ─────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Cron: bidirectional sync at midnight every day ────────────────────────
// '0 0 * * *' = 00:00 every day (server timezone)
cron.schedule('0 0 * * *', async () => {
  console.log('[cron] Midnight sync triggered');
  try {
    await runSync();
  } catch (err) {
    console.error('[cron] Sync error:', err.message);
  }
}, {
  timezone: 'Asia/Karachi'  // PKT — adjust via env if needed
});

// ── Start server ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ HR Suite backend running on http://localhost:${PORT}`);
  console.log(`   Directus: ${process.env.DIRECTUS_URL || 'https://bs4.expertflow.com'}`);
  console.log(`   DB: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  console.log(`   Sync cron: daily at 00:00 Asia/Karachi`);
});

module.exports = app;
