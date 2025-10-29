/**
 * Leaderboard API Endpoint
 * GET /api/leaderboard - Get top users by reputation
 */

import { json, error } from './_utils.js';
import { getLeaderboard } from './_reputation.js';

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
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

  // Check cache
  const kv = env.CACHE || env.TYLERS_TECH_KV;
  const cacheKey = `leaderboard:${limit}:${offset}`;
  
  if (kv) {
    const cached = await kv.get(cacheKey);
    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const users = await getLeaderboard(DB, limit, offset);

    const response = json({ users, total: users.length });

    // Cache for 5 minutes
    if (kv) {
      await kv.put(cacheKey, await response.clone().text(), { expirationTtl: 300 });
    }

    return response;

  } catch (e) {
    console.error('Leaderboard error:', e);
    return error(500, 'Failed to fetch leaderboard');
  }
}
