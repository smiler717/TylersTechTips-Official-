/**
 * Bookmarks API
 * GET /api/bookmarks - Get user bookmarks
 * POST /api/bookmarks - Add bookmark
 * DELETE /api/bookmarks/:topicId - Remove bookmark
 */

import { json, error, readJson } from './_utils.js';
import { getCurrentUser } from './_auth.js';
import { logAudit, getRequestMetadata, AuditAction } from './_audit.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  }});
}

/**
 * GET - List user's bookmarks
 */
export async function onRequestGet({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const currentUser = await getCurrentUser(request, env);
  if (!currentUser) {
    return error(401, 'Authentication required');
  }

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

  try {
    const result = await DB.prepare(`
      SELECT b.id, b.topic_id, b.created_at,
             t.title, t.body, t.author, t.category, t.created_at as topic_created_at
      FROM bookmarks b
      JOIN topics t ON b.topic_id = t.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(currentUser.userId, limit, offset).all();

    const countResult = await DB.prepare(
      'SELECT COUNT(*) as total FROM bookmarks WHERE user_id = ?'
    ).bind(currentUser.userId).first();

    const bookmarks = (result.results || []).map(b => ({
      id: b.id,
      topicId: b.topic_id,
      bookmarkedAt: b.created_at,
      topic: {
        id: b.topic_id,
        title: b.title,
        body: b.body,
        author: b.author,
        category: b.category,
        createdAt: b.topic_created_at
      }
    }));

    return json({
      bookmarks,
      total: countResult?.total || 0,
      limit,
      offset
    });
  } catch (e) {
    console.error('Get bookmarks error:', e);
    return error(500, 'Failed to get bookmarks');
  }
}

/**
 * POST - Add bookmark
 */
export async function onRequestPost({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const currentUser = await getCurrentUser(request, env);
  if (!currentUser) {
    return error(401, 'Authentication required');
  }

  const body = await readJson(request);
  if (!body) return error(400, 'Invalid JSON');

  const topicId = body.topicId;
  if (!topicId) return error(400, 'Topic ID required');

  try {
    // Check if topic exists
    const topic = await DB.prepare('SELECT id FROM topics WHERE id = ?').bind(topicId).first();
    if (!topic) return error(404, 'Topic not found');

    // Check if already bookmarked
    const existing = await DB.prepare(
      'SELECT id FROM bookmarks WHERE user_id = ? AND topic_id = ?'
    ).bind(currentUser.userId, topicId).first();

    if (existing) {
      return error(409, 'Already bookmarked');
    }

    // Add bookmark
    await DB.prepare(`
      INSERT INTO bookmarks (user_id, topic_id, created_at)
      VALUES (?, ?, ?)
    `).bind(currentUser.userId, topicId, Date.now()).run();

    // Audit bookmark action
    const { ipAddress, userAgent } = getRequestMetadata(request);
    await logAudit(env, {
      userId: currentUser.userId,
      action: AuditAction.BOOKMARK_ADD,
      resourceType: 'topic',
      resourceId: topicId,
      ipAddress,
      userAgent
    });

    return json({ success: true }, { status: 201 });
  } catch (e) {
    console.error('Add bookmark error:', e);
    return error(500, 'Failed to add bookmark');
  }
}

/**
 * DELETE - Remove bookmark
 */
export async function onRequestDelete({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const currentUser = await getCurrentUser(request, env);
  if (!currentUser) {
    return error(401, 'Authentication required');
  }

  const body = await readJson(request);
  if (!body) return error(400, 'Invalid JSON');

  const topicId = body.topicId;
  if (!topicId) return error(400, 'Topic ID required');

  try {
    const result = await DB.prepare(`
      DELETE FROM bookmarks
      WHERE user_id = ? AND topic_id = ?
    `).bind(currentUser.userId, topicId).run();

    if (result.meta?.changes === 0) {
      return error(404, 'Bookmark not found');
    }

    // Audit bookmark removal
    const { ipAddress, userAgent } = getRequestMetadata(request);
    await logAudit(env, {
      userId: currentUser.userId,
      action: AuditAction.BOOKMARK_REMOVE,
      resourceType: 'topic',
      resourceId: topicId,
      ipAddress,
      userAgent
    });

    return json({ success: true });
  } catch (e) {
    console.error('Delete bookmark error:', e);
    return error(500, 'Failed to delete bookmark');
  }
}
