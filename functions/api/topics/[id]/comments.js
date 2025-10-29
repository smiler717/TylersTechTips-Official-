import { json, error, readJson, getDeviceId, checkRateLimit, isAdmin } from '../../_utils.js';
import { getCurrentUser } from '../../_auth.js';
import { sanitizeText, validateDeviceId } from '../../_sanitize.js';
import { getCached, setCached, CacheKey, invalidateComments, cacheResponse } from '../../_cache.js';
import { logAudit, getRequestMetadata, AuditAction } from '../../_audit.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const DB = env.DB;
  if (!DB) return error(500, 'Database binding DB is not configured');
  // Schema is expected to be pre-initialized via schema.sql

  const method = request.method.toUpperCase();
  const topicId = params.id;
  const deviceId = getDeviceId(request);
  const admin = await isAdmin(request, env);

  if (!topicId) return error(400, 'Missing topic id');

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key, Authorization',
      'Access-Control-Max-Age': '86400'
    }});
  }

  if (method === 'GET') {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get('limit') || '200', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
    
    // Try cache first
    const cacheKey = CacheKey.topicComments(topicId, limit, offset);
    const cached = await getCached(env, cacheKey);
    if (cached) {
      return cacheResponse(cached, {}, 'public, max-age=300');
    }
    
    const res = await DB.prepare(`SELECT id, author, body, created_at, created_by FROM comments WHERE topic_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?`).bind(topicId, limit, offset).all();
    const comments = (res.results || []).map(c => ({ id: c.id, author: c.author, body: c.body, createdAt: c.created_at, canDelete: admin }));
    
    const result = { comments };
    
    // Cache result
    await setCached(env, cacheKey, result, 300); // 5min TTL
    
    return json(result);
  }

  if (method === 'POST') {
    // Require authenticated user for commenting
    const currentUser = await getCurrentUser(request, env);
    if (!currentUser) return error(401, 'Authentication required');
    if (!deviceId) return error(400, 'Missing X-Device-Id');
    
    // Validate device ID
    try {
      validateDeviceId(deviceId);
    } catch {
      return error(400, 'Invalid device identifier');
    }
    
    const body = await readJson(request);
    if (!body) return error(400, 'Invalid JSON');
    
    // Sanitize inputs
  const content = sanitizeText(body.body || '', 2000);
    
    if (!content) return error(400, 'Body is required');

    const rl = await checkRateLimit(env, `comment:${deviceId}`, 20000);
    if (!rl.ok) return error(429, 'Rate limited', { waitMs: rl.waitMs });

    const id = crypto.randomUUID();
    const createdAt = Date.now();

    // Ensure topic exists
    const tRes = await DB.prepare('SELECT id FROM topics WHERE id = ?').bind(topicId).all();
    if (!(tRes.results || [])[0]) return error(404, 'Topic not found');

    // Derive author from authenticated user to prevent spoofing and optionally enforce email verification
    let displayAuthor = '';
    try {
      const row = await DB.prepare('SELECT display_name, username, email_verified FROM users WHERE id = ?')
        .bind(currentUser.userId).first();
      if (env.REQUIRE_EMAIL_VERIFIED && Number(env.REQUIRE_EMAIL_VERIFIED)) {
        if (!row || !row.email_verified) return error(403, 'Email verification required');
      }
      displayAuthor = (row?.display_name || row?.username || 'User');
    } catch (_) {
      displayAuthor = 'User';
    }

    await DB.prepare('INSERT INTO comments (id, topic_id, author, body, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, topicId, displayAuthor, content, createdAt, deviceId).run();
    
    // Invalidate comment caches for this topic
    await invalidateComments(env, topicId);
    
    // Audit comment creation
    const { ipAddress, userAgent } = getRequestMetadata(request);
    await logAudit(env, {
      userId: currentUser.userId,
      action: AuditAction.COMMENT_CREATE,
      resourceType: 'comment',
      resourceId: id,
      ipAddress,
      userAgent,
      metadata: { topicId }
    });
    
    return json({ comment: { id, author: displayAuthor, body: content, createdAt, canDelete: admin } }, { status: 201 });
  }

  return error(405, 'Method Not Allowed');
}
