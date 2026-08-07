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

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Insert an app_notification row */
async function pushNotification({ target_role = 'HR', target_user_id = null, type = 'info', title, body }) {
  try {
    await pool.query(
      `INSERT INTO app_notifications (target_role, target_user_id, type, title, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [target_role, target_user_id || null, type, title, body]
    );
  } catch (e) {
    console.error('[pushNotification]', e.message);
  }
}

/** Send email via nodemailer (uses same SMTP env vars as auth-local) */
async function sendEmail(to, subject, html) {
  if (!process.env.SMTP_HOST) {
    console.log(`\n📧 [EMAIL STUB] To: ${to}\n   Subject: ${subject}\n`);
    return;
  }
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"ExpertFlow HR" <hr@expertflow.com>',
      to, subject, html,
    });
    console.log(`[email] Sent to ${to}: ${subject}`);
  } catch (e) {
    console.error('[sendEmail]', e.message);
  }
}

const SITE_URL = process.env.SITE_URL || 'https://hrsuite.expertflow.com';
const CAREERS_URL = process.env.CAREERS_URL || 'https://hrsuite.expertflow.com';

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

    const app = rows[0];

    // ── Notify HR (app notification only) ────────────────────────────────────
    await pushNotification({
      target_role: 'HR',
      type:        'application',
      title:       `New Application: ${jobTitle}`,
      body:        `${candidateName} has applied for "${jobTitle}".`,
    });

    res.status(201).json(mapRow(app));
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

    const app = rows[0];

    // ── Notify candidate: app notification (targeted by candidateId) ──────────
    // Look up the candidate's app user id so the notification is targeted
    const { rows: userRows } = await pool.query(
      `SELECT id FROM auth_local.account WHERE id = $1 LIMIT 1`,
      [app.candidate_id]
    );
    const candidateUserId = userRows.length ? userRows[0].id : null;

    await pushNotification({
      target_role:    'Candidate',
      target_user_id: candidateUserId,
      type:           'status',
      title:          `Application Status Updated: ${app.job_title}`,
      body:           `Your application for "${app.job_title}" has been updated to: ${status}. Visit the careers portal to check your application status.`,
    });

    // ── Email candidate ───────────────────────────────────────────────────────
    const statusMessages = {
      'Under Review': 'Your application is now under review by our HR team.',
      'Shortlisted':  'Congratulations! You have been shortlisted for this position.',
      'Rejected':     'After careful consideration, we have decided to move forward with other candidates at this time. We appreciate your interest and encourage you to apply for future openings.',
      'Hired':        'Congratulations! We are delighted to offer you this position. Our HR team will be in touch shortly with next steps.',
      'Submitted':    'Your application has been received.',
    };
    const statusMsg = statusMessages[status] || `Your application status has been updated to: ${status}.`;

    await sendEmail(
      app.candidate_email,
      `Application Update — ${app.job_title}`,
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1878cc;">Application Status Update</h2>
        <p>Dear ${app.candidate_name},</p>
        <p>Your application for <strong>${app.job_title}</strong> at ExpertFlow has been updated.</p>
        <div style="background:#f8fafc;border-left:4px solid #1878cc;padding:16px;margin:16px 0;border-radius:4px;">
          <strong>New Status: ${status}</strong><br>
          <span style="color:#64748b;">${statusMsg}</span>
        </div>
        <p>
          <a href="${CAREERS_URL}/candidate/my-applications"
             style="background:#1878cc;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
            View My Applications
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">Best regards,<br>ExpertFlow HR Team<br><a href="${CAREERS_URL}">${CAREERS_URL}</a></p>
      </div>`
    );

    res.json(mapRow(app));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
