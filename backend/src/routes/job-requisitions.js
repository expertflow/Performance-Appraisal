'use strict';
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// Helper: map DB row → camelCase object
function mapRow(r) {
  return {
    id:             r.id,
    reqNumber:      r.req_number,
    title:          r.title,
    department:     r.department,
    location:       r.location,
    type:           r.type,
    headcount:      r.headcount,
    priority:       r.priority,
    status:         r.status,
    hiringManager:  r.hiring_manager,
    approvalHod:    r.approval_hod,
    approvalHr:     r.approval_hr,
    approvalCfo:    r.approval_cfo,
    postedDate:     r.posted_date ? r.posted_date.toISOString().slice(0, 10) : '',
    notes:          r.notes || '',
    createdAt:      r.created_at,
    updatedAt:      r.updated_at,
  };
}

// GET /api/v1/job-requisitions?status=Open&page=1&limit=10
router.get('/', async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  try {
    let where = '';
    const values = [];
    if (status) {
      where = 'WHERE status = $1';
      values.push(status);
    }
    const countRes = await pool.query(
      `SELECT COUNT(*) FROM recruitment.job_requisition ${where}`, values
    );
    const total = parseInt(countRes.rows[0].count);

    const dataValues = [...values, parseInt(limit), offset];
    const paramOffset = values.length;
    const { rows } = await pool.query(
      `SELECT * FROM recruitment.job_requisition ${where}
       ORDER BY posted_date DESC
       LIMIT $${paramOffset + 1} OFFSET $${paramOffset + 2}`,
      dataValues
    );
    res.json({ total, page: parseInt(page), limit: parseInt(limit), data: rows.map(mapRow) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/job-requisitions/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM recruitment.job_requisition WHERE id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/job-requisitions
router.post('/', async (req, res) => {
  const { title, department, location, type, headcount, priority, hiringManager, notes } = req.body;
  if (!title || !department) {
    return res.status(400).json({ error: 'title and department are required' });
  }
  try {
    // Auto-generate req_number
    const countRes = await pool.query(`SELECT COUNT(*) FROM recruitment.job_requisition`);
    const nextNum = parseInt(countRes.rows[0].count) + 42;
    const reqNumber = `REQ-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;

    const { rows } = await pool.query(
      `INSERT INTO recruitment.job_requisition
         (req_number, title, department, location, type, headcount, priority, status, hiring_manager, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending Approval',$8,$9)
       RETURNING *`,
      [reqNumber, title, department, location || '', type || 'Full-time',
       headcount || 1, priority || 'Normal', hiringManager || '', notes || '']
    );
    res.status(201).json(mapRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/job-requisitions/:id
router.patch('/:id', async (req, res) => {
  const fieldMap = {
    title:          'title',
    department:     'department',
    location:       'location',
    type:           'type',
    headcount:      'headcount',
    priority:       'priority',
    status:         'status',
    hiringManager:  'hiring_manager',
    approvalHod:    'approval_hod',
    approvalHr:     'approval_hr',
    approvalCfo:    'approval_cfo',
    notes:          'notes',
  };
  const updates = [];
  const values  = [];
  let i = 1;
  for (const [jsKey, dbCol] of Object.entries(fieldMap)) {
    if (req.body[jsKey] !== undefined) {
      updates.push(`${dbCol} = $${i++}`);
      values.push(req.body[jsKey]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  updates.push(`updated_at = NOW()`);
  values.push(req.params.id);
  try {
    const { rows } = await pool.query(
      `UPDATE recruitment.job_requisition SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/job-requisitions/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM recruitment.job_requisition WHERE id = $1 RETURNING id`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
