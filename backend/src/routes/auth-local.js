'use strict';
const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');

// ── Ensure OTP table exists ───────────────────────────────────────────────────
async function ensureOtpTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_local.email_otp (
      id         SERIAL PRIMARY KEY,
      email      TEXT NOT NULL,
      otp        TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_email_otp_email ON auth_local.email_otp(email)
  `);
}
ensureOtpTable().catch(e => console.error('[auth-local] OTP table init error:', e.message));

// ── Helper: send email via nodemailer or stub ─────────────────────────────────
async function sendEmail(to, subject, html) {
  if (process.env.SMTP_HOST) {
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
    console.log(`[email] Sent OTP to ${to}`);
  } else {
    // Dev stub — print OTP to console so it can be tested without SMTP
    console.log(`\n📧 [EMAIL STUB] To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Body: ${html.replace(/<[^>]+>/g, '').trim()}\n`);
  }
}

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
    loginMethod: r.password === 'GOOGLE_SSO' ? 'google' : 'local',
  };
}

// ── Helper: resolve role from Directus employee_snapshot ─────────────────────
// Returns 'Manager' if this user's employee record is referenced as manager_id
// by at least one other employee. Returns 'Employee' otherwise.
// Never downgrades AppAdmin — callers must guard that themselves.
async function resolveRoleFromDirectus(email) {
  try {
    // Step 1: find this user's employee_snapshot row by email
    const { rows: empRows } = await pool.query(
      `SELECT id FROM project.employee_snapshot WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    if (!empRows.length) return 'Employee';

    const employeeId = empRows[0].id;

    // Step 2: check if any employee has manager_id = this employee's id
    const { rows: managerRows } = await pool.query(
      `SELECT 1 FROM project.employee_snapshot WHERE manager_id = $1 LIMIT 1`,
      [employeeId]
    );
    return managerRows.length > 0 ? 'Manager' : 'Employee';
  } catch (err) {
    console.warn('[auth] resolveRoleFromDirectus error:', err.message);
    return 'Employee'; // fail-safe: default to Employee
  }
}

// ── POST /api/v1/auth-local/login ─────────────────────────────────────────────
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
    if (account.status === 'Pending') {
      return res.status(403).json({ error: 'Your account is not verified yet. Please check your email for the OTP.' });
    }

    // Auto-assign Manager role based on Directus employee_snapshot
    // AppAdmin is never downgraded; Employee may be promoted to Manager
    let finalRole = account.role;
    if (account.role !== 'AppAdmin') {
      const autoRole = await resolveRoleFromDirectus(account.email);
      if (autoRole === 'Manager') finalRole = 'Manager';
    }

    // Update last_login and role
    await pool.query(
      `UPDATE auth_local.account SET last_login = NOW(), updated_at = NOW(), role = $1 WHERE id = $2`,
      [finalRole, account.id]
    );
    res.json({
      token: account.token,
      user:  mapAccount({ ...account, role: finalRole }),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/v1/auth-local/register ─────────────────────────────────────────
// Creates account with status='Pending', sends OTP email.
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
      `SELECT id, status FROM auth_local.account WHERE LOWER(email) = $1`,
      [emailLc]
    );
    if (existing.length) {
      if (existing[0].status === 'Pending') {
        // Re-send OTP for unverified account
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
        await pool.query(
          `INSERT INTO auth_local.email_otp (email, otp, expires_at) VALUES ($1, $2, $3)`,
          [emailLc, otp, expiresAt]
        );
        await sendEmail(emailLc, 'Your ExpertFlow HR Verification Code', `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
            <h2 style="color:#1a56db;">ExpertFlow HR Suite</h2>
            <p>Your email verification code is:</p>
            <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1a56db;padding:16px 0;">${otp}</div>
            <p style="color:#666;">This code expires in <strong>10 minutes</strong>.</p>
            <p style="color:#999;font-size:12px;">If you did not request this, please ignore this email.</p>
          </div>
        `);
        return res.status(200).json({ pending: true, message: 'A new verification code has been sent to your email.' });
      }
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const newId    = 'u-' + Date.now();
    const empId    = isInternal ? 'emp-' + newId : '';
    const token    = 'local-token-' + newId;

    // Create account with Pending status
    await pool.query(
      `INSERT INTO auth_local.account
         (id, email, password, token, role, name, phone, address, employee_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Pending')`,
      [newId, emailLc, password, token, role, fullName,
       phone   ? phone.trim()   : '',
       address ? address.trim() : '',
       empId]
    );

    // Generate 6-digit OTP, valid 10 minutes
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      `INSERT INTO auth_local.email_otp (email, otp, expires_at) VALUES ($1, $2, $3)`,
      [emailLc, otp, expiresAt]
    );

    // Send OTP email
    await sendEmail(emailLc, 'Your ExpertFlow HR Verification Code', `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#1a56db;">ExpertFlow HR Suite</h2>
        <p>Hi ${fullName},</p>
        <p>Thank you for registering. Your email verification code is:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1a56db;padding:16px 0;">${otp}</div>
        <p style="color:#666;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="color:#999;font-size:12px;">If you did not create this account, please ignore this email.</p>
      </div>
    `);

    res.status(201).json({ pending: true, email: emailLc, message: 'Account created. Please check your email for the verification code.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/v1/auth-local/verify-otp ───────────────────────────────────────
// Verifies OTP, activates account, returns token + user.
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required.' });
  }
  const emailLc = email.trim().toLowerCase();

  try {
    // Find the latest unused, non-expired OTP for this email
    const { rows: otpRows } = await pool.query(
      `SELECT * FROM auth_local.email_otp
       WHERE email = $1 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [emailLc]
    );

    if (!otpRows.length) {
      return res.status(400).json({ error: 'Invalid or expired verification code. Please request a new one.' });
    }

    if (otpRows[0].otp !== otp.trim()) {
      return res.status(400).json({ error: 'Incorrect verification code. Please try again.' });
    }

    // Mark OTP as used
    await pool.query(
      `UPDATE auth_local.email_otp SET used = TRUE WHERE id = $1`,
      [otpRows[0].id]
    );

    // Activate account
    const { rows: accountRows } = await pool.query(
      `UPDATE auth_local.account
       SET status = 'Active', last_login = NOW(), updated_at = NOW()
       WHERE LOWER(email) = $1
       RETURNING *`,
      [emailLc]
    );

    if (!accountRows.length) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const account = accountRows[0];
    res.json({
      token: account.token,
      user:  mapAccount(account),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/v1/auth-local/resend-otp ───────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const emailLc = email.trim().toLowerCase();

  try {
    const { rows } = await pool.query(
      `SELECT * FROM auth_local.account WHERE LOWER(email) = $1`,
      [emailLc]
    );
    if (!rows.length) return res.status(404).json({ error: 'Account not found.' });
    if (rows[0].status === 'Active') return res.status(400).json({ error: 'Account is already verified.' });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await pool.query(
      `INSERT INTO auth_local.email_otp (email, otp, expires_at) VALUES ($1, $2, $3)`,
      [emailLc, otp, expiresAt]
    );
    await sendEmail(emailLc, 'Your ExpertFlow HR Verification Code', `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#1a56db;">ExpertFlow HR Suite</h2>
        <p>Your new verification code is:</p>
        <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1a56db;padding:16px 0;">${otp}</div>
        <p style="color:#666;">This code expires in <strong>10 minutes</strong>.</p>
      </div>
    `);
    res.json({ sent: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/v1/auth-local/set-password ─────────────────────────────────────
// For Google-SSO users who want to set a local password for the first time.
// Authenticated via Bearer token (same token stored in auth_local.account).
router.post('/set-password', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Authorization token required.' });

  const { new_password } = req.body;
  if (!new_password || new_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM auth_local.account WHERE token = $1`,
      [token]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid or expired token.' });

    const account = rows[0];
    if (account.password !== 'GOOGLE_SSO') {
      return res.status(400).json({ error: 'Use the change-password endpoint to update an existing password.' });
    }

    await pool.query(
      `UPDATE auth_local.account SET password = $1, updated_at = NOW() WHERE token = $2`,
      [new_password, token]
    );

    res.json({ message: 'Password set successfully. You can now sign in with your email and password.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/v1/auth-local/change-password ───────────────────────────────────
// For local-password users. Requires current password + new password.
router.post('/change-password', async (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Authorization token required.' });

  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'current_password and new_password are required.' });
  }
  if (new_password.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM auth_local.account WHERE token = $1`,
      [token]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid or expired token.' });

    const account = rows[0];
    if (account.password === 'GOOGLE_SSO') {
      return res.status(400).json({ error: 'Use the set-password endpoint to set a password for your Google account.' });
    }
    if (account.password !== current_password) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    await pool.query(
      `UPDATE auth_local.account SET password = $1, updated_at = NOW() WHERE token = $2`,
      [new_password, token]
    );

    res.json({ message: 'Password changed successfully.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ── POST /api/v1/auth-local/forgot-password ───────────────────────────────────
  // Step 1: Check account exists → send 6-digit OTP to email.
  router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });
    const emailLc = email.trim().toLowerCase();
  
    try {
      // Check if account exists and is Active
      const { rows } = await pool.query(
        `SELECT id, name, status FROM auth_local.account WHERE LOWER(email) = $1`,
        [emailLc]
      );
  
      if (!rows.length) {
        return res.status(404).json({ error: 'Invalid account. Please create an account first.' });
      }
  
      const account = rows[0];
      if (account.status === 'Inactive') {
        return res.status(403).json({ error: 'Your account is inactive. Please contact HR.' });
      }
  
      // Generate 6-digit OTP, valid 10 minutes
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await pool.query(
        `INSERT INTO auth_local.email_otp (email, otp, expires_at) VALUES ($1, $2, $3)`,
        [emailLc, otp, expiresAt]
      );
  
      // Send OTP email
      await sendEmail(emailLc, 'Reset Your ExpertFlow HR Password', `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#1a56db;">ExpertFlow HR Suite</h2>
          <p>Hi ${account.name || emailLc},</p>
          <p>We received a request to reset your password. Your password reset code is:</p>
          <div style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1a56db;padding:16px 0;">${otp}</div>
          <p style="color:#666;">This code expires in <strong>10 minutes</strong>.</p>
          <p style="color:#999;font-size:12px;">If you did not request a password reset, please ignore this email. Your password will not be changed.</p>
        </div>
      `);
  
      res.json({ sent: true, message: 'A password reset code has been sent to your email.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // ── POST /api/v1/auth-local/reset-password ────────────────────────────────────
  // Step 2+3: Verify OTP → set new password.
  router.post('/reset-password', async (req, res) => {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const emailLc = email.trim().toLowerCase();
  
    try {
      // Find the latest unused, non-expired OTP for this email
      const { rows: otpRows } = await pool.query(
        `SELECT * FROM auth_local.email_otp
         WHERE email = $1 AND used = FALSE AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [emailLc]
      );
  
      if (!otpRows.length) {
        return res.status(400).json({ error: 'Invalid or expired reset code. Please request a new one.' });
      }
  
      if (otpRows[0].otp !== otp.trim()) {
        return res.status(400).json({ error: 'Incorrect reset code. Please try again.' });
      }
  
      // Mark OTP as used
      await pool.query(
        `UPDATE auth_local.email_otp SET used = TRUE WHERE id = $1`,
        [otpRows[0].id]
      );
  
      // Update password
      const { rows: updated } = await pool.query(
        `UPDATE auth_local.account
         SET password = $1, updated_at = NOW()
         WHERE LOWER(email) = $2
         RETURNING id`,
        [new_password, emailLc]
      );
  
      if (!updated.length) {
        return res.status(404).json({ error: 'Account not found.' });
      }
  
      res.json({ message: 'Password reset successfully. You can now sign in with your new password.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  module.exports = router;
