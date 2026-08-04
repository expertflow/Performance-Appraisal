'use strict';
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

function mapRow(r) {
  return {
    id:               r.id,
    jobId:            r.job_id,
    jobTitle:         r.job_title,
    candidateId:      r.candidate_id,
    candidateName:    r.candidate_name,
    candidateEmail:   r.candidate_email,
    candidatePhone:   r.candidate_phone   || '',
    candidateAddress: r.candidate_address || '',
    coverLetter:      r.cover_letter,
    resumeLink:       r.resume_link,
    resumeFileName:   r.resume_file_name  || '',
    linkedinUrl:      r.linkedin_url      || '',
    githubUrl:        r.github_url        || '',
    status:           r.status,
    appliedDate:      r.applied_date ? r.applied_date.toISOString().slice(0, 10) : '',
  };
}

// GET /api/v1/job-applications          — all (HR view)
// GET /api/v1/job-applications?candidate_id=xxx  — filtered by candidate
// GET /api/v1/job-applications?job_id=xxx        — filtered by job
router.get('/', async (req, res) => {
  const { candidate_id, job_id } = req.query;
  const conditions = [];
  const values     = [];
  let i = 1;
  if (candidate_id) { conditions.push(`candidate_id = $${i++}`); values.push(candidate_id); }
  if (job_id)       { conditions.push(`job_id = $${i++}`);       values.push(job_id); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const { rows } = await pool.query(
      `SELECT * FROM recruitment.job_application ${where} ORDER BY created_at DESC`,
      values
    );
    res.json(rows.map(mapRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/job-applications/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM recruitment.job_application WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/job-applications
router.post('/', async (req, res) => {
  const {
    jobId, jobTitle, candidateId, candidateName, candidateEmail,
    candidatePhone, candidateAddress, coverLetter, resumeLink,
    resumeFileName, linkedinUrl, githubUrl,
  } = req.body;

  if (!jobId || !jobTitle || !candidateId || !candidateName || !candidateEmail || !coverLetter || !resumeLink) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Prevent duplicate applications
  try {
    const { rows: existing } = await pool.query(
      `SELECT id FROM recruitment.job_application WHERE job_id = $1 AND candidate_id = $2`,
      [jobId, candidateId]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'You have already applied to this job.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO recruitment.job_application
         (job_id, job_title, candidate_id, candidate_name, candidate_email,
          candidate_phone, candidate_address, cover_letter, resume_link,
          resume_file_name, linkedin_url, github_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Submitted')
       RETURNING *`,
      [
        jobId, jobTitle, candidateId, candidateName, candidateEmail,
        candidatePhone   || '',
        candidateAddress || '',
        coverLetter,
        resumeLink,
        resumeFileName   || '',
        linkedinUrl      || '',
        githubUrl        || '',
      ]
    );
    res.status(201).json(mapRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v1/job-applications/:id  — update status (HR action)
router.patch('/:id', async (req, res) => {
  const { status } = req.body;
  const allowed = ['Submitted', 'Under Review', 'Shortlisted', 'Rejected', 'Hired'];
  if (!status || !allowed.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE recruitment.job_application
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(mapRow(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
