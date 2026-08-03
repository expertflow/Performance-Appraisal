'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const axios = require('axios');

// GET /api/v1/employees — returns from local snapshot cache, refreshes from Directus if stale
router.get('/', async (req, res) => {
  const { search } = req.query;
  try {
    // Try local snapshot first
    let query = `SELECT * FROM project.employee_snapshot`;
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
          ? `&filter[_or][0][first_name][_contains]=${encodeURIComponent(search)}&filter[_or][1][last_name][_contains]=${encodeURIComponent(search)}`
          : '';
        const resp = await axios.get(
          `${process.env.DIRECTUS_URL}/items/employee?fields=id,first_name,last_name,email,department,job_title${filter}`,
          { headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` }, timeout: 5000 }
        );
        const employees = resp.data?.data ?? [];
        // Upsert into snapshot
        for (const e of employees) {
          await pool.query(
            `INSERT INTO project.employee_snapshot (id, first_name, last_name, email, department, job_title, synced_at)
             VALUES ($1,$2,$3,$4,$5,$6,NOW())
             ON CONFLICT (id) DO UPDATE SET
               first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
               email=EXCLUDED.email, department=EXCLUDED.department,
               job_title=EXCLUDED.job_title, synced_at=NOW()`,
            [e.id, e.first_name, e.last_name, e.email, e.department, e.job_title]
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
      `${process.env.DIRECTUS_URL}/items/employee?fields=id,first_name,last_name,email,department,job_title&limit=500`,
      { headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` }, timeout: 10000 }
    );
    const employees = resp.data?.data ?? [];
    for (const e of employees) {
      await pool.query(
        `INSERT INTO project.employee_snapshot (id, first_name, last_name, email, department, job_title, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())
         ON CONFLICT (id) DO UPDATE SET
           first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
           email=EXCLUDED.email, department=EXCLUDED.department,
           job_title=EXCLUDED.job_title, synced_at=NOW()`,
        [e.id, e.first_name, e.last_name, e.email, e.department, e.job_title]
      );
    }
    res.json({ message: `Synced ${employees.length} employees from Directus.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
