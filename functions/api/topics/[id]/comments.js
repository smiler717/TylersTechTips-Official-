import { json, error, readJson, getDeviceId, checkRateLimit } from '../../_utils.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const DB = env.DB;
  if (!DB) return error(500, 'Database binding DB is not configured');
  // Schema is expected to be pre-initialized via schema.sql

  const method = request.method.toUpperCase();
  const topicId = params.id;
  const deviceId = getDeviceId(request);

  if (!topicId) return error(400, 'Missing topic id');

  if (method === 'GET') {
    const res = await DB.prepare('SELECT id, author, body, created_at, created_by FROM comments WHERE topic_id = ? ORDER BY created_at ASC').bind(topicId).all();
    const comments = (res.results || []).map(c => ({ id: c.id, author: c.author, body: c.body, createdAt: c.created_at, canDelete: deviceId && c.created_by === deviceId }));
    return json({ comments });
  }

  if (method === 'POST') {
    if (!deviceId) return error(400, 'Missing X-Device-Id');
    const body = await readJson(request);
    if (!body) return error(400, 'Invalid JSON');
    const author = (body.author || 'Anonymous').trim();
    const content = (body.body || '').trim();
    if (!content) return error(400, 'Body is required');

    const rl = await checkRateLimit(env, `comment:${deviceId}`, 20000);
    if (!rl.ok) return error(429, 'Rate limited', { waitMs: rl.waitMs });

    const id = crypto.randomUUID();
    const createdAt = Date.now();

    // Ensure topic exists
    const tRes = await DB.prepare('SELECT id FROM topics WHERE id = ?').bind(topicId).all();
    if (!(tRes.results || [])[0]) return error(404, 'Topic not found');

    await DB.prepare('INSERT INTO comments (id, topic_id, author, body, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(id, topicId, author, content, createdAt, deviceId).run();
    return json({ comment: { id, author, body: content, createdAt, canDelete: true } }, { status: 201 });
  }

  return error(405, 'Method Not Allowed');
}
