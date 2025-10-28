/**
 * Get Current User Profile
 * GET /api/auth/me
 */

import { json, error } from '../_utils.js';
import { getCurrentUser } from '../_auth.js';

export async function onRequestGet({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const currentUser = await getCurrentUser(request, env);
  if (!currentUser) {
    return error(401, 'Not authenticated');
  }

  try {
    const user = await DB.prepare(`
      SELECT id, username, email, display_name, bio, avatar_url, created_at, last_login
      FROM users
      WHERE id = ?
    `).bind(currentUser.userId).first();

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
        lastLogin: user.last_login
      }
    });

  } catch (e) {
    console.error('Get user error:', e);
    return error(500, 'Failed to get user');
  }
}
