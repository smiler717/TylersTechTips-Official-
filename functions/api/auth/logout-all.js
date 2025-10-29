/**
 * Logout All Devices Endpoint
 * POST /api/auth/logout-all
 */

import { json, error } from '../_utils.js';
import { getCurrentUser, logoutAllForUser } from '../_auth.js';

export async function onRequestOptions({ request }) {
  // Rely on global CORS headers via json helper; respond to OPTIONS quickly
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key, Authorization',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestPost({ request, env }) {
  const user = await getCurrentUser(request, env);
  if (!user) return error(401, 'Not authenticated');
  try {
    const count = await logoutAllForUser(user.userId, env);
    return json({ success: true, revoked: count });
  } catch (e) {
    console.error('logout-all error:', e);
    return error(500, 'Failed to logout all devices');
  }
}
