'use strict';
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

const SITE_URL    = process.env.SITE_URL    || 'https://hrsuite.expertflow.com';
const CAREERS_URL = process.env.CAREERS_URL || 'https://hrsuite.expertflow.com';

// ── Shared helpers ────────────────────────────────────────────────────────────

function mapRow(r) {
  return {
    id:             r.id,
    candidateId:    r.candidate_id,
    candidateName:  r.candidate_name,
    candidateEmail: r.candidate_email,
    jobTitle:       r.job_title,
    role:           r.role,
    dept:           r.dept,
    salary:         r.salary,
    sentDate:       r.sent_date ? r.sent_date.toISOString().slice(0, 10) : '',
    expiryDate:     r.expiry_date ? r.expiry_date.toISOString().slice(0, 10) : '',
    status:         r.status,
    respondedAt:    r.responded_at ? r.responded_at.toISOString() : null,
  };
}

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

/** Push the same notification to HR, AppAdmin, and Manager roles */
async function notifyRecruitmentRoles({ type = 'info', title, body }) {
  for (const role of ['HR', 'AppAdmin', 'Manager']) {
    await pushNotification({ target_role: role, type, title, body });
  }
}

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

/** Fetch all emails for HR, AppAdmin, and Manager roles and send each the given email */
async function emailRecruitmentRoles(subject, html) {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT email FROM auth_local.account
       WHERE role IN ('HR', 'AppAdmin', 'Manager') AND email IS NOT NULL`
    );
    for (const r of rows) {
      await sendEmail(r.email, subject, html);
    }
  } catch (e) {
    console.error('[emailRecruitmentRoles]', e.message);
  }
}

// ── GET /api/v1/job-offers?candidate_id=xxx  — offers for a candidate ─────────
router.get('/', async (req, res) => {
  const { candidate_id } = req.query;
  try {
    let query = 'SELECT * FROM recruitment.job_offer';
    const values = [];
    if (candidate_id) {
      query += ' WHERE candidate_id = $1';
      values.push(candidate_id);
    }
    query += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(query, values);
    res.json(rows.map(mapRow));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/v1/job-offers  — HR creates an offer ───────────────────────────
router.post('/', async (req, res) => {
  const {
    candidateId, candidateName, candidateEmail,
    jobTitle, role, dept, salary, expiryDays,
  } = req.body;

  if (!candidateId || !candidateName || !candidateEmail || !role || !salary) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + (Number(expiryDays) || 7));

  try {
    const { rows } = await pool.query(
      `INSERT INTO recruitment.job_offer
         (candidate_id, candidate_name, candidate_email, job_title, role, dept, salary, expiry_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Pending')
       RETURNING *`,
      [candidateId, candidateName, candidateEmail, jobTitle || role, role, dept || 'Engineering', salary, expiry]
    );
    const offer = rows[0];

    // ── Send email to candidate with accept/reject link ───────────────────────
    const portalUrl = `${CAREERS_URL}/candidate/my-applications`;
    await sendEmail(
      candidateEmail,
      `Offer Letter — ${role} at ExpertFlow`,
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1878cc;">🎉 Congratulations! You Have an Offer</h2>
        <p>Dear ${candidateName},</p>
        <p>We are delighted to extend you an offer for the <strong>${role}</strong> position at ExpertFlow.</p>
        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px 20px;margin:16px 0;">
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:5px 12px 5px 0;font-weight:600;white-space:nowrap;">Position:</td><td>${role}</td></tr>
            ${dept ? `<tr><td style="padding:5px 12px 5px 0;font-weight:600;white-space:nowrap;">Department:</td><td>${dept}</td></tr>` : ''}
            <tr><td style="padding:5px 12px 5px 0;font-weight:600;white-space:nowrap;">Salary Package:</td><td><strong>${salary}</strong></td></tr>
            <tr><td style="padding:5px 12px 5px 0;font-weight:600;white-space:nowrap;">Offer Expiry:</td><td>${expiry.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</td></tr>
          </table>
        </div>
        <p>Please log in to your Careers Portal to <strong>Accept</strong> or <strong>Reject</strong> this offer:</p>
        <p style="text-align:center;margin:24px 0;">
          <a href="${portalUrl}"
             style="background:#1878cc;color:#fff;padding:14px 32px;border-radius:8px;
                    text-decoration:none;display:inline-block;font-size:15px;font-weight:600;">
            View &amp; Respond to Offer →
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">
          If you have any questions, please reply to this email or contact our HR team.<br><br>
          Best regards,<br>ExpertFlow HR Team<br>
          <a href="${CAREERS_URL}">${CAREERS_URL}</a>
        </p>
      </div>`
    );

    res.status(201).json(mapRow(offer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/v1/job-offers/:id/respond  — candidate accepts or rejects ──────
router.patch('/:id/respond', async (req, res) => {
  const { decision } = req.body; // 'Accepted' | 'Rejected'
  if (!['Accepted', 'Rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be Accepted or Rejected' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE recruitment.job_offer
       SET status = $1, responded_at = NOW(), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [decision, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Offer not found' });

    const offer = rows[0];
    const emoji = decision === 'Accepted' ? '🎉' : '❌';

    // ── App notification → HR + AppAdmin + Manager ────────────────────────────
    await notifyRecruitmentRoles({
      type:  decision === 'Accepted' ? 'offer' : 'info',
      title: `${emoji} Offer ${decision}: ${offer.role}`,
      body:  `${offer.candidate_name} has ${decision.toLowerCase()} the offer for "${offer.role}".`,
    });

    // ── Email HR + AppAdmin + Manager ─────────────────────────────────────────
    await emailRecruitmentRoles(
      `${emoji} Offer ${decision} — ${offer.role}`,
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:${decision === 'Accepted' ? '#059669' : '#dc2626'};">
          ${emoji} Offer ${decision}
        </h2>
        <p>The following offer has been <strong>${decision.toLowerCase()}</strong> by the candidate:</p>
        <div style="background:#f8fafc;border-left:4px solid ${decision === 'Accepted' ? '#059669' : '#dc2626'};
                    padding:16px 20px;margin:16px 0;border-radius:4px;">
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Candidate:</td><td>${offer.candidate_name}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Email:</td><td>${offer.candidate_email}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Position:</td><td>${offer.role}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Salary:</td><td>${offer.salary}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Decision:</td><td><strong>${decision}</strong></td></tr>
          </table>
        </div>
        <p>
          <a href="${SITE_URL}/recruitment/offer"
             style="background:#1878cc;color:#fff;padding:12px 24px;border-radius:6px;
                    text-decoration:none;display:inline-block;">
            View Offers Dashboard →
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">Best regards,<br>ExpertFlow HR Suite</p>
      </div>`
    );

    res.json(mapRow(offer));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
