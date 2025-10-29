/**
 * Get Current User Profile
 * GET /api/auth/me
 */

import { json, error } from '../_utils.js';
import { getCurrentUser } from '../_auth.js';

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key, Authorization',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestGet({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const currentUser = await getCurrentUser(request, env);
  if (!currentUser) {
    return error(401, 'Not authenticated');
  }

  try {
    let user;
    try {
      user = await DB.prepare(`
        SELECT id, username, email, display_name, bio, avatar_url, created_at, last_login, email_verified
        FROM users
        WHERE id = ?
      `).bind(currentUser.userId).first();
    } catch (e) {
      // Fallback for schema without last_login or email_verified
      user = await DB.prepare(`
        SELECT id, username, email, display_name, bio, avatar_url, created_at
        FROM users
        WHERE id = ?
      `).bind(currentUser.userId).first();
      user.last_login = null;
      user.email_verified = 0;
    }

    if (!user) {
      return error(404, 'User not found');
    }

    return json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name || user.username,
        bio: user.bio,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
        lastLogin: user.last_login,
        emailVerified: !!user.email_verified
      }
    });

  } catch (e) {
    console.error('Get user error:', e);
    return error(500, 'Failed to get user');
  }
}
