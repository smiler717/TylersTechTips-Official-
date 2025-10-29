import { json, error, getDeviceId, isAdmin } from '../_utils.js';
import { getCached, setCached, CacheKey, invalidateTopic, cacheResponse } from '../_cache.js';
import { logAudit, getRequestMetadata, AuditAction } from '../_audit.js';
import { getCurrentUser } from '../_auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database binding DB or TYLERS_TECH_DB is not configured');
  // Schema is expected to be pre-initialized via schema.sql

  const method = request.method.toUpperCase();
  const id = params.id;
  const deviceId = getDeviceId(request);
  const admin = await isAdmin(request, env);

  if (!id) return error(400, 'Missing id');

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key, Authorization',
      'Access-Control-Max-Age': '86400'
    }});
  }

  if (method === 'GET') {
    // Return topic with comments
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get('limit') || '200', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
    
    // Try cache first
    const cacheKey = CacheKey.topic(id);
    const cached = await getCached(env, cacheKey);
    if (cached && limit === 200 && offset === 0) {
      return cacheResponse(cached, {}, 'public, max-age=600');
    }
    
    const tRes = await DB.prepare('SELECT id, title, body, author, created_at, created_by FROM topics WHERE id = ?').bind(id).all();
    const t = (tRes.results || [])[0];
    if (!t) return error(404, 'Not found');
    
    const cRes = await DB.prepare('SELECT id, author, body, created_at, created_by FROM comments WHERE topic_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?').bind(id, limit, offset).all();
    const comments = (cRes.results || []).map(c => ({ id: c.id, author: c.author, body: c.body, createdAt: c.created_at, canDelete: admin }));
    
    const result = { topic: { id: t.id, title: t.title, body: t.body, author: t.author, createdAt: t.created_at, comments, canDelete: admin } };
    
    // Cache default view
    if (limit === 200 && offset === 0) {
      await setCached(env, cacheKey, result, 600); // 10min TTL
    }
    
    return json(result);
  }

  if (method === 'DELETE') {
    // Admin-only delete
    if (!admin) return error(403, 'Forbidden');
    
    // Get current user for audit
    const currentUser = await getCurrentUser(request, env);
    
    await DB.prepare('DELETE FROM topics WHERE id = ?').bind(id).run();
    await DB.prepare('DELETE FROM comments WHERE topic_id = ?').bind(id).run();
    
    // Invalidate caches
    await invalidateTopic(env, id);
    
    // Audit topic deletion
    if (currentUser) {
      const { ipAddress, userAgent } = getRequestMetadata(request);
      await logAudit(env, {
        userId: currentUser.userId,
        action: AuditAction.TOPIC_DELETE,
        resourceType: 'topic',
        resourceId: id,
        ipAddress,
        userAgent
      });
    }
    
    return new Response(null, { status: 204 });
  }

  return error(405, 'Method Not Allowed');
}
