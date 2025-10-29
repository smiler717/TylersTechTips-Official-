/**
 * Logout Endpoint
 * POST /api/auth/logout
 */

import { json } from '../_utils.js';
import { logout, getCurrentUser } from '../_auth.js';
import { logAudit, getRequestMetadata, AuditAction } from '../_audit.js';

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key, Authorization',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestPost({ request, env }) {
  // Get current user before logout
  const currentUser = await getCurrentUser(request, env);
  
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '').trim();
    await logout(token, env);
  }

  // Audit logout
  if (currentUser) {
    const { ipAddress, userAgent } = getRequestMetadata(request);
    await logAudit(env, {
      userId: currentUser.userId,
      action: AuditAction.LOGOUT,
      resourceType: 'user',
      resourceId: String(currentUser.userId),
      ipAddress,
      userAgent
    });
  }

  return json({ success: true, message: 'Logged out successfully' });
}
