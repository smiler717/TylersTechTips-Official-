/**
 * Badges API Endpoint
 * GET /api/badges - Get all available badges
 * GET /api/badges?userId=123 - Get user's badges
 */

import { json, error } from './_utils.js';
import { getUserBadges } from './_reputation.js';

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestGet({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  try {
    if (userId) {
      // Get specific user's badges
      const badges = await getUserBadges(DB, parseInt(userId, 10));
      return json({ badges });
    } else {
      // Get all available badges
      const badges = await DB.prepare(`
        SELECT * FROM badges
        ORDER BY
          CASE tier
            WHEN 'bronze' THEN 1
            WHEN 'silver' THEN 2
            WHEN 'gold' THEN 3
            WHEN 'platinum' THEN 4
          END,
          criteria_value ASC
      `).all();

      return json({ badges: badges.results || [] });
    }
  } catch (e) {
    console.error('Badges error:', e);
    return error(500, 'Failed to fetch badges');
  }
}
