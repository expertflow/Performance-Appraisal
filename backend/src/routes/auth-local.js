'use strict';
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

function mapAccount(r) {
  return {
    id:          r.id,
    email:       r.email,
    name:        r.name,
    role:        r.role,
    phone:       r.phone       || '',
    address:     r.address     || '',
    employee_id: r.employee_id || '',
    manager_id:  r.manager_id  || '',
    avatar_url:  r.avatar_url  || '',
  };
}

// POST /api/v1/auth-local/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT * FROM auth_local.account WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    if (!rows.length || rows[0].password !== password) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const account = rows[0];
    if (account.status === 'Inactive') {
      return res.status(403).json({ error: 'Your account is inactive. Please contact HR.' });
    }
    // Update last_login
    await pool.query(
      `UPDATE auth_local.account SET last_login = NOW(), updated_at = NOW() WHERE id = $1`,
      [account.id]
    );
    res.json({
      token: account.token,
      user:  mapAccount(account),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/auth-local/register
router.post('/register', async (req, res) => {
  const { firstName, lastName, email, phone, address, password } = req.body;
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'First name, last name, email, and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const fullName = `${firstName.trim()} ${lastName.trim()}`;
  const emailLc  = email.trim().toLowerCase();
  const isInternal = emailLc.endsWith('@expertflow.com');
  const role = isInternal ? 'Employee' : 'Candidate';

  try {
    // Check duplicate
    const { rows: existing } = await pool.query(
      `SELECT id FROM auth_local.account WHERE LOWER(email) = $1`,
      [emailLc]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const newId    = 'u-' + Date.now();
    const empId    = isInternal ? 'emp-' + newId : '';
    const token    = 'local-token-' + newId;

    const { rows } = await pool.query(
      `INSERT INTO auth_local.account
         (id, email, password, token, role, name, phone, address, employee_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Active')
       RETURNING *`,
      [newId, emailLc, password, token, role, fullName,
       phone   ? phone.trim()   : '',
       address ? address.trim() : '',
       empId]
    );
    const account = rows[0];
    res.status(201).json({
      token: account.token,
      user:  mapAccount(account),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
