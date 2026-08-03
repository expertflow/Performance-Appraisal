'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');

const projectsRouter    = require('./routes/projects');
const tasksRouter       = require('./routes/tasks');
const employeesRouter   = require('./routes/employees');
const timeEntriesRouter = require('./routes/time-entries');
const syncRouter        = require('./routes/sync');
const { runSync }       = require('./services/sync');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
  methods: ['GET','POST','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(morgan('dev'));
app.use(express.json());

// ── Health check ──────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── API routes ────────────────────────────────────────────────────────────
app.use('/api/v1/projects',      projectsRouter);
app.use('/api/v1/tasks',         tasksRouter);
app.use('/api/v1/employees',     employeesRouter);
app.use('/api/v1/time-entries',  timeEntriesRouter);
app.use('/api/v1/sync',          syncRouter);

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
