'use strict';
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');

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
         row_to_json(e.*) AS employee
       FROM project.time_entry te
       LEFT JOIN project.employee_snapshot e ON e.id = te.employee_id
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

// POST /api/v1/time-entries
router.post('/', async (req, res) => {
  const {
    task_id, project_id, subtask_id, employee_id,
    description, start_datetime, end_datetime, hours_worked, is_billable
  } = req.body;

  if (!project_id || !employee_id || !start_datetime || !end_datetime || !hours_worked) {
    return res.status(400).json({ error: 'Missing required fields: project_id, employee_id, start_datetime, end_datetime, hours_worked' });
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
       hours_worked, is_billable || false, idempotency_key]
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

// DELETE /api/v1/time-entries/:id (only draft entries)
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM project.time_entry WHERE id = $1 AND status = 'draft' RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(409).json({ error: 'Cannot delete: entry not found or not in draft status' });
    res.json({ deleted: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
