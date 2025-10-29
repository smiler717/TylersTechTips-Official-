/**
 * User Registration Endpoint
 * POST /api/auth/register
 */

import { json, error, readJson } from '../_utils.js';
import { sanitizeText } from '../_sanitize.js';
import { hashPassword, isValidEmail, isValidUsername } from '../_auth.js';
import { logAudit, getRequestMetadata, AuditAction } from '../_audit.js';
import { validateCsrf } from '../_csrf-middleware.js';

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key, Authorization, x-csrf-token',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestPost({ request, env }) {
  // Validate CSRF token
  const deviceId = request.headers.get('x-device-id');
  if (!deviceId) {
    return error(400, 'Device ID required');
  }
  const csrfValid = await validateCsrf(request, env, deviceId);
  if (!csrfValid) {
    return error(403, 'Invalid CSRF token');
  }
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const body = await readJson(request);
  if (!body) return error(400, 'Invalid JSON');

  const username = sanitizeText(body.username || '', 20)?.toLowerCase();
  const email = sanitizeText(body.email || '', 100)?.toLowerCase();
  const password = body.password || '';
  const displayName = sanitizeText(body.displayName || username, 60);

  // Validation
  if (!username || !isValidUsername(username)) {
    return error(400, 'Username must be 3-20 characters (letters, numbers, _ or -)');
  }
  if (!email || !isValidEmail(email)) {
    return error(400, 'Invalid email address');
  }
  if (password.length < 8) {
    return error(400, 'Password must be at least 8 characters');
  }
  // Stronger password policy: require upper, lower, number, special
  const complexity = [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/];
  const okComplex = complexity.every((re) => re.test(password));
  if (!okComplex) {
    return error(400, 'Password must include uppercase, lowercase, number, and special character');
  }

  try {
    // Attempt to add email verification columns if absent (idempotent)
    try {
      await DB.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0`);
    } catch (_) {}
    try {
      await DB.exec(`ALTER TABLE users ADD COLUMN verification_token TEXT`);
    } catch (_) {}
    try {
      await DB.exec(`ALTER TABLE users ADD COLUMN verification_expires INTEGER`);
    } catch (_) {}

    const verificationToken = crypto.randomUUID();
    const verificationExpires = Date.now() + (7 * 24 * 60 * 60 * 1000);
    // Rate limit registrations per IP
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const kv = env.RATE_LIMIT || env.TYLERS_TECH_KV;
    const rlKey = `register:${ip}`;
    if (kv) {
      const last = await kv.get(rlKey);
      if (last) {
        return error(429, 'Please wait before creating another account');
      }
    }

    // Check if username or email already exists
    const existing = await DB.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).bind(username, email).first();

    if (existing) {
      return error(409, 'Username or email already taken');
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const createdAt = Date.now();

    // Try inserting with verification columns first; fall back if schema lacks them
    try {
      await DB.prepare(`
        INSERT INTO users (username, email, password_hash, display_name, created_at, email_verified, verification_token, verification_expires)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?)
      `).bind(username, email, passwordHash, displayName, createdAt, verificationToken, verificationExpires).run();
    } catch (_) {
      await DB.prepare(`
        INSERT INTO users (username, email, password_hash, display_name, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).bind(username, email, passwordHash, displayName, createdAt).run();
    }

    // Get the new user row (with auto-incremented id)
    const user = await DB.prepare(
      'SELECT id, username, display_name FROM users WHERE username = ?'
    ).bind(username).first();

    // Set short cooldown on registration to discourage abuse
    if (kv) {
      await kv.put(rlKey, String(Date.now()), { expirationTtl: 60 });
    }

    // Audit successful registration
    const { ipAddress, userAgent } = getRequestMetadata(request);
    await logAudit(env, {
      userId: user.id,
      action: AuditAction.REGISTER,
      resourceType: 'user',
      resourceId: String(user.id),
      ipAddress,
      userAgent,
      metadata: { username, email }
    });

    const payload = { success: true, user };
    // Provide a development-time verification link if token stored
    payload.verify = {
      token: verificationToken,
      // Using a relative path; frontend or external email service can build a link
      endpoint: `/api/auth/verify-email?token=${verificationToken}`
    };

    return json(payload, { status: 201 });

  } catch (e) {
    console.error('Registration error:', e);
    return error(500, 'Failed to create account');
  }
}
