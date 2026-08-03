'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// GET /api/v1/projects
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM project.project ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/projects/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM project.project WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/projects
router.post('/', async (req, res) => {
  const { name, type, status, health_status, start_date, end_date,
          budget_hours, budget_amount, bs4_project_id, created_by } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO project.project
         (name, type, status, health_status, start_date, end_date,
          budget_hours, budget_amount, bs4_project_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [name, type, status || 'active', health_status, start_date, end_date,
       budget_hours, budget_amount, bs4_project_id, created_by]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/projects/:id
router.patch('/:id', async (req, res) => {
  const fields = ['name','type','status','health_status','start_date','end_date',
                  'budget_hours','budget_amount'];
  const updates = [];
  const values = [];
  let i = 1;
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = $${i++}`);
      values.push(req.body[f]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE project.project SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
