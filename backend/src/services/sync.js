'use strict';
/**
 * Bidirectional Directus sync service.
 *
 * Direction A — App → Directus:
 *   Push all time entries with directus_sync_status = 'pending' to Directus.
 *   Populate otrs_project_ref with a link back to this app's timesheet page.
 *
 * Direction B — Directus → App:
 *   Pull time entries updated in Directus since last sync.
 *   Upsert into local project.time_entry (by directus_id).
 *
 * Scheduled: daily at 00:00 (midnight) via node-cron.
 * Also exposed as POST /api/v1/sync/trigger for manual runs.
 */
const axios = require('axios');
const pool = require('../db/pool');

const DIRECTUS_URL = () => process.env.DIRECTUS_URL || 'https://bs4.expertflow.com';
const DIRECTUS_TOKEN = () => process.env.DIRECTUS_TOKEN || '';
const APP_URL = () => process.env.APP_URL || 'http://localhost:4200';

function directusHeaders() {
  return { Authorization: `Bearer ${DIRECTUS_TOKEN()}` };
}

// ── Direction A: App → Directus ───────────────────────────────────────────
async function pushToDirectus() {
  const { rows: pending } = await pool.query(
    `SELECT * FROM project.time_entry
     WHERE directus_sync_status = 'pending'
     ORDER BY created_at
     LIMIT 200`
  );

  let synced = 0;
  let failed = 0;

  for (const entry of pending) {
    const payload = {
      employee:         entry.employee_id,
      project:          entry.project_id,
      description:      entry.description,
      start_datetime:   entry.start_datetime,
      end_datetime:     entry.end_datetime,
      hours_worked:     parseFloat(entry.hours_worked),
      otrs_project_ref: `${APP_URL()}/timesheet?entry=${entry.id}`
    };

    try {
      let directusId = entry.directus_id;

      if (directusId) {
        // Update existing Directus record
        await axios.patch(
          `${DIRECTUS_URL()}/items/time_entry/${directusId}`,
          payload,
          { headers: directusHeaders(), timeout: 10000 }
        );
      } else {
        // Create new Directus record
        const resp = await axios.post(
          `${DIRECTUS_URL()}/items/time_entry`,
          payload,
          { headers: directusHeaders(), timeout: 10000 }
        );
        directusId = resp.data?.data?.id;
      }

      await pool.query(
        `UPDATE project.time_entry
         SET directus_sync_status = 'synced',
             directus_id = $1,
             directus_sync_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [directusId, entry.id]
      );

      // Log success
      await pool.query(
        `INSERT INTO project.directus_sync_log
           (time_entry_id, idempotency_key, attempt_count, last_attempt_at, status)
         VALUES ($1, $2, 1, NOW(), 'synced')`,
        [entry.id, entry.idempotency_key]
      );

      synced++;
    } catch (err) {
      const msg = err.response?.data?.errors?.[0]?.message || err.message;
      await pool.query(
        `UPDATE project.time_entry
         SET directus_sync_status = 'failed', updated_at = NOW()
         WHERE id = $1`,
        [entry.id]
      );
      await pool.query(
        `INSERT INTO project.directus_sync_log
           (time_entry_id, idempotency_key, attempt_count, last_attempt_at, status, error_message)
         VALUES ($1, $2, 1, NOW(), 'failed', $3)`,
        [entry.id, entry.idempotency_key, msg]
      );
      failed++;
      console.error(`[sync] Failed to push entry ${entry.id}:`, msg);
    }
  }

  return { pushed: pending.length, synced, failed };
}

// ── Direction B: Directus → App ───────────────────────────────────────────
async function pullFromDirectus() {
  if (!DIRECTUS_TOKEN()) {
    console.warn('[sync] DIRECTUS_TOKEN not set — skipping pull.');
    return { pulled: 0 };
  }

  // Find the last successful pull timestamp
  const { rows: lastSync } = await pool.query(
    `SELECT MAX(directus_sync_at) AS last_at FROM project.time_entry WHERE directus_sync_status = 'synced'`
  );
  const since = lastSync[0]?.last_at
    ? new Date(lastSync[0].last_at).toISOString()
    : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // default: last 24h

  try {
    const resp = await axios.get(
      `${DIRECTUS_URL()}/items/time_entry?fields=id,employee,project,description,start_datetime,end_datetime,hours_worked&filter[date_updated][_gte]=${encodeURIComponent(since)}&limit=500`,
      { headers: directusHeaders(), timeout: 15000 }
    );
    const entries = resp.data?.data ?? [];

    let pulled = 0;
    for (const d of entries) {
      const employeeId = typeof d.employee === 'object' ? d.employee?.id : d.employee;
      const projectId  = typeof d.project  === 'object' ? d.project?.id  : d.project;

      if (!employeeId || !projectId || !d.start_datetime || !d.end_datetime) continue;

      // Check if we already have this directus_id
      const { rows: existing } = await pool.query(
        `SELECT id FROM project.time_entry WHERE directus_id = $1`, [d.id]
      );

      if (existing.length) {
        // Update existing local entry
        await pool.query(
          `UPDATE project.time_entry
           SET description = $1, start_datetime = $2, end_datetime = $3,
               hours_worked = $4, directus_sync_status = 'synced',
               directus_sync_at = NOW(), updated_at = NOW()
           WHERE directus_id = $5`,
          [d.description, d.start_datetime, d.end_datetime, d.hours_worked, d.id]
        );
      } else {
        // We need a task_id — try to find a matching task for this project
        const { rows: tasks } = await pool.query(
          `SELECT id FROM project.task WHERE project_id = $1 LIMIT 1`, [projectId]
        );
        const taskId = tasks[0]?.id;
        if (!taskId) continue; // can't insert without a task

        await pool.query(
          `INSERT INTO project.time_entry
             (task_id, project_id, employee_id, description,
              start_datetime, end_datetime, hours_worked,
              status, directus_id, directus_sync_status, directus_sync_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'approved',$8,'synced',NOW())
           ON CONFLICT (idempotency_key) DO NOTHING`,
          [taskId, projectId, employeeId, d.description || '',
           d.start_datetime, d.end_datetime, d.hours_worked, d.id]
        );
      }
      pulled++;
    }

    return { pulled };
  } catch (err) {
    console.error('[sync] Pull from Directus failed:', err.message);
    return { pulled: 0, error: err.message };
  }
}

// ── Main sync runner ──────────────────────────────────────────────────────
async function runSync() {
  console.log(`[sync] Starting bidirectional sync at ${new Date().toISOString()}`);
  const pushResult = await pushToDirectus();
  const pullResult = await pullFromDirectus();
  console.log(`[sync] Done. Push: ${JSON.stringify(pushResult)} | Pull: ${JSON.stringify(pullResult)}`);
  return { push: pushResult, pull: pullResult };
}

module.exports = { runSync, pushToDirectus, pullFromDirectus };
