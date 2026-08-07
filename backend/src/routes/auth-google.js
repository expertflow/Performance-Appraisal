'use strict';
/**
 * Google OAuth 2.0 login route
 *
 * Flow:
 *   1. Browser hits GET /api/v1/auth/google  → redirected to Google consent screen
 *   2. Google redirects back to GET /api/v1/auth/google/callback
 *   3. We find-or-create the user in auth_local.account
 *   4. We redirect the browser to the Angular app with token + user JSON in query params
 *
 * Required .env vars:
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   APP_URL   (e.g. https://hrsuite.expertflow.com)
 *   ALLOWED_DOMAIN  (optional, e.g. expertflow.com — restricts to one domain)
 */

const express  = require('express');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const pool     = require('../db/pool');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const CLIENT_ID      = process.env.GOOGLE_CLIENT_ID     || '';
const CLIENT_SECRET  = process.env.GOOGLE_CLIENT_SECRET || '';
const APP_URL        = process.env.APP_URL               || 'https://hrsuite.expertflow.com';
const INTERNAL_DOMAIN = process.env.INTERNAL_DOMAIN     || 'expertflow.com';
const CALLBACK_URL   = `${APP_URL}/api/v1/auth/google/callback`;

// ── Helper: resolve role from Directus employee_snapshot ─────────────────────
// Returns 'Manager' if the user's employee record is referenced as manager_id
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

// ── Only register strategy if credentials are configured ─────────────────────
if (CLIENT_ID && CLIENT_SECRET) {
  passport.use('google', new GoogleStrategy(
    {
      clientID:     CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      callbackURL:  CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email  = profile.emails?.[0]?.value?.toLowerCase() || '';
        const name   = profile.displayName || email.split('@')[0];
        const avatar = profile.photos?.[0]?.value || '';

        // Determine if this is an internal (org) user or external (candidate)
        const isInternal = email.endsWith(`@${INTERNAL_DOMAIN}`);

        // Find existing account by email (covers both local + previous Google logins)
        const { rows } = await pool.query(
          `SELECT * FROM auth_local.account WHERE email = $1`,
          [email]
        );

        if (rows.length > 0) {
          // ── Existing account: merge / link ──────────────────────────────────
          const existing = rows[0];

          let newRole = existing.role;
          if (isInternal) {
            // Internal users: upgrade role from Directus if applicable
            const autoRole = await resolveRoleFromDirectus(email);
            newRole = existing.role === 'AppAdmin' ? 'AppAdmin'
                    : (autoRole === 'Manager' ? 'Manager' : existing.role);
          }
          // External users keep their existing role (Candidate or whatever was set)

          await pool.query(
            `UPDATE auth_local.account SET last_login = NOW(), avatar_url = $1, role = $2 WHERE email = $3`,
            [avatar, newRole, email]
          );
          return done(null, { ...existing, role: newRole, avatar_url: avatar });
        }

        // ── New account: create ────────────────────────────────────────────────
        const id    = `u-${uuidv4()}`;
        const token = `google-token-${uuidv4()}`;

        let role;
        if (isInternal) {
          // Internal: resolve Manager vs Employee from Directus
          role = await resolveRoleFromDirectus(email) || 'Employee';
        } else {
          // External Gmail: always Candidate
          role = 'Candidate';
        }

        const { rows: newRows } = await pool.query(
          `INSERT INTO auth_local.account
             (id, email, password, token, role, name, avatar_url, status, last_login)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active', NOW())
           RETURNING *`,
          [id, email, 'GOOGLE_SSO', token, role, name, avatar]
        );
        return done(null, newRows[0]);
      } catch (err) {
        return done(err);
      }
    }
  ));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id, done) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM auth_local.account WHERE id = $1`, [id]
      );
      done(null, rows[0] || null);
    } catch (err) {
      done(err);
    }
  });

  // ── GET /api/v1/auth/google ─────────────────────────────────────────────────
  router.get('/',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
  );

  // ── GET /api/v1/auth/google/callback ────────────────────────────────────────
  router.get('/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${APP_URL}/login?error=google_denied` }),
    (req, res) => {
      const user = req.user;
      if (!user) {
        return res.redirect(`${APP_URL}/login?error=google_failed`);
      }

      // Build the user payload the Angular AuthService expects
      const userPayload = {
        id:          user.id,
        email:       user.email,
        name:        user.name,
        role:        user.role,
        employee_id: user.employee_id || '',
        manager_id:  user.manager_id  || '',
        avatar_url:  user.avatar_url  || '',
        loginMethod: 'google',
      };

      const token = user.token;

      // Redirect to Angular with token + user encoded in query params
      const params = new URLSearchParams({
        token,
        user: JSON.stringify(userPayload),
      });
      res.redirect(`${APP_URL}/auth/google-callback?${params.toString()}`);
    }
  );

} else {
  // Credentials not configured — return helpful error
  router.get('/', (req, res) => {
    res.status(503).json({
      error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env'
    });
  });
  router.get('/callback', (req, res) => {
    res.redirect(`${APP_URL}/login?error=google_not_configured`);
  });
}

module.exports = router;
