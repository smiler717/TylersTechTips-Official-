/**
 * Moderation API Endpoint
 * Manage content moderation
 */

import { json, error, readJson } from '../_utils.js';
import { getUserFromToken } from '../_auth.js';
import { validateCsrf } from '../_csrf-middleware.js';
import { getPendingReports, createModerationReport } from '../_moderation.js';

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-id, x-csrf-token, x-admin-key',
    'Access-Control-Max-Age': '86400'
  }});
}

/**
 * GET - Get moderation reports
 */
export async function onRequestGet({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  // Require admin key
  const adminKey = request.headers.get('x-admin-key');
  if (!adminKey || adminKey !== env.ADMIN_KEY) {
    return error(403, 'Admin access required');
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
  const status = url.searchParams.get('status') || 'pending';

  try {
    const reports = await DB.prepare(`
      SELECT
        mr.*,
        u.username as reporter_username,
        rv.username as reviewer_username
      FROM moderation_reports mr
      LEFT JOIN users u ON mr.reporter_id = u.id
      LEFT JOIN users rv ON mr.reviewed_by = rv.id
      WHERE mr.status = ?
      ORDER BY mr.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(status, limit, offset).all();

    return json({ reports: reports.results || [], total: reports.results?.length || 0 });

  } catch (e) {
    console.error('Get reports error:', e);
    return error(500, 'Failed to fetch reports');
  }
}

/**
 * POST - Create moderation report or review report
 */
export async function onRequestPost({ request, env }) {
  // Validate CSRF
  const deviceId = request.headers.get('x-device-id');
  if (!deviceId) {
    return error(400, 'Device ID required');
  }
  const csrfValid = await validateCsrf(request, env, deviceId);
  if (!csrfValid) {
    return error(403, 'Invalid CSRF token');
  }

  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const user = await getUserFromToken(request, env);
  if (!user) {
    return error(401, 'Authentication required');
  }

  const body = await readJson(request);
  if (!body) return error(400, 'Invalid JSON');

  const action = body.action || 'report';

  try {
    if (action === 'report') {
      // Create new report
      const { targetType, targetId, reason, details } = body;

      if (!targetType || !targetId || !reason) {
        return error(400, 'Target type, ID, and reason required');
      }

      await createModerationReport(DB, {
        targetType,
        targetId,
        reporterId: user.id,
        reason,
        details
      });

      return json({ success: true, message: 'Report submitted' });

    } else if (action === 'review') {
      // Review report (admin only)
      const adminKey = request.headers.get('x-admin-key');
      if (!adminKey || adminKey !== env.ADMIN_KEY) {
        return error(403, 'Admin access required');
      }

      const { reportId, decision, moderationAction } = body;

      if (!reportId || !decision) {
        return error(400, 'Report ID and decision required');
      }

      const now = Date.now();

      // Update report status
      await DB.prepare(`
        UPDATE moderation_reports
        SET status = ?, reviewed_by = ?, reviewed_at = ?
        WHERE id = ?
      `).bind(decision, user.id, now, reportId).run();

      // Take moderation action if specified
      if (moderationAction === 'remove') {
        const report = await DB.prepare(`
          SELECT target_type, target_id FROM moderation_reports WHERE id = ?
        `).bind(reportId).first();

        if (report) {
          const table = report.target_type === 'topic' ? 'topics' : 'comments';
          await DB.prepare(`
            UPDATE ${table}
            SET moderation_status = 'removed'
            WHERE id = ?
          `).bind(report.target_id).run();
        }
      }

      return json({ success: true, message: 'Report reviewed' });
    }

  } catch (e) {
    console.error('Moderation error:', e);
    return error(500, 'Moderation action failed');
  }
}
