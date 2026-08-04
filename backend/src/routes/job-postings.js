'use strict';
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

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
    // Normalise: map snake_case DB columns → camelCase for Angular
    const mapped = rows.map(r => ({
      id:           r.id,
      title:        r.title,
      department:   r.department,
      location:     r.location,
      type:         r.type,
      status:       r.status,
      description:  r.description,
      requirements: r.requirements || [],
      postedDate:   r.posted_date   ? r.posted_date.toISOString().slice(0, 10) : '',
      deadline:     r.deadline      ? r.deadline.toISOString().slice(0, 10)    : '',
    }));
    res.json(mapped);
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
    const r = rows[0];
    res.json({
      id:           r.id,
      title:        r.title,
      department:   r.department,
      location:     r.location,
      type:         r.type,
      status:       r.status,
      description:  r.description,
      requirements: r.requirements || [],
      postedDate:   r.posted_date  ? r.posted_date.toISOString().slice(0, 10) : '',
      deadline:     r.deadline     ? r.deadline.toISOString().slice(0, 10)    : '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/job-postings
router.post('/', async (req, res) => {
  const { title, department, location, type, status, description, requirements, deadline } = req.body;
  if (!title || !department || !location || !type) {
    return res.status(400).json({ error: 'Missing required fields: title, department, location, type' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO recruitment.job_posting
         (title, department, location, type, status, description, requirements, deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
      ]
    );
    const r = rows[0];
    res.status(201).json({
      id:           r.id,
      title:        r.title,
      department:   r.department,
      location:     r.location,
      type:         r.type,
      status:       r.status,
      description:  r.description,
      requirements: r.requirements || [],
      postedDate:   r.posted_date  ? r.posted_date.toISOString().slice(0, 10) : '',
      deadline:     r.deadline     ? r.deadline.toISOString().slice(0, 10)    : '',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/job-postings/:id
router.patch('/:id', async (req, res) => {
  const allowed = ['title', 'department', 'location', 'type', 'status', 'description', 'requirements', 'deadline'];
  const updates = [];
  const values  = [];
  let i = 1;
  for (const f of allowed) {
    if (req.body[f] !== undefined) {
      const col = f === 'postedDate' ? 'posted_date' : f;
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
    const r = rows[0];
    res.json({
      id:           r.id,
      title:        r.title,
      department:   r.department,
      location:     r.location,
      type:         r.type,
      status:       r.status,
      description:  r.description,
      requirements: r.requirements || [],
      postedDate:   r.posted_date  ? r.posted_date.toISOString().slice(0, 10) : '',
      deadline:     r.deadline     ? r.deadline.toISOString().slice(0, 10)    : '',
    });
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
