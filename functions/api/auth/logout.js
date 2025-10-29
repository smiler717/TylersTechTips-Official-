/**
 * Logout Endpoint
 * POST /api/auth/logout
 */

import { json } from '../_utils.js';
import { logout } from '../_auth.js';

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key, Authorization',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestPost({ request, env }) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '').trim();
    await logout(token, env);
  }

  return json({ success: true, message: 'Logged out successfully' });
}
