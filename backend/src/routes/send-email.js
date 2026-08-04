'use strict';
const express = require('express');
const router  = express.Router();

/**
 * POST /api/v1/send-email
 * Body: { to, subject, html }
 *
 * Uses nodemailer if SMTP_HOST is configured, otherwise logs to console (dev stub).
 */
router.post('/', async (req, res) => {
  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'to, subject and html are required' });
  }

  // ── Nodemailer (real send) ─────────────────────────────────────────────────
  if (process.env.SMTP_HOST) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host:   process.env.SMTP_HOST,
        port:   Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `"ExpertFlow HR" <hr@expertflow.com>`,
        to,
        subject,
        html,
      });
      console.log(`[email] Sent to ${to}: ${subject}`);
      return res.json({ sent: true });
    } catch (err) {
      console.error('[email] Send failed:', err.message);
      return res.status(500).json({ error: 'Email send failed', detail: err.message });
    }
  }

  // ── Dev stub (no SMTP configured) ─────────────────────────────────────────
  console.log(`\n📧 [EMAIL STUB] To: ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Body preview: ${html.replace(/<[^>]+>/g, '').slice(0, 120)}…\n`);
  return res.json({ sent: true, stub: true });
});

module.exports = router;
