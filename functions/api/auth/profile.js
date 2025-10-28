/**
 * Update User Profile
 * PATCH /api/auth/profile
 */

import { json, error, readJson } from '../_utils.js';
import { getCurrentUser } from '../_auth.js';
import { sanitizeText } from '../_sanitize.js';

export async function onRequestPatch({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const currentUser = await getCurrentUser(request, env);
  if (!currentUser) {
    return error(401, 'Not authenticated');
  }

  const body = await readJson(request);
  if (!body) return error(400, 'Invalid JSON');

  const displayName = body.displayName ? sanitizeText(body.displayName, 60) : null;
  const bio = body.bio ? sanitizeText(body.bio, 500) : null;
  const avatarUrl = body.avatarUrl ? sanitizeText(body.avatarUrl, 500) : null;

  try {
    const updates = [];
    const values = [];

    if (displayName !== null) {
      updates.push('display_name = ?');
      values.push(displayName);
    }
    if (bio !== null) {
      updates.push('bio = ?');
      values.push(bio);
    }
    if (avatarUrl !== null) {
      updates.push('avatar_url = ?');
      values.push(avatarUrl);
    }

    if (updates.length === 0) {
      return error(400, 'No updates provided');
    }

    values.push(currentUser.userId);

    await DB.prepare(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = ?
    `).bind(...values).run();

    // Fetch updated user
    const user = await DB.prepare(`
      SELECT id, username, email, display_name, bio, avatar_url
      FROM users
      WHERE id = ?
    `).bind(currentUser.userId).first();

    return json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name || user.username,
        bio: user.bio,
        avatarUrl: user.avatar_url
      }
    });

  } catch (e) {
    console.error('Update profile error:', e);
    return error(500, 'Failed to update profile');
  }
}
