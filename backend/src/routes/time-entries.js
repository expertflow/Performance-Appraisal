'use strict';
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const axios = require('axios');
const https = require('https');

const httpsAgent = new https.Agent({ rejectUnauthorized: false });
const DIRECTUS_URL   = () => (process.env.DIRECTUS_URL   || 'https://bs4.expertflow.com').trim();
const DIRECTUS_TOKEN = () => (process.env.DIRECTUS_TOKEN || '').trim();

// ── Helper: parse HoursWorked from Directus (may be "HH:MM:SS", number, or null) ──
function parseHours(val) {
  if (val == null) return 0;
  if (typeof val === 'number') return val;
  const s = String(val);
  if (s.includes(':')) {
    const parts = s.split(':').map(Number);
    return (parts[0] || 0) + (parts[1] || 0) / 60 + (parts[2] || 0) / 3600;
  }
  return parseFloat(s) || 0;
}

/**
 * GET /api/v1/time-entries/directus-summary?employee_id=171
 *
 * Fetches ALL TimeEntry records for the given Directus employee ID directly
 * from the Directus ERP, groups them by Project, and returns a summary array:
 *   [{ projectId, projectName, totalHours, entryCount }]
 *
 * Falls back to local DB if Directus is unavailable.
 */
router.get('/directus-summary', async (req, res) => {
  const { employee_id } = req.query;
  if (!employee_id) {
    return res.status(400).json({ error: 'employee_id is required' });
  }

  // ── Try Directus first ────────────────────────────────────────────────────
  if (DIRECTUS_TOKEN()) {
    try {
      // Fetch all time entries for this employee from Directus
      // Fields: id, Employee (int), Project (int or object), HoursWorked, Description
      const filter = encodeURIComponent(JSON.stringify({ Employee: { _eq: Number(employee_id) } }));
      const url = `${DIRECTUS_URL()}/items/TimeEntry?fields=id,Employee,Project,HoursWorked,Description&filter=${filter}&limit=-1`;
      const resp = await axios.get(url, {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN()}` },
        httpsAgent,
        timeout: 15000,
      });
      const entries = resp.data?.data ?? [];

      // Fetch project names from local DB (already synced)
      const { rows: projects } = await pool.query(
        `SELECT id, name, bs4_project_id FROM project.project`
      );
      const projectByBs4Id = new Map();
      projects.forEach(p => {
        if (p.bs4_project_id) projectByBs4Id.set(String(p.bs4_project_id), p);
      });

      // Group by Project
      const grouped = new Map();
      entries.forEach(e => {
        const pid = e.Project != null ? String(e.Project) : null;
        if (!pid) return;
        const hours = parseHours(e.HoursWorked);
        const existing = grouped.get(pid);
        if (existing) {
          existing.totalHours += hours;
          existing.entryCount += 1;
        } else {
          grouped.set(pid, { totalHours: hours, entryCount: 1 });
        }
      });

      const summary = [];
      grouped.forEach((stats, bs4ProjectId) => {
        const proj = projectByBs4Id.get(bs4ProjectId);
        summary.push({
          projectId:   proj?.id ?? bs4ProjectId,
          projectName: proj?.name ?? `Project ${bs4ProjectId}`,
          totalHours:  Math.round(stats.totalHours * 100) / 100,
          entryCount:  stats.entryCount,
        });
      });
      summary.sort((a, b) => b.totalHours - a.totalHours);

      return res.json(summary);
    } catch (err) {
      console.warn('[directus-summary] Directus fetch failed, falling back to local DB:', err.message);
    }
  }

  // ── Fallback: local DB ────────────────────────────────────────────────────
  try {
    const { rows } = await pool.query(
      `SELECT te.project_id, p.name AS project_name,
              SUM(te.hours_worked) AS total_hours,
              COUNT(*) AS entry_count
       FROM project.time_entry te
       LEFT JOIN project.project p ON p.id = te.project_id
       WHERE te.employee_id = $1
       GROUP BY te.project_id, p.name
       ORDER BY total_hours DESC`,
      [employee_id]
    );
    const summary = rows.map(r => ({
      projectId:   r.project_id,
      projectName: r.project_name ?? r.project_id,
      totalHours:  Math.round(parseFloat(r.total_hours) * 100) / 100,
      entryCount:  parseInt(r.entry_count, 10),
    }));
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/time-entries
router.get('/', async (req, res) => {
  const { project_id, employee_id, date_from, date_to, status } = req.query;
  const conditions = [];
  const values = [];
  let i = 1;
  if (project_id)  { conditions.push(`te.project_id = $${i++}`);                    values.push(project_id); }
  if (employee_id) { conditions.push(`te.employee_id = $${i++}`);                   values.push(employee_id); }
  if (status)      { conditions.push(`te.status = $${i++}`);                        values.push(status); }
  if (date_from)   { conditions.push(`te.start_datetime >= $${i++}`);               values.push(date_from); }
  if (date_to)     { conditions.push(`te.start_datetime <= $${i++}::date + 1`);     values.push(date_to); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(
      `SELECT te.*,
         COALESCE(
           CASE WHEN e.id IS NOT NULL THEN row_to_json(e.*) ELSE NULL END,
           json_build_object(
             'id', a.employee_id,
             'first_name', split_part(a.name, ' ', 1),
             'last_name', CASE WHEN strpos(a.name, ' ') > 0 THEN substring(a.name from strpos(a.name, ' ') + 1) ELSE '' END
           )
         ) AS employee
       FROM project.time_entry te
       LEFT JOIN project.employee_snapshot e ON e.id = te.employee_id
       LEFT JOIN auth_local.account a ON a.employee_id = te.employee_id
       ${where}
       ORDER BY te.start_datetime DESC`,
      values
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/time-entries/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT te.*, row_to_json(e.*) AS employee
       FROM project.time_entry te
       LEFT JOIN project.employee_snapshot e ON e.id = te.employee_id
       WHERE te.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: seconds → decimal hours (rounded to 4 decimal places)
function secondsToDecimalHours(totalSeconds) {
  return Math.round((totalSeconds / 3600) * 10000) / 10000;
}

// Helper: parse "HH:MM:SS" or "HH:MM" string → decimal hours
function hmsToDecimalHours(str) {
  const parts = String(str).split(':').map(Number);
  if (parts.length >= 2) {
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const s = parts[2] || 0;
    return Math.round(((h * 3600 + m * 60 + s) / 3600) * 10000) / 10000;
  }
  // Fallback: try parsing as a plain number
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

// POST /api/v1/time-entries
router.post('/', async (req, res) => {
  const {
    task_id, project_id, subtask_id, employee_id,
    description, start_datetime, end_datetime, is_billable
  } = req.body;
  let { hours_worked } = req.body;

  if (!project_id || !employee_id || !start_datetime || !end_datetime) {
    return res.status(400).json({ error: 'Missing required fields: project_id, employee_id, start_datetime, end_datetime' });
  }

  // Resolve hours_worked as a decimal number for the numeric column
  let hoursDecimal;
  if (!hours_worked) {
    // Auto-calculate from start/end
    const diffMs = new Date(end_datetime) - new Date(start_datetime);
    if (diffMs <= 0) return res.status(400).json({ error: 'end_datetime must be after start_datetime' });
    hoursDecimal = secondsToDecimalHours(Math.floor(diffMs / 1000));
  } else if (typeof hours_worked === 'number') {
    hoursDecimal = hours_worked;
  } else if (typeof hours_worked === 'string' && hours_worked.includes(':')) {
    // "HH:MM:SS" or "HH:MM" → decimal
    hoursDecimal = hmsToDecimalHours(hours_worked);
  } else {
    hoursDecimal = parseFloat(hours_worked) || 0;
  }

  const idempotency_key = uuidv4();
  try {
    const { rows } = await pool.query(
      `INSERT INTO project.time_entry
         (task_id, project_id, subtask_id, employee_id, description,
          start_datetime, end_datetime, hours_worked, is_billable,
          status, directus_sync_status, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'draft','pending',$10)
       RETURNING *`,
      [task_id || null, project_id, subtask_id || null, employee_id,
       description || '', start_datetime, end_datetime,
       hoursDecimal, is_billable || false, idempotency_key]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/time-entries/:id
router.patch('/:id', async (req, res) => {
  // Locked entries (approved+synced) cannot be edited
  try {
    const { rows: existing } = await pool.query(
      `SELECT status, directus_sync_status FROM project.time_entry WHERE id = $1`,
      [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const entry = existing[0];
    if (entry.status === 'approved' && entry.directus_sync_status === 'synced') {
      return res.status(409).json({ error: 'Entry is locked (approved + synced). Create a reversal entry instead.' });
    }

    const fields = ['description','start_datetime','end_datetime','hours_worked','status','is_billable'];
    const updates = [];
    const values = [];
    let i = 1;
    for (const f of fields) {
      if (req.body[f] !== undefined) { updates.push(`${f} = $${i++}`); values.push(req.body[f]); }
    }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE project.time_entry SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/time-entries/:id
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete directus_sync_log rows referencing this time entry first
    await client.query(
      `DELETE FROM project.directus_sync_log WHERE time_entry_id = $1`,
      [req.params.id]
    );

    // Delete the time entry (removed draft-only restriction)
    const { rows } = await client.query(
      `DELETE FROM project.time_entry WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Time entry not found' });
    }

    await client.query('COMMIT');
    res.json({ deleted: rows[0].id });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
