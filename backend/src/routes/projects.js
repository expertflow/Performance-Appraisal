'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const axios = require('axios');

const DIRECTUS_URL   = () => process.env.DIRECTUS_URL  || 'https://bs4.expertflow.com';
const DIRECTUS_TOKEN = () => process.env.DIRECTUS_TOKEN || '';

/**
 * Map a Directus Project record to our local project schema.
 * Directus fields: id (int), Name, Status, Description
 * Local fields:    name, type, status, health_status, bs4_project_id
 */
function mapDirectusProject(p) {
  // Map Directus Status → local status
  const statusMap = {
    'Active':   'active',
    'Open':     'active',
    'On Hold':  'on_hold',
    'Closed':   'completed',
    'Cancelled':'cancelled',
  };
  const localStatus = statusMap[p.Status] || 'active';

  return {
    bs4_project_id: String(p.id),
    name:           (p.Name || '').trim() || `Project ${p.id}`,
    type:           'client',   // Directus doesn't have a type field — default to client
    status:         localStatus,
    health_status:  null,
    description:    p.Description || null,
  };
}

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

// DELETE /api/v1/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM project.project WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json({ deleted: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/projects/sync — pull projects from Directus and upsert locally
// Only syncs non-Closed projects (Active/Open/On Hold) to keep the list manageable.
// Uses bs4_project_id as the dedup key; local UUID is generated on first insert.
router.post('/sync', async (req, res) => {
  if (!DIRECTUS_TOKEN()) {
    return res.status(400).json({ error: 'DIRECTUS_TOKEN not configured' });
  }
  try {
    let page = 1;
    const limit = 500;
    let total = 0;
    let synced = 0;

    while (true) {
      const url = `${DIRECTUS_URL()}/items/Project?fields=id,Name,Status,Description&limit=${limit}&page=${page}&filter[Status][_nin]=Closed,Cancelled&sort=id`;
      const resp = await axios.get(url, {
        headers: { Authorization: `Bearer ${DIRECTUS_TOKEN()}` },
        timeout: 20000
      });
      const items = resp.data?.data ?? [];
      if (!items.length) break;

      for (const p of items) {
        const mapped = mapDirectusProject(p);
        await pool.query(
          `INSERT INTO project.project
             (name, type, status, health_status, bs4_project_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (bs4_project_id) DO UPDATE SET
             name          = EXCLUDED.name,
             status        = EXCLUDED.status,
             health_status = EXCLUDED.health_status,
             updated_at    = NOW()`,
          [mapped.name, mapped.type, mapped.status, mapped.health_status, mapped.bs4_project_id]
        );
        synced++;
      }

      total += items.length;
      if (items.length < limit) break;
      page++;
    }

    res.json({ message: `Synced ${synced} projects from Directus.`, total });
  } catch (err) {
    console.error('[projects/sync] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
