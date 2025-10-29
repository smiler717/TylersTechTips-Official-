import { json, error, readJson, getDeviceId, checkRateLimit, isAdmin, getViews } from './_utils.js';
import { getCurrentUser } from './_auth.js';
import { sanitizeTopicInput, validateDeviceId } from './_sanitize.js';
import { getCached, setCached, CacheKey, invalidateCache, cacheResponse } from './_cache.js';
import { logAudit, getRequestMetadata, AuditAction } from './_audit.js';

export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;
  if (!DB) return error(500, 'Database binding DB is not configured');
  // Schema is expected to be pre-initialized via schema.sql

  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const deviceId = getDeviceId(request);
  const admin = await isAdmin(request, env);

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key, Authorization',
      'Access-Control-Max-Age': '86400'
    }});
  }

  if (method === 'GET') {
    // Optional: server-side filtering/sorting
    const query = (url.searchParams.get('query') || '').trim().toLowerCase();
    const category = (url.searchParams.get('category') || '').trim();
    const sort = (url.searchParams.get('sort') || 'new').toLowerCase();
    const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

    // Try cache first
    const cacheKey = CacheKey.topicList(limit, offset, category);
    const cached = await getCached(env, cacheKey);
    if (cached && !query && sort === 'new') { // Only cache default sorted view
      return cacheResponse(cached, {}, 'public, max-age=300');
    }

  // Fetch topics
  let topics = await DB.prepare('SELECT id, title, body, author, category, created_at, created_by FROM topics').all();
    topics = topics.results || [];

    // Filter by category
    if (category) {
      topics = topics.filter(t => t.category === category);
    }

    // Filter by query
    if (query) {
      topics = topics.filter(t =>
        (t.title || '').toLowerCase().includes(query) ||
        (t.body || '').toLowerCase().includes(query) ||
        (t.author || '').toLowerCase().includes(query)
      );
    }

    // Sort
    if (sort === 'old') topics.sort((a, b) => a.created_at - b.created_at);
    else topics.sort((a, b) => b.created_at - a.created_at);

    // Pagination slice (in-memory for now)
    topics = topics.slice(offset, offset + limit);

    // Fetch comments per topic and attach counts and views
    for (const t of topics) {
      const res = await DB.prepare('SELECT id, author, body, created_at, created_by FROM comments WHERE topic_id = ? ORDER BY created_at ASC').bind(t.id).all();
      const comments = res.results || [];
      t.comments = comments.map(c => ({
        id: c.id,
        author: c.author,
        body: c.body,
        createdAt: c.created_at,
        canDelete: admin
      }));
      t.createdAt = t.created_at;
      t.canDelete = admin;
      t.views = await getViews(env, t.id);
      
      // Get vote counts
      const upvotesKey = `votes:topic:${t.id}:up`;
      const downvotesKey = `votes:topic:${t.id}:down`;
      t.upvotes = parseInt(await env.RATE_LIMIT.get(upvotesKey) || '0');
      t.downvotes = parseInt(await env.RATE_LIMIT.get(downvotesKey) || '0');
      
      // Check user's vote
      const voteKey = `vote:topic:${t.id}:${deviceId}`;
      t.userVote = await env.RATE_LIMIT.get(voteKey);
      
      delete t.created_at;
      delete t.created_by;
    }

    const result = { topics };
    
    // Cache if default view
    if (!query && sort === 'new') {
      await setCached(env, cacheKey, result, 300); // 5min TTL
    }

    return json(result);
  }

  if (method === 'POST') {
    // Require authenticated user for posting topics
    const currentUser = await getCurrentUser(request, env);
    if (!currentUser) return error(401, 'Authentication required');
    const body = await readJson(request);
    if (!body) return error(400, 'Invalid JSON');
    
    // Sanitize all inputs
    const { title, body: content, category } = sanitizeTopicInput(body);
    
    if (!title || !content) return error(400, 'Title and body are required');
    if (!deviceId) return error(400, 'Missing X-Device-Id');
    
    // Validate device ID
    try {
      validateDeviceId(deviceId);
    } catch {
      return error(400, 'Invalid device identifier');
    }

    const rl = await checkRateLimit(env, `post:${deviceId}`, 20000);
    if (!rl.ok) return error(429, 'Rate limited', { waitMs: rl.waitMs });

    const id = crypto.randomUUID();
    const createdAt = Date.now();
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
    try {
      await DB.prepare('INSERT INTO topics (id, title, body, author, category, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, title, content, displayAuthor, category, createdAt, deviceId).run();
      
      // Invalidate topic list caches
      await invalidateCache(env, 'topics');
      
      // Audit topic creation
      const { ipAddress, userAgent } = getRequestMetadata(request);
      await logAudit(env, {
        userId: currentUser.userId,
        action: AuditAction.TOPIC_CREATE,
        resourceType: 'topic',
        resourceId: id,
        ipAddress,
        userAgent,
        metadata: { title, category }
      });
      
      return json({
        topic: { id, title, body: content, author: displayAuthor, category, createdAt, comments: [], canDelete: admin }
      }, { status: 201 });
    } catch (e) {
      return error(500, 'Failed to create topic');
    }
  }

  return error(405, 'Method Not Allowed');
}
