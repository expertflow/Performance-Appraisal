'use strict';
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// ── Ensure table exists (idempotent) ─────────────────────────────────────────
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_notifications (
      id              SERIAL PRIMARY KEY,
      target_role     TEXT        NOT NULL DEFAULT 'HR',
      target_user_id  TEXT        DEFAULT NULL,
      type            TEXT        NOT NULL DEFAULT 'info',
      title           TEXT        NOT NULL,
      body            TEXT        NOT NULL DEFAULT '',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_by         TEXT[]      NOT NULL DEFAULT '{}'
    )
  `);
  // Add target_user_id column for existing deployments (idempotent)
  await pool.query(`ALTER TABLE app_notifications ADD COLUMN IF NOT EXISTS target_user_id TEXT DEFAULT NULL`);
}

// ── GET /api/v1/notifications?role=HR&userId=u2 ───────────────────────────────
// Returns notifications targeted at the given role OR specifically at this userId.
router.get('/', async (req, res) => {
  try {
    await ensureTable();
    const { role = 'HR', userId = '' } = req.query;

    const { rows } = await pool.query(
      `SELECT id, type, title, body, created_at,
              ($1 = ANY(read_by)) AS read
       FROM app_notifications
       WHERE (target_user_id = $1)
          OR (target_user_id IS NULL AND (target_role = $2 OR target_role = 'all'))
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId, role]
    );

    res.json(rows.map(r => ({
      id:    String(r.id),
      type:  r.type,
      title: r.title,
      body:  r.body,
      time:  formatTime(r.created_at),
      read:  r.read,
    })));
  } catch (err) {
    console.error('[notifications GET]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/v1/notifications ────────────────────────────────────────────────
// Body: { target_role, target_user_id, type, title, body }
// If target_user_id is provided, the notification goes only to that user.
router.post('/', async (req, res) => {
  try {
    await ensureTable();
    const { target_role = 'HR', target_user_id = null, type = 'info', title, body = '' } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    const { rows } = await pool.query(
      `INSERT INTO app_notifications (target_role, target_user_id, type, title, body)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, type, title, body, created_at`,
      [target_role, target_user_id || null, type, title, body]
    );
    const r = rows[0];
    res.status(201).json({
      id:    String(r.id),
      type:  r.type,
      title: r.title,
      body:  r.body,
      time:  formatTime(r.created_at),
      read:  false,
    });
  } catch (err) {
    console.error('[notifications POST]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/v1/notifications/:id/read ─────────────────────────────────────
router.patch('/:id/read', async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    await pool.query(
      `UPDATE app_notifications
       SET read_by = array_append(read_by, $1::text)
       WHERE id = $2 AND NOT ($1 = ANY(read_by))`,
      [userId, id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[notifications PATCH]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/v1/notifications/read-all ─────────────────────────────────────
router.patch('/read-all', async (req, res) => {
  try {
    await ensureTable();
    const { userId, role = 'HR' } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    await pool.query(
      `UPDATE app_notifications
       SET read_by = array_append(read_by, $1::text)
       WHERE ((target_user_id = $1) OR (target_user_id IS NULL AND (target_role = $2 OR target_role = 'all')))
         AND NOT ($1 = ANY(read_by))`,
      [userId, role]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[notifications PATCH read-all]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Helper ────────────────────────────────────────────────────────────────────
function formatTime(date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}

module.exports = router;
