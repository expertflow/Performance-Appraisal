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
      Employee:         entry.employee_id,
      Project:          entry.project_id,
      Description:      entry.description,
      StartDateTime:    entry.start_datetime,
      EndDateTime:      entry.end_datetime,
      HoursWorked:      entry.hours_worked,
      otrs_project_ref: `${APP_URL()}/timesheet?entry=${entry.id}`
    };

    try {
      let directusId = entry.directus_id;

      if (directusId) {
        // Update existing Directus record
        await axios.patch(
          `${DIRECTUS_URL()}/items/TimeEntry/${directusId}`,
          payload,
          { headers: directusHeaders(), timeout: 10000 }
        );
      } else {
        // Create new Directus record
        const resp = await axios.post(
          `${DIRECTUS_URL()}/items/TimeEntry`,
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
      `${DIRECTUS_URL()}/items/TimeEntry?fields=id,Employee,Project,Description,StartDateTime,EndDateTime,HoursWorked&limit=500&sort=-id`,
      { headers: directusHeaders(), timeout: 15000 }
    );
    const entries = resp.data?.data ?? [];

    let pulled = 0;
    for (const d of entries) {
      try {
        const employeeId = typeof d.Employee === 'object' ? d.Employee?.id : d.Employee;
        const directusProjectId = typeof d.Project === 'object' ? d.Project?.id : d.Project;

        if (!employeeId || !directusProjectId || !d.StartDateTime) continue;

        // Check if we already have this directus_id — only update existing local entries
        // (we don't insert new ones from Directus since project IDs are different systems)
        const { rows: existing } = await pool.query(
          `SELECT id FROM project.time_entry WHERE directus_id = $1`, [String(d.id)]
        );

        if (existing.length) {
          await pool.query(
            `UPDATE project.time_entry
             SET description = $1, start_datetime = $2, end_datetime = $3,
                 hours_worked = $4, directus_sync_status = 'synced',
                 directus_sync_at = NOW(), updated_at = NOW()
             WHERE directus_id = $5`,
            [d.Description, d.StartDateTime, d.EndDateTime, d.HoursWorked, String(d.id)]
          );
          pulled++;
        }
        // Skip inserting new entries from Directus — project IDs are integer in Directus
        // but UUID in our local DB. Only update entries we previously pushed.
      } catch (entryErr) {
        console.warn(`[sync] Skipping TimeEntry ${d.id}:`, entryErr.message);
      }
    }

    return { pulled };
  } catch (err) {
    console.error('[sync] Pull from Directus failed:', err.message);
    return { pulled: 0, error: err.message };
  }
}

// ── Direction C: Directus → App (Projects) ───────────────────────────────
async function syncProjectsFromDirectus() {
  if (!DIRECTUS_TOKEN()) {
    console.warn('[sync] DIRECTUS_TOKEN not set — skipping project sync.');
    return { synced: 0 };
  }
  try {
    let page = 1;
    const limit = 500;
    let synced = 0;

    while (true) {
      const url = `${DIRECTUS_URL()}/items/Project?fields=id,Name,Status,Description&limit=${limit}&page=${page}&filter[Status][_nin]=Closed,Cancelled&sort=id`;
      const resp = await axios.get(url, {
        headers: directusHeaders(),
        timeout: 20000
      });
      const items = resp.data?.data ?? [];
      if (!items.length) break;

      for (const p of items) {
        const statusMap = { 'Active':'active','Open':'active','On Hold':'on_hold','Closed':'completed','Cancelled':'cancelled' };
        const localStatus = statusMap[p.Status] || 'active';
        const name = (p.Name || '').trim() || `Project ${p.id}`;
        await pool.query(
          `INSERT INTO project.project
             (name, type, status, health_status, bs4_project_id, created_at, updated_at)
           VALUES ($1, 'client', $2, NULL, $3, NOW(), NOW())
           ON CONFLICT (bs4_project_id) DO UPDATE SET
             name       = EXCLUDED.name,
             status     = EXCLUDED.status,
             updated_at = NOW()`,
          [name, localStatus, String(p.id)]
        );
        synced++;
      }

      if (items.length < limit) break;
      page++;
    }

    return { synced };
  } catch (err) {
    console.error('[sync] Project sync from Directus failed:', err.message);
    return { synced: 0, error: err.message };
  }
}

// ── Main sync runner ──────────────────────────────────────────────────────
async function runSync() {
  console.log(`[sync] Starting bidirectional sync at ${new Date().toISOString()}`);
  const projectResult = await syncProjectsFromDirectus();
  const pushResult    = await pushToDirectus();
  const pullResult    = await pullFromDirectus();
  console.log(`[sync] Done. Projects: ${JSON.stringify(projectResult)} | Push: ${JSON.stringify(pushResult)} | Pull: ${JSON.stringify(pullResult)}`);
  return { projects: projectResult, push: pushResult, pull: pullResult };
}

module.exports = { runSync, pushToDirectus, pullFromDirectus, syncProjectsFromDirectus };
