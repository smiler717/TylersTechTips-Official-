/**
 * Admin Users Management
 * GET /api/admin/users - List all users
 * DELETE /api/admin/users/:id - Delete user
 */

import { json, error, isAdmin } from '../_utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestGet({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const admin = await isAdmin(request, env);
  if (!admin) return error(403, 'Admin access required');

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

  try {
    const result = await DB.prepare(`
      SELECT id, username, email, display_name, created_at, last_login, email_verified
      FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();

    const countResult = await DB.prepare(
      'SELECT COUNT(*) as total FROM users'
    ).first();

    return json({
      users: result.results || [],
      total: countResult?.total || 0,
      limit,
      offset
    });
  } catch (e) {
    console.error('List users error:', e);
    return error(500, 'Failed to list users');
  }
}
