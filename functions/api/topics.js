import { json, error, readJson, getDeviceId, checkRateLimit } from './_utils.js';

export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;
  if (!DB) return error(500, 'Database binding DB is not configured');
  // Schema is expected to be pre-initialized via schema.sql

  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const deviceId = getDeviceId(request);

  if (method === 'GET') {
    // Optional: server-side filtering/sorting
    const query = (url.searchParams.get('query') || '').trim().toLowerCase();
    const sort = (url.searchParams.get('sort') || 'new').toLowerCase();

    // Fetch topics
  let topics = await DB.prepare('SELECT id, title, body, author, created_at, created_by FROM topics').all();
    topics = topics.results || [];

    // Filter
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

    // Fetch comments per topic and attach counts
    for (const t of topics) {
      const res = await DB.prepare('SELECT id, author, body, created_at, created_by FROM comments WHERE topic_id = ? ORDER BY created_at ASC').bind(t.id).all();
      const comments = res.results || [];
      t.comments = comments.map(c => ({
        id: c.id,
        author: c.author,
        body: c.body,
        createdAt: c.created_at,
        canDelete: deviceId && c.created_by === deviceId
      }));
      t.createdAt = t.created_at;
      t.canDelete = deviceId && t.created_by === deviceId;
      delete t.created_at;
      delete t.created_by;
    }

    return json({ topics });
  }

  if (method === 'POST') {
    const body = await readJson(request);
    if (!body) return error(400, 'Invalid JSON');
    const title = (body.title || '').trim();
    const content = (body.body || '').trim();
    const author = (body.author || 'Anonymous').trim();
    if (!title || !content) return error(400, 'Title and body are required');
    if (!deviceId) return error(400, 'Missing X-Device-Id');

    const rl = await checkRateLimit(env, `post:${deviceId}`, 20000);
    if (!rl.ok) return error(429, 'Rate limited', { waitMs: rl.waitMs });

    const id = crypto.randomUUID();
    const createdAt = Date.now();
    try {
      await DB.prepare('INSERT INTO topics (id, title, body, author, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, title, content, author, createdAt, deviceId).run();
      return json({
        topic: { id, title, body: content, author, createdAt, comments: [], canDelete: true }
      }, { status: 201 });
    } catch (e) {
      return error(500, 'Failed to create topic');
    }
  }

  return error(405, 'Method Not Allowed');
}
