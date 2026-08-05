'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// GET /api/v1/tasks?project_id=&status=
router.get('/', async (req, res) => {
  const { project_id, status, parent_task_id } = req.query;
  const conditions = [];
  const values = [];
  let i = 1;
  if (project_id) { conditions.push(`t.project_id = $${i++}`); values.push(project_id); }
  if (status)     { conditions.push(`t.status = $${i++}`);     values.push(status); }
  if (parent_task_id === 'null') {
    conditions.push(`t.parent_task_id IS NULL`);
  } else if (parent_task_id) {
    conditions.push(`t.parent_task_id = $${i++}`);
    values.push(parent_task_id);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(
      `SELECT t.*,
         COALESCE(
           json_agg(s.*) FILTER (WHERE s.id IS NOT NULL), '[]'
         ) AS subtasks
       FROM project.task t
       LEFT JOIN project.task s ON s.parent_task_id = t.id
       ${where}
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      values
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/tasks/:id/subtasks
router.get('/:id/subtasks', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM project.task WHERE parent_task_id = $1 ORDER BY created_at`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/tasks/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM project.task WHERE id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/tasks
router.post('/', async (req, res) => {
  const { project_id, parent_task_id, title, description, priority,
          status, due_date, estimated_hours, created_by } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO project.task
         (project_id, parent_task_id, title, description, priority,
          status, due_date, estimated_hours, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [project_id, parent_task_id || null, title, description,
       priority || 'medium', status || 'todo', due_date, estimated_hours, created_by]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/tasks/:id
router.patch('/:id', async (req, res) => {
  const fields = ['title','description','priority','status','due_date','estimated_hours','actual_hours'];
  const updates = [];
  const values = [];
  let i = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) { updates.push(`${f} = $${i++}`); values.push(req.body[f]); }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE project.task SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`, values
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/tasks/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM project.task WHERE id = $1 RETURNING id`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
