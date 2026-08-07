'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const axios = require('axios');
const https = require('https');

// Reuse a single agent that skips self-signed cert verification (bs4.expertflow.com uses a valid cert
// but some VM environments have SSL chain issues)
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/**
 * Map a Directus Employee record to our local snapshot schema.
 * Exact Directus field names confirmed from live API response (28 fields):
 *   id, email, EmployeeName, employ_start_date, mobile_number, phone_no,
 *   status, RegionCode, DefaultProjectId, ManagerId, Seniority,
 *   Department, Designation, country, LegalEntityId,
 *   personal_email, father_name, emergency_contact_phone,
 *   emergency_contact_name, cnic, date_of_birth, city_area,
 *   address_line, DirectusUser, payslip_policy_id,
 *   bank_account_number, medical_budget, journal_entries
 *
 * NOTE: The screenshot showed "MobileNumber", "PhoneNo", "EmployStartDate"
 * but the actual API uses snake_case: mobile_number, phone_no, employ_start_date
 */
function mapDirectusEmployee(e) {
  // EmployeeName is "First Last" — split on first space
  const name = (e.EmployeeName || '').trim();
  const spaceIdx = name.indexOf(' ');
  const first_name = spaceIdx >= 0 ? name.slice(0, spaceIdx) : name;
  const last_name  = spaceIdx >= 0 ? name.slice(spaceIdx + 1) : '';

  return {
    id:                 String(e.id),
    first_name,
    last_name,
    email:              e.email              || null,
    status:             e.status             || null,
    region_code:        e.RegionCode         || null,
    default_project_id: e.DefaultProjectId != null ? String(e.DefaultProjectId) : null,
    mobile_number:      e.mobile_number      || null,   // snake_case in Directus
    phone_no:           e.phone_no           || null,   // snake_case in Directus
    employ_start_date:  e.employ_start_date  || null,   // snake_case in Directus
    department:         e.Department         || null,
    designation:        e.Designation        || null,
    manager_id:         e.ManagerId != null  ? String(e.ManagerId) : null,
    seniority:          e.Seniority != null
                          ? (typeof e.Seniority === 'object' ? JSON.stringify(e.Seniority) : String(e.Seniority))
                          : null,
    country:            e.country            || null,
    legal_entity_id:    e.LegalEntityId != null ? String(e.LegalEntityId) : null,
  };
}

// Fetch all fields from Directus — using exact field names from live API
// Mixed case: some are PascalCase (EmployeeName, RegionCode, etc.),
// some are snake_case (mobile_number, phone_no, employ_start_date, etc.)
const DIRECTUS_FIELDS = 'id,email,EmployeeName,employ_start_date,mobile_number,phone_no,status,RegionCode,DefaultProjectId,ManagerId,Seniority,Department,Designation,country,LegalEntityId';

// Upsert a single employee into the snapshot table
async function upsertEmployee(e) {
  await pool.query(
    `INSERT INTO project.employee_snapshot
       (id, first_name, last_name, email, status, region_code, default_project_id,
        mobile_number, phone_no, employ_start_date, department, designation,
        manager_id, seniority, country, legal_entity_id, synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW())
     ON CONFLICT (id) DO UPDATE SET
       first_name=EXCLUDED.first_name, last_name=EXCLUDED.last_name,
       email=EXCLUDED.email, status=EXCLUDED.status,
       region_code=EXCLUDED.region_code, default_project_id=EXCLUDED.default_project_id,
       mobile_number=EXCLUDED.mobile_number, phone_no=EXCLUDED.phone_no,
       employ_start_date=EXCLUDED.employ_start_date,
       department=EXCLUDED.department, designation=EXCLUDED.designation,
       manager_id=EXCLUDED.manager_id, seniority=EXCLUDED.seniority,
       country=EXCLUDED.country, legal_entity_id=EXCLUDED.legal_entity_id,
       synced_at=NOW()`,
    [
      e.id, e.first_name, e.last_name, e.email, e.status,
      e.region_code, e.default_project_id, e.mobile_number, e.phone_no,
      e.employ_start_date, e.department, e.designation,
      e.manager_id, e.seniority, e.country, e.legal_entity_id
    ]
  );
}

// GET /api/v1/employees — returns from local snapshot cache, refreshes from Directus if stale
// Query params:
//   search      — filter by name/email/dept/designation/region
//   active_only — if 'true', only return employees with status = 'Employed'
router.get('/', async (req, res) => {
  const { search, active_only } = req.query;
  const activeOnly = active_only === 'true';
  try {
    let query = `SELECT id, first_name, last_name, email, status, region_code,
                        default_project_id, mobile_number, phone_no, employ_start_date,
                        department, designation, manager_id, seniority, country,
                        legal_entity_id, synced_at
                 FROM project.employee_snapshot`;
    const values = [];
    const conditions = [];

    if (search) {
      conditions.push(`(first_name ILIKE $${values.length + 1} OR last_name ILIKE $${values.length + 1} OR email ILIKE $${values.length + 1}
                    OR department ILIKE $${values.length + 1} OR designation ILIKE $${values.length + 1} OR region_code ILIKE $${values.length + 1})`);
      values.push(`%${search}%`);
    }
    if (activeOnly) {
      conditions.push(`LOWER(status) = 'employed'`);
    }
    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
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
          `${process.env.DIRECTUS_URL}/items/Employee?fields=${DIRECTUS_FIELDS}&limit=500${filter}`,
          { headers: { Authorization: `Bearer ${process.env.DIRECTUS_TOKEN}` }, httpsAgent, timeout: 5000 }
        );
        const raw = resp.data?.data ?? [];
        const employees = raw.map(mapDirectusEmployee);
        for (const e of employees) {
          await upsertEmployee(e);
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
    const token = (process.env.DIRECTUS_TOKEN || '').trim();
    const url = (process.env.DIRECTUS_URL || 'https://bs4.expertflow.com').trim();
    console.log('[sync] Using token:', token ? token.substring(0, 10) + '...' : 'EMPTY');
    const resp = await axios.get(
      `${url}/items/Employee?fields=${DIRECTUS_FIELDS}&limit=500`,
      { headers: { Authorization: `Bearer ${token}` }, httpsAgent, timeout: 10000 }
    );
    const raw = resp.data?.data ?? [];
    const employees = raw.map(mapDirectusEmployee);
    for (const e of employees) {
      await upsertEmployee(e);
    }
    res.json({ message: `Synced ${employees.length} employees from Directus.`, count: employees.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
