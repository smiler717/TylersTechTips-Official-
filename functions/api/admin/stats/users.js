/**
 * Admin Stats
 * GET /api/admin/stats/users - Get user statistics
 */

import { json, error, isAdmin } from '../../_utils.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestGet({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const admin = await isAdmin(request, env);
  if (!admin) return error(403, 'Admin access required');

  try {
    const totalResult = await DB.prepare(
      'SELECT COUNT(*) as total FROM users'
    ).first();

    const verifiedResult = await DB.prepare(
      'SELECT COUNT(*) as verified FROM users WHERE email_verified = 1'
    ).first();

    const last30DaysResult = await DB.prepare(
      'SELECT COUNT(*) as recent FROM users WHERE created_at > ?'
    ).bind(Date.now() - (30 * 24 * 60 * 60 * 1000)).first();

    return json({
      total: totalResult?.total || 0,
      verified: verifiedResult?.verified || 0,
      last30Days: last30DaysResult?.recent || 0
    });
  } catch (e) {
    console.error('Get user stats error:', e);
    return error(500, 'Failed to get user statistics');
  }
}
