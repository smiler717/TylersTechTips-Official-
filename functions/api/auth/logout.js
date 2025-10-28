/**
 * Logout Endpoint
 * POST /api/auth/logout
 */

import { json } from '../_utils.js';
import { logout } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '').trim();
    await logout(token, env);
  }

  return json({ success: true, message: 'Logged out successfully' });
}
