'use strict';
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// Ensure auto_shortlist_threshold column exists (idempotent)
async function ensureThresholdColumn() {
  try {
    await pool.query(`
      ALTER TABLE recruitment.job_posting
        ADD COLUMN IF NOT EXISTS auto_shortlist_threshold INTEGER NOT NULL DEFAULT 0
    `);
  } catch (e) {
    console.error('[job-postings] ensureThresholdColumn:', e.message);
  }
}
ensureThresholdColumn();

function mapRow(r) {
  return {
    id:                     r.id,
    title:                  r.title,
    department:             r.department,
    location:               r.location,
    type:                   r.type,
    status:                 r.status,
    description:            r.description,
    requirements:           r.requirements || [],
    postedDate:             r.posted_date   ? r.posted_date.toISOString().slice(0, 10) : '',
    deadline:               r.deadline      ? r.deadline.toISOString().slice(0, 10)    : '',
    autoShortlistThreshold: r.auto_shortlist_threshold ?? 0,
  };
}

// GET /api/v1/job-postings?status=Open
router.get('/', async (req, res) => {
  const { status } = req.query;
  try {
    let query = `SELECT * FROM recruitment.job_posting`;
    const values = [];
    if (status) {
      query += ` WHERE status = $1`;
      values.push(status);
    }
    query += ` ORDER BY posted_date DESC`;
    const { rows } = await pool.query(query, values);
    res.json(rows.map(mapRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/job-postings/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM recruitment.job_posting WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/job-postings
router.post('/', async (req, res) => {
  const { title, department, location, type, status, description, requirements, deadline, autoShortlistThreshold } = req.body;
  if (!title || !department || !location || !type) {
    return res.status(400).json({ error: 'Missing required fields: title, department, location, type' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO recruitment.job_posting
         (title, department, location, type, status, description, requirements, deadline, auto_shortlist_threshold)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        title,
        department,
        location,
        type,
        status || 'Open',
        description || '',
        JSON.stringify(requirements || []),
        deadline || null,
        autoShortlistThreshold ?? 0,
      ]
    );
    res.status(201).json(mapRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/job-postings/:id
router.patch('/:id', async (req, res) => {
  const allowed = ['title', 'department', 'location', 'type', 'status', 'description', 'requirements', 'deadline', 'autoShortlistThreshold'];
  const updates = [];
  const values  = [];
  let i = 1;
  for (const f of allowed) {
    if (req.body[f] !== undefined) {
      let col = f;
      if (f === 'postedDate')             col = 'posted_date';
      if (f === 'autoShortlistThreshold') col = 'auto_shortlist_threshold';
      const val = f === 'requirements' ? JSON.stringify(req.body[f]) : req.body[f];
      updates.push(`${col} = $${i++}`);
      values.push(val);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE recruitment.job_posting SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/job-postings/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM recruitment.job_posting WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
