/**
 * Verify Email Endpoint
 * GET /api/auth/verify-email?token=...
 */

import { json, error } from '../_utils.js';

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key, Authorization',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestGet({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');
  const url = new URL(request.url);
  const token = (url.searchParams.get('token') || '').trim();
  if (!token) return error(400, 'Missing token');
  try {
    let user;
    try {
      user = await DB.prepare('SELECT id, verification_expires FROM users WHERE verification_token = ?')
        .bind(token).first();
    } catch (_) {
      return error(400, 'Verification not supported');
    }
    if (!user) return error(400, 'Invalid or expired token');
    if (user.verification_expires && user.verification_expires < Date.now()) {
      return error(400, 'Token expired');
    }
    await DB.prepare('UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL WHERE id = ?')
      .bind(user.id).run();
    return json({ success: true });
  } catch (e) {
    console.error('verify-email error:', e);
    return error(500, 'Verification failed');
  }
}
