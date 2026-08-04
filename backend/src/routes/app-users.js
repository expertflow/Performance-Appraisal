'use strict';
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

function mapUser(r) {
  return {
    id:          r.id,
    name:        r.name,
    email:       r.email,
    role:        r.role,
    department:  r.department  || '',
    designation: r.designation || '',
    employee_id: r.employee_id || '',
    status:      r.status,
    lastLogin:   r.last_login  ? r.last_login.toISOString() : '',
    phone:       r.phone       || '',
    address:     r.address     || '',
  };
}

// GET /api/v1/app-users
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM auth_local.account ORDER BY created_at ASC`
    );
    res.json(rows.map(mapUser));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/app-users/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM auth_local.account WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapUser(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/app-users/:id
router.patch('/:id', async (req, res) => {
  const allowed = ['name', 'role', 'department', 'designation', 'employee_id', 'status', 'phone', 'address'];
  const updates = [];
  const values  = [];
  let i = 1;
  for (const f of allowed) {
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
      `UPDATE auth_local.account SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapUser(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/app-users/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM auth_local.account WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
