/**
 * Vote API Endpoint
 * POST /api/vote - Cast or change a vote
 * GET /api/vote?type=topic&id=123 - Get user's vote on a target
 */

import { json, error, readJson } from './_utils.js';
import { getUserFromToken } from './_auth.js';
import { castVote, getUserVote } from './_reputation.js';
import { logAudit, getRequestMetadata, AuditAction } from './_audit.js';
import { validateCsrf } from './_csrf-middleware.js';

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-id, x-csrf-token',
    'Access-Control-Max-Age': '86400'
  }});
}

/**
 * GET - Get user's vote on a target
 */
export async function onRequestGet({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const url = new URL(request.url);
  const targetType = url.searchParams.get('type');
  const targetId = parseInt(url.searchParams.get('id'), 10);

  if (!targetType || !targetId) {
    return error(400, 'Target type and ID required');
  }

  if (!['topic', 'comment'].includes(targetType)) {
    return error(400, 'Invalid target type');
  }

  // Get user from token (optional)
  const user = await getUserFromToken(request, env);
  if (!user) {
    return json({ vote: 0 }); // Not logged in = no vote
  }

  try {
    const vote = await getUserVote(DB, user.id, targetType, targetId);
    return json({ vote: vote || 0 });
  } catch (e) {
    console.error('Get vote error:', e);
    return error(500, 'Failed to get vote');
  }
}

/**
 * POST - Cast or change a vote
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

  // Require authentication
  const user = await getUserFromToken(request, env);
  if (!user) {
    return error(401, 'Authentication required');
  }

  const body = await readJson(request);
  if (!body) return error(400, 'Invalid JSON');

  const targetType = body.type || body.targetType;
  const targetId = parseInt(body.id || body.targetId, 10);
  const voteType = parseInt(body.vote || body.voteType, 10);

  if (!targetType || !targetId) {
    return error(400, 'Target type and ID required');
  }

  if (!['topic', 'comment'].includes(targetType)) {
    return error(400, 'Invalid target type');
  }

  if (![1, -1].includes(voteType)) {
    return error(400, 'Vote must be 1 (upvote) or -1 (downvote)');
  }

  try {
    // Verify target exists
    const table = targetType === 'topic' ? 'topics' : 'comments';
    const target = await DB.prepare(`SELECT id, author_id FROM ${table} WHERE id = ?`)
      .bind(targetId).first();

    if (!target) {
      return error(404, `${targetType} not found`);
    }

    // Cast the vote
    const result = await castVote(DB, user.id, targetType, targetId, voteType);

    // Invalidate cache
    const kv = env.CACHE || env.TYLERS_TECH_KV;
    if (kv) {
      if (targetType === 'topic') {
        await kv.delete(`topic:${targetId}`);
        await kv.delete('topics:all');
      } else {
        await kv.delete(`topic:comments:${targetId}`);
      }
    }

    // Audit log
    const { ipAddress, userAgent } = getRequestMetadata(request);
    await logAudit(env, {
      userId: user.id,
      action: result.action === 'removed' ? AuditAction.DELETE : AuditAction.UPDATE,
      resourceType: 'vote',
      resourceId: `${targetType}:${targetId}`,
      ipAddress,
      userAgent,
      metadata: { targetType, targetId, voteType: result.voteType, action: result.action }
    });

    return json({
      success: true,
      action: result.action,
      vote: result.voteType
    });

  } catch (e) {
    console.error('Vote error:', e);
    return error(500, 'Failed to process vote');
  }
}
