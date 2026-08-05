'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const axios = require('axios');

/**
 * Map a Directus Employee record to our local snapshot schema.
 * Directus fields: id, EmployeeName, email, Department, Designation, ManagerId
 * Local fields:    id, first_name, last_name, email, department, job_title, manager_id
 */
function mapDirectusEmployee(e) {
  // EmployeeName is "First Last" — split on first space
  const name = (e.EmployeeName || '').trim();
  const spaceIdx = name.indexOf(' ');
  const first_name = spaceIdx >= 0 ? name.slice(0, spaceIdx) : name;
  const last_name  = spaceIdx >= 0 ? name.slice(spaceIdx + 1) : '';
  return {
    id:         String(e.id),
    first_name,
    last_name,
    email:      e.email || null,
    department: e.Department || null,
    job_title:  e.Designation || null,
    manager_id: e.ManagerId != null ? String(e.ManagerId) : null,
  };
}

// GET /api/v1/employees — returns from local snapshot cache, refreshes from Directus if stale
router.get('/', async (req, res) => {
  const { search } = req.query;
  try {
    // Try local snapshot first
    let query = `SELECT id, first_name, last_name, email, department, job_title, manager_id, synced_at FROM project.employee_snapshot`;
    const values = [];
    if (search) {
      query += ` WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1`;
      values.push(`%${search}%`);
    }
    query += ` ORDER BY first_name, last_name`;
    const { rows } = await pool.query(query, values);

    // If snapshot is empty, try to pull from Directus
    if (rows.length === 0 && process.env.DIRECTUS_TOKEN) {
      try {
        const filter = search
          ? `&filter[EmployeeName][_contains]=${encodeURIComponent(search)}`
          : '';
        const resp = await axios.get(
          `${process.env.DIRECTUS_URL}/items/Employee?fields=id,EmployeeName,email,Department,Designation,ManagerId&limit=500${filter}`,
          { headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` }, timeout: 5000 }
        );
        const raw = resp.data?.data ?? [];
        const employees = raw.map(mapDirectusEmployee);
        // Upsert into snapshot
        for (const e of employees) {
          await pool.query(
            `INSERT INTO project.employee_snapshot (id, first_name, last_name, email, department, job_title, manager_id, synced_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
             ON CONFLICT (id) DO UPDATE SET
               first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
               email=EXCLUDED.email, department=EXCLUDED.department,
               job_title=EXCLUDED.job_title, manager_id=EXCLUDED.manager_id, synced_at=NOW()`,
            [e.id, e.first_name, e.last_name, e.email, e.department, e.job_title, e.manager_id]
          );
        }
        return res.json(employees);
      } catch (directusErr) {
        console.warn('Directus employee fetch failed:', directusErr.message);
      }
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/employees/sync — force refresh from Directus
router.post('/sync', async (req, res) => {
  if (!process.env.DIRECTUS_TOKEN) {
    return res.status(400).json({ error: 'DIRECTUS_TOKEN not configured' });
  }
  try {
    const resp = await axios.get(
      `${process.env.DIRECTUS_URL}/items/Employee?fields=id,EmployeeName,email,Department,Designation,ManagerId&limit=500`,
      { headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` }, timeout: 10000 }
    );
    const raw = resp.data?.data ?? [];
    const employees = raw.map(mapDirectusEmployee);
    for (const e of employees) {
      await pool.query(
        `INSERT INTO project.employee_snapshot (id, first_name, last_name, email, department, job_title, manager_id, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
         ON CONFLICT (id) DO UPDATE SET
           first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
           email=EXCLUDED.email, department=EXCLUDED.department,
           job_title=EXCLUDED.job_title, manager_id=EXCLUDED.manager_id, synced_at=NOW()`,
        [e.id, e.first_name, e.last_name, e.email, e.department, e.job_title, e.manager_id]
      );
    }
    res.json({ message: `Synced ${employees.length} employees from Directus.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
