/**
 * Token Refresh (Rotate)
 * POST /api/auth/refresh
 */

import { json, error } from '../_utils.js';
import { getCurrentUser, rotateToken } from '../_auth.js';

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key, Authorization',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestPost({ request, env }) {
  // Must have a valid current token to rotate
  const authHeader = request.headers.get('Authorization') || '';
  const oldToken = authHeader.replace('Bearer ', '').trim();
  if (!oldToken) return error(401, 'Not authenticated');

  const user = await getCurrentUser(request, env);
  if (!user) return error(401, 'Not authenticated');

  const rotated = await rotateToken(oldToken, env);
  if (!rotated) return error(400, 'Invalid token');
  return json({ success: true, token: rotated.token, expiresAt: rotated.expiresAt });
}
