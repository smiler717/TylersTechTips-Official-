/**
 * CSRF Token Endpoint
 * GET /api/csrf - Get CSRF token for current session
 */

import { json, error } from './_utils.js';
import { getCurrentUser } from './_auth.js';
import { getCsrfTokenForSession } from './_csrf.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestGet({ request, env }) {
  // Get current user session
  const currentUser = await getCurrentUser(request, env);
  
  if (!currentUser) {
    return error(401, 'Authentication required');
  }

  // Use userId as session identifier
  const sessionId = `user:${currentUser.userId}`;
  
  const csrfToken = await getCsrfTokenForSession(env, sessionId);

  if (!csrfToken) {
    return error(500, 'Failed to generate CSRF token');
  }

  return json({ 
    csrfToken,
    expiresIn: 3600 // 1 hour in seconds
  });
}
