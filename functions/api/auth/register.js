/**
 * User Registration Endpoint
 * POST /api/auth/register
 */

import { json, error, readJson } from '../_utils.js';
import { sanitizeText } from '../_sanitize.js';
import { hashPassword, isValidEmail, isValidUsername } from '../_auth.js';

export async function onRequestPost({ request, env }) {
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

  try {
    // Check if username or email already exists
    const existing = await DB.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).bind(username, email).first();

    if (existing) {
      return error(409, 'Username or email already taken');
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    const createdAt = Date.now();

    await DB.prepare(`
      INSERT INTO users (id, username, email, password_hash, display_name, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(userId, username, email, passwordHash, displayName, createdAt).run();

    return json({
      success: true,
      user: {
        id: userId,
        username,
        displayName
      }
    }, { status: 201 });

  } catch (e) {
    console.error('Registration error:', e);
    return error(500, 'Failed to create account');
  }
}
