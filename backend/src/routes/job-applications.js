'use strict';
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const https   = require('https');

// ── Ensure ai_score / ai_summary columns exist ────────────────────────────────
async function ensureAiColumns() {
  try {
    await pool.query(`
      ALTER TABLE recruitment.job_application
        ADD COLUMN IF NOT EXISTS ai_score   INTEGER,
        ADD COLUMN IF NOT EXISTS ai_summary TEXT NOT NULL DEFAULT ''
    `);
  } catch (e) {
    console.error('[job-applications] ensureAiColumns:', e.message);
  }
}
ensureAiColumns();

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
    aiScore:          r.ai_score    ?? null,
    aiSummary:        r.ai_summary  || '',
  };
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Insert an app_notification row for a single role */
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

/**
 * Push the same notification to HR, AppAdmin, and Manager roles.
 * target_user_id is ignored for role-broadcast notifications.
 */
async function notifyRecruitmentRoles({ type = 'info', title, body }) {
  for (const role of ['HR', 'AppAdmin', 'Manager']) {
    await pushNotification({ target_role: role, type, title, body });
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

/**
 * Fetch all email addresses for HR, AppAdmin, and Manager roles,
 * then send each of them the given email.
 */
async function emailRecruitmentRoles(subject, html) {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT email FROM auth_local.account
       WHERE role IN ('HR', 'AppAdmin', 'Manager') AND email IS NOT NULL AND status = 'Active'`
    );
    for (const r of rows) {
      await sendEmail(r.email, subject, html);
    }
  } catch (e) {
    console.error('[emailRecruitmentRoles]', e.message);
  }
}

// ── Claude AI helper (same logic as ai-screen.js) ────────────────────────────

const CLAUDE_MODEL = 'claude-opus-4-5';

function callClaudeApi(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length':    Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => { data += chunk; });
      resp.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
          }
          const content = parsed.content?.[0]?.text;
          if (!content) return reject(new Error('Empty response from Claude API'));

          // Extract JSON from the response (handle markdown code blocks)
          const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
          const jsonStr = jsonMatch[1].trim();
          const aiResult = JSON.parse(jsonStr);
          resolve(aiResult);
        } catch (e) {
          reject(new Error(`Failed to parse Claude response: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Auto-screen a newly submitted application using Claude AI.
 * Fetches the job posting requirements + threshold, calls Claude,
 * stores ai_score + ai_summary, and auto-shortlists if score >= threshold.
 */
async function autoScreenApplication(appId, jobId, resumeLink, coverLetter, jobTitle) {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.log('[auto-screen] CLAUDE_API_KEY not set — skipping AI screening');
    return;
  }

  // Fetch job posting for requirements + threshold
  let requirements = [];
  let threshold = 0;
  try {
    const { rows: jobRows } = await pool.query(
      `SELECT requirements, auto_shortlist_threshold FROM recruitment.job_posting WHERE id = $1`,
      [jobId]
    );
    if (!jobRows.length) {
      console.log(`[auto-screen] Job ${jobId} not found — skipping`);
      return;
    }
    requirements = jobRows[0].requirements || [];
    threshold    = jobRows[0].auto_shortlist_threshold ?? 0;
  } catch (e) {
    console.error('[auto-screen] Failed to fetch job posting:', e.message);
    return;
  }

  if (!requirements.length) {
    console.log(`[auto-screen] Job ${jobId} has no requirements — skipping`);
    return;
  }

  const candidateContent = [
    resumeLink   ? `RESUME (base64 PDF data — candidate uploaded CV):\n${resumeLink.slice(0, 2000)}` : '',
    coverLetter  ? `COVER LETTER:\n${coverLetter}` : '',
  ].filter(Boolean).join('\n\n');

  if (!candidateContent.trim()) {
    console.log(`[auto-screen] App ${appId} has no resume/cover letter — skipping`);
    return;
  }

  const requirementsList = requirements
    .map((r, i) => `${i + 1}. ${typeof r === 'string' ? r : r.text || JSON.stringify(r)}`)
    .join('\n');

  const systemPrompt = `You are an expert HR recruiter and resume screener. 
Analyze the candidate's resume and cover letter against the job requirements.
For each requirement, provide a match score from 0 to 100 and a brief reason.
Respond ONLY with valid JSON in this exact format:
{
  "requirements": [
    { "name": "requirement text", "score": 85, "reason": "brief explanation" }
  ],
  "overallScore": 78,
  "summary": "2-3 sentence overall assessment"
}`;

  const userPrompt = `Job Title: ${jobTitle || 'Not specified'}

JOB REQUIREMENTS:
${requirementsList}

CANDIDATE PROFILE:
${candidateContent}

Evaluate how well this candidate meets each requirement. Be objective and specific.`;

  const payload = JSON.stringify({
    model:      CLAUDE_MODEL,
    max_tokens: 1500,
    system:     systemPrompt,
    messages:   [{ role: 'user', content: userPrompt }],
  });

  try {
    console.log(`[auto-screen] Screening application ${appId} for job ${jobId}…`);
    const result = await callClaudeApi(apiKey, payload);
    const overallScore = result.overallScore ?? 0;
    const summary      = result.summary      || '';

    // Store ai_score + ai_summary
    await pool.query(
      `UPDATE recruitment.job_application
       SET ai_score = $1, ai_summary = $2, updated_at = NOW()
       WHERE id = $3`,
      [overallScore, summary, appId]
    );
    console.log(`[auto-screen] App ${appId} scored ${overallScore}% (threshold: ${threshold}%)`);

    // Auto-shortlist if score >= threshold and threshold > 0
    if (threshold > 0 && overallScore >= threshold) {
      await pool.query(
        `UPDATE recruitment.job_application
         SET status = 'Shortlisted', updated_at = NOW()
         WHERE id = $1`,
        [appId]
      );
      console.log(`[auto-screen] App ${appId} AUTO-SHORTLISTED (score ${overallScore} >= threshold ${threshold})`);

      // Notify HR/AppAdmin/Manager about auto-shortlist
      notifyRecruitmentRoles({
        type:  'application',
        title: `AI Auto-Shortlisted: ${jobTitle}`,
        body:  `A candidate was automatically shortlisted for "${jobTitle}" with an AI score of ${overallScore}%.`,
      }).catch(e => console.error('[auto-screen notify]', e.message));
    }
  } catch (e) {
    console.error(`[auto-screen] Failed for app ${appId}:`, e.message);
  }
}

const SITE_URL    = process.env.SITE_URL    || 'https://hrsuite.expertflow.com';
const CAREERS_URL = process.env.CAREERS_URL || 'https://hrsuite.expertflow.com';

// POST /api/v1/job-applications/:id/screen  — manually trigger AI screening for an existing application
router.post('/:id/screen', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM recruitment.job_application WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const app = rows[0];

    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'CLAUDE_API_KEY not configured on server' });
    }

    // Fetch job posting for requirements + threshold
    const { rows: jobRows } = await pool.query(
      `SELECT requirements, auto_shortlist_threshold FROM recruitment.job_posting WHERE id = $1`,
      [app.job_id]
    );
    if (!jobRows.length) {
      return res.status(400).json({ error: 'Job posting not found' });
    }
    const requirements = jobRows[0].requirements || [];
    const threshold    = jobRows[0].auto_shortlist_threshold ?? 0;

    if (!requirements.length) {
      return res.status(400).json({ error: 'No requirements found for this job posting. Please add requirements to the job first.' });
    }

    const candidateContent = [
      app.resume_link  ? `RESUME (base64 PDF data — candidate uploaded CV):\n${app.resume_link.slice(0, 2000)}` : '',
      app.cover_letter ? `COVER LETTER:\n${app.cover_letter}` : '',
    ].filter(Boolean).join('\n\n');

    if (!candidateContent.trim()) {
      return res.status(400).json({ error: 'No resume or cover letter available for screening' });
    }

    const requirementsList = requirements
      .map((r, i) => `${i + 1}. ${typeof r === 'string' ? r : r.text || JSON.stringify(r)}`)
      .join('\n');

    const systemPrompt = `You are an expert HR recruiter and resume screener.
Analyze the candidate's resume and cover letter against the job requirements.
For each requirement, provide a match score from 0 to 100 and a brief reason.
Respond ONLY with valid JSON in this exact format:
{
  "requirements": [
    { "name": "requirement text", "score": 85, "reason": "brief explanation" }
  ],
  "overallScore": 78,
  "summary": "2-3 sentence overall assessment"
}`;

    const userPrompt = `Job Title: ${app.job_title || 'Not specified'}

JOB REQUIREMENTS:
${requirementsList}

CANDIDATE PROFILE:
${candidateContent}

Evaluate how well this candidate meets each requirement. Be objective and specific.`;

    const payload = JSON.stringify({
      model:      CLAUDE_MODEL,
      max_tokens: 1500,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    });

    const result = await callClaudeApi(apiKey, payload);
    const overallScore = result.overallScore ?? 0;
    const summary      = result.summary      || '';

    // Store ai_score + ai_summary
    await pool.query(
      `UPDATE recruitment.job_application
       SET ai_score = $1, ai_summary = $2, updated_at = NOW()
       WHERE id = $3`,
      [overallScore, summary, app.id]
    );

    // Auto-shortlist if score >= threshold and threshold > 0
    if (threshold > 0 && overallScore >= threshold) {
      await pool.query(
        `UPDATE recruitment.job_application
         SET status = 'Shortlisted', updated_at = NOW()
         WHERE id = $1`,
        [app.id]
      );
    }

    // Return updated application + full AI result
    const { rows: updated } = await pool.query(
      `SELECT * FROM recruitment.job_application WHERE id = $1`,
      [app.id]
    );
    res.json({ application: mapRow(updated[0]), aiResult: result });
  } catch (err) {
    console.error('[screen]', err.message);
    res.status(500).json({ error: err.message || 'AI screening failed' });
  }
});

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

    // ── Respond immediately — notifications/emails/AI fire in background ──────
    res.status(201).json(mapRow(app));

    // ── Auto-screen CV with AI (fire-and-forget) ──────────────────────────────
    autoScreenApplication(app.id, jobId, resumeLink, coverLetter, jobTitle)
      .catch(e => console.error('[auto-screen fire-and-forget]', e.message));

    // ── Notify HR + AppAdmin + Manager (fire-and-forget) ─────────────────────
    notifyRecruitmentRoles({
      type:  'application',
      title: `New Application: ${jobTitle}`,
      body:  `${candidateName} has applied for "${jobTitle}".`,
    }).catch(e => console.error('[app notify]', e.message));

    // ── Email HR + AppAdmin + Manager (fire-and-forget) ───────────────────────
    emailRecruitmentRoles(
      `New Application — ${jobTitle}`,
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1878cc;">📋 New Job Application</h2>
        <p>A new application has been submitted:</p>
        <div style="background:#f8fafc;border-left:4px solid #1878cc;padding:16px 20px;margin:16px 0;border-radius:4px;">
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Candidate:</td><td>${candidateName}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Email:</td><td>${candidateEmail}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Position:</td><td>${jobTitle}</td></tr>
          </table>
        </div>
        <p>
          <a href="${SITE_URL}/recruitment/pipeline"
             style="background:#1878cc;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
            View in Pipeline →
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">Best regards,<br>ExpertFlow HR Suite</p>
      </div>`
    ).catch(e => console.error('[app email]', e.message));
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

    // ── Respond immediately — notifications/emails fire in background ─────────
    res.json(mapRow(app));

    // ── Notify candidate (fire-and-forget) ────────────────────────────────────
    pool.query(`SELECT id FROM auth_local.account WHERE id = $1 LIMIT 1`, [app.candidate_id])
      .then(({ rows: userRows }) => {
        const candidateUserId = userRows.length ? userRows[0].id : null;
        return pushNotification({
          target_role:    'Candidate',
          target_user_id: candidateUserId,
          type:           'status',
          title:          `Application Status Updated: ${app.job_title}`,
          body:           `Your application for "${app.job_title}" has been updated to: ${status}. Visit the careers portal to check your application status.`,
        });
      })
      .catch(e => console.error('[candidate notify]', e.message));

    // ── Notify HR + AppAdmin + Manager (fire-and-forget) ─────────────────────
    notifyRecruitmentRoles({
      type:  'status',
      title: `Application Status Changed: ${app.job_title}`,
      body:  `${app.candidate_name}'s application for "${app.job_title}" was moved to: ${status}.`,
    }).catch(e => console.error('[status notify]', e.message));

    // ── Email candidate (fire-and-forget) ─────────────────────────────────────
    const statusMessages = {
      'Under Review': 'Your application is now under review by our HR team.',
      'Shortlisted':  'Congratulations! You have been shortlisted for this position.',
      'Rejected':     'After careful consideration, we have decided to move forward with other candidates at this time. We appreciate your interest and encourage you to apply for future openings.',
      'Hired':        'Congratulations! We are delighted to offer you this position. Our HR team will be in touch shortly with next steps.',
      'Submitted':    'Your application has been received.',
    };
    const statusMsg = statusMessages[status] || `Your application status has been updated to: ${status}.`;

    sendEmail(
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
    ).catch(e => console.error('[candidate email]', e.message));

    // ── Email HR + AppAdmin + Manager (fire-and-forget) ───────────────────────
    emailRecruitmentRoles(
      `Application Status Changed — ${app.job_title}`,
      `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h2 style="color:#1878cc;">📋 Application Status Changed</h2>
        <p>An application status has been updated:</p>
        <div style="background:#f8fafc;border-left:4px solid #1878cc;padding:16px 20px;margin:16px 0;border-radius:4px;">
          <table style="border-collapse:collapse;width:100%;">
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Candidate:</td><td>${app.candidate_name}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Email:</td><td>${app.candidate_email}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">Position:</td><td>${app.job_title}</td></tr>
            <tr><td style="padding:4px 12px 4px 0;font-weight:600;">New Status:</td><td><strong>${status}</strong></td></tr>
          </table>
        </div>
        <p>
          <a href="${SITE_URL}/recruitment/pipeline"
             style="background:#1878cc;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">
            View in Pipeline →
          </a>
        </p>
        <p style="color:#64748b;font-size:13px;">Best regards,<br>ExpertFlow HR Suite</p>
      </div>`
    ).catch(e => console.error('[status email]', e.message));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /:id — HR / AppAdmin only ─────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `DELETE FROM recruitment.job_application WHERE id = $1 RETURNING id`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Application not found' });
    res.json({ ok: true, id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
