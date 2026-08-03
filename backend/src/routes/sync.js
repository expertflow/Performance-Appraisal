'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { runSync } = require('../services/sync');

// GET /api/v1/sync/status
router.get('/status', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE directus_sync_status = 'pending')     AS pending_count,
        COUNT(*) FILTER (WHERE directus_sync_status = 'synced')      AS synced_count,
        COUNT(*) FILTER (WHERE directus_sync_status = 'failed')      AS failed_count,
        MAX(directus_sync_at) FILTER (WHERE directus_sync_status = 'synced') AS last_sync_at
      FROM project.time_entry
    `);
    const r = rows[0];
    res.json({
      pending_count: parseInt(r.pending_count),
      synced_count:  parseInt(r.synced_count),
      failed_count:  parseInt(r.failed_count),
      last_sync_at:  r.last_sync_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/sync/trigger — manual sync trigger
router.post('/trigger', async (req, res) => {
  try {
    const result = await runSync();
    res.json({ message: 'Sync completed.', result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
