/**
 * User Login Endpoint
 * POST /api/auth/login
 */

import { json, error, readJson } from '../_utils.js';
import { verifyPassword, generateToken } from '../_auth.js';

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key, Authorization',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestPost({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const body = await readJson(request);
  if (!body) return error(400, 'Invalid JSON');

  const usernameOrEmail = (body.username || body.email || '').toLowerCase().trim();
  const password = body.password || '';

  if (!usernameOrEmail || !password) {
    return error(400, 'Username/email and password required');
  }

  try {
    // Basic IP-based throttle: block excessive failed attempts
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const kv = env.RATE_LIMIT || env.TYLERS_TECH_KV;
    const attemptKey = `login-attempts:${ip}:${usernameOrEmail}`;
    if (kv) {
      const cur = parseInt((await kv.get(attemptKey)) || '0', 10) || 0;
      if (cur >= 5) {
        return error(429, 'Too many login attempts. Please try again later.');
      }
    }

    // Find user by username or email
    let user;
    try {
      user = await DB.prepare(`
        SELECT id, username, email, password_hash, display_name, bio, avatar_url, email_verified
        FROM users
        WHERE username = ? OR email = ?
      `).bind(usernameOrEmail, usernameOrEmail).first();
    } catch (_) {
      user = await DB.prepare(`
        SELECT id, username, email, password_hash, display_name, bio, avatar_url
        FROM users
        WHERE username = ? OR email = ?
      `).bind(usernameOrEmail, usernameOrEmail).first();
      user.email_verified = 0;
    }

    if (!user) {
      // Track failed attempt
      if (kv) {
        const cur = parseInt((await kv.get(attemptKey)) || '0', 10) || 0;
        await kv.put(attemptKey, String(cur + 1), { expirationTtl: 15 * 60 });
      }
      return error(401, 'Invalid credentials');
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      // Track failed attempt
      if (kv) {
        const cur = parseInt((await kv.get(attemptKey)) || '0', 10) || 0;
        await kv.put(attemptKey, String(cur + 1), { expirationTtl: 15 * 60 });
      }
      return error(401, 'Invalid credentials');
    }

    // Optionally update last login if column exists (ignore if not present)
    try {
      await DB.prepare('UPDATE users SET last_login = ? WHERE id = ?')
        .bind(Date.now(), user.id).run();
    } catch (e) {
      // no-op if column does not exist
    }

    // Generate token
    const { token, expiresAt } = await generateToken(user.id, user.username, env);

    // Reset attempts on success
    if (kv) {
      await kv.delete(attemptKey);
    }

    return json({
      success: true,
      token,
      expiresAt,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name || user.username,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        emailVerified: !!user.email_verified
      }
    });

  } catch (e) {
    console.error('Login error:', e);
    return error(500, 'Login failed');
  }
}
