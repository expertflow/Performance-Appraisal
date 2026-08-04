'use strict';
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// ── Auto-create tables on first use ──────────────────────────────────────────

async function ensureTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS project.appraisal_cycles (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'Annual',
      period_start DATE,
      period_end   DATE,
      review_start DATE,
      review_end   DATE,
      phase        TEXT NOT NULL DEFAULT 'Upcoming',
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS project.appraisal_records (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      cycle_id        TEXT REFERENCES project.appraisal_cycles(id) ON DELETE CASCADE,
      employee_id     TEXT NOT NULL,
      employee_name   TEXT NOT NULL,
      manager_id      TEXT NOT NULL,
      department      TEXT,
      rating          NUMERIC(3,1),
      self_review     TEXT,
      manager_review  TEXT,
      goals_met       INTEGER DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'draft',
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS project.appraisal_goals (
      id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      record_id   TEXT REFERENCES project.appraisal_records(id) ON DELETE CASCADE,
      employee_id TEXT NOT NULL,
      manager_id  TEXT NOT NULL,
      title       TEXT NOT NULL,
      description TEXT,
      department  TEXT,
      category    TEXT DEFAULT 'Technical',
      progress    INTEGER DEFAULT 0,
      due_date    DATE,
      status      TEXT DEFAULT 'On Track',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

ensureTables().catch(e => console.error('[Appraisal] table init error:', e.message));

// ── Helper ────────────────────────────────────────────────────────────────────

function mapRecord(r) {
  return {
    id:             r.id,
    cycleId:        r.cycle_id,
    cycleName:      r.cycle_name ?? '',
    employeeId:     r.employee_id,
    employeeName:   r.employee_name,
    managerId:      r.manager_id,
    department:     r.department ?? '',
    rating:         r.rating ? parseFloat(r.rating) : null,
    selfReview:     r.self_review ?? '',
    managerReview:  r.manager_review ?? '',
    goalsMet:       r.goals_met ?? 0,
    status:         r.status,
    createdAt:      r.created_at,
    updatedAt:      r.updated_at,
  };
}

function mapGoal(g) {
  return {
    id:          g.id,
    recordId:    g.record_id,
    employeeId:  g.employee_id,
    managerId:   g.manager_id,
    title:       g.title,
    description: g.description ?? '',
    department:  g.department ?? '',
    category:    g.category ?? 'Technical',
    progress:    g.progress ?? 0,
    dueDate:     g.due_date ? g.due_date.toISOString().split('T')[0] : null,
    status:      g.status ?? 'On Track',
    createdAt:   g.created_at,
    updatedAt:   g.updated_at,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CYCLES
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/appraisals/cycles
router.get('/cycles', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM project.appraisal_cycles ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/appraisals/cycles
router.post('/cycles', async (req, res) => {
  const { name, type, period_start, period_end, review_start, review_end } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO project.appraisal_cycles (name, type, period_start, period_end, review_start, review_end, phase)
       VALUES ($1,$2,$3,$4,$5,$6,'Upcoming') RETURNING *`,
      [name, type || 'Annual', period_start || null, period_end || null, review_start || null, review_end || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/appraisals/cycles/:id
router.patch('/cycles/:id', async (req, res) => {
  const { id } = req.params;
  const { phase, name, type } = req.body;
  try {
    const sets = [];
    const vals = [];
    let i = 1;
    if (phase !== undefined) { sets.push(`phase=$${i++}`); vals.push(phase); }
    if (name  !== undefined) { sets.push(`name=$${i++}`);  vals.push(name); }
    if (type  !== undefined) { sets.push(`type=$${i++}`);  vals.push(type); }
    if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE project.appraisal_cycles SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// APPRAISAL RECORDS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/appraisals/records?managerId=&employeeId=&cycleId=
router.get('/records', async (req, res) => {
  const { managerId, employeeId, cycleId } = req.query;
  try {
    const conditions = [];
    const vals = [];
    let i = 1;

    if (managerId)  { conditions.push(`r.manager_id=$${i++}`);  vals.push(managerId); }
    if (employeeId) { conditions.push(`r.employee_id=$${i++}`); vals.push(employeeId); }
    if (cycleId)    { conditions.push(`r.cycle_id=$${i++}`);    vals.push(cycleId); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT r.*, c.name AS cycle_name
       FROM project.appraisal_records r
       LEFT JOIN project.appraisal_cycles c ON c.id = r.cycle_id
       ${where}
       ORDER BY r.created_at DESC`,
      vals
    );
    res.json(rows.map(mapRecord));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/appraisals/records
router.post('/records', async (req, res) => {
  const { cycleId, employeeId, employeeName, managerId, department, selfReview, managerReview, rating, goalsMet, status } = req.body;
  if (!employeeId || !employeeName || !managerId) {
    return res.status(400).json({ error: 'employeeId, employeeName, managerId are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO project.appraisal_records
         (cycle_id, employee_id, employee_name, manager_id, department, self_review, manager_review, rating, goals_met, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [cycleId || null, employeeId, employeeName, managerId, department || '', selfReview || '', managerReview || '', rating || null, goalsMet || 0, status || 'draft']
    );
    res.status(201).json(mapRecord(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/appraisals/records/:id
router.patch('/records/:id', async (req, res) => {
  const { id } = req.params;
  const { selfReview, managerReview, rating, goalsMet, status } = req.body;
  try {
    const sets = [`updated_at=NOW()`];
    const vals = [];
    let i = 1;
    if (selfReview   !== undefined) { sets.push(`self_review=$${i++}`);   vals.push(selfReview); }
    if (managerReview !== undefined) { sets.push(`manager_review=$${i++}`); vals.push(managerReview); }
    if (rating       !== undefined) { sets.push(`rating=$${i++}`);        vals.push(rating); }
    if (goalsMet     !== undefined) { sets.push(`goals_met=$${i++}`);     vals.push(goalsMet); }
    if (status       !== undefined) { sets.push(`status=$${i++}`);        vals.push(status); }
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE project.appraisal_records SET ${sets.join(',')} WHERE id=$${i}
       RETURNING *, (SELECT name FROM project.appraisal_cycles WHERE id=cycle_id) AS cycle_name`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(mapRecord(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/appraisals/records/:id
router.delete('/records/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM project.appraisal_records WHERE id=$1`, [req.params.id]);
    res.json({ deleted: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GOALS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/appraisals/goals?managerId=&employeeId=
router.get('/goals', async (req, res) => {
  const { managerId, employeeId } = req.query;
  try {
    const conditions = [];
    const vals = [];
    let i = 1;
    if (managerId)  { conditions.push(`manager_id=$${i++}`);  vals.push(managerId); }
    if (employeeId) { conditions.push(`employee_id=$${i++}`); vals.push(employeeId); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM project.appraisal_goals ${where} ORDER BY created_at DESC`, vals
    );
    res.json(rows.map(mapGoal));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/appraisals/goals
router.post('/goals', async (req, res) => {
  const { recordId, employeeId, managerId, title, description, department, category, dueDate } = req.body;
  if (!employeeId || !managerId || !title) {
    return res.status(400).json({ error: 'employeeId, managerId, title are required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO project.appraisal_goals
         (record_id, employee_id, manager_id, title, description, department, category, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [recordId || null, employeeId, managerId, title, description || '', department || '', category || 'Technical', dueDate || null]
    );
    res.status(201).json(mapGoal(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/appraisals/goals/:id
router.patch('/goals/:id', async (req, res) => {
  const { id } = req.params;
  const { progress, status, title, description } = req.body;
  try {
    const sets = [`updated_at=NOW()`];
    const vals = [];
    let i = 1;
    if (progress    !== undefined) { sets.push(`progress=$${i++}`);    vals.push(progress); }
    if (status      !== undefined) { sets.push(`status=$${i++}`);      vals.push(status); }
    if (title       !== undefined) { sets.push(`title=$${i++}`);       vals.push(title); }
    if (description !== undefined) { sets.push(`description=$${i++}`); vals.push(description); }
    vals.push(id);
    const { rows } = await pool.query(
      `UPDATE project.appraisal_goals SET ${sets.join(',')} WHERE id=$${i} RETURNING *`, vals
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(mapGoal(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v1/appraisals/goals/:id
router.delete('/goals/:id', async (req, res) => {
  try {
    await pool.query(`DELETE FROM project.appraisal_goals WHERE id=$1`, [req.params.id]);
    res.json({ deleted: req.params.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEAM MEMBERS — returns employees whose manager_id matches the given managerId
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/v1/appraisals/team?managerId=
router.get('/team', async (req, res) => {
  const { managerId } = req.query;
  if (!managerId) return res.status(400).json({ error: 'managerId is required' });
  try {
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, department, job_title, manager_id
       FROM project.employee_snapshot
       WHERE manager_id = $1
       ORDER BY first_name, last_name`,
      [managerId]
    );
    res.json(rows.map(r => ({
      id:         r.id,
      firstName:  r.first_name,
      lastName:   r.last_name,
      fullName:   `${r.first_name} ${r.last_name}`.trim(),
      email:      r.email,
      department: r.department ?? '',
      jobTitle:   r.job_title ?? '',
      managerId:  r.manager_id ?? '',
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
