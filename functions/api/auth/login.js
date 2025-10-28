/**
 * User Login Endpoint
 * POST /api/auth/login
 */

import { json, error, readJson } from '../_utils.js';
import { verifyPassword, generateToken } from '../_auth.js';

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
    // Find user by username or email
    const user = await DB.prepare(`
      SELECT id, username, email, password_hash, display_name, bio, avatar_url
      FROM users
      WHERE username = ? OR email = ?
    `).bind(usernameOrEmail, usernameOrEmail).first();

    if (!user) {
      return error(401, 'Invalid credentials');
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      return error(401, 'Invalid credentials');
    }

    // Update last login
    await DB.prepare('UPDATE users SET last_login = ? WHERE id = ?')
      .bind(Date.now(), user.id).run();

    // Generate token
    const { token, expiresAt } = await generateToken(user.id, user.username, env);

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
        avatarUrl: user.avatar_url
      }
    });

  } catch (e) {
    console.error('Login error:', e);
    return error(500, 'Login failed');
  }
}
