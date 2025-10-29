import { json, error, getDeviceId, isAdmin } from '../_utils.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const DB = env.DB;
  if (!DB) return error(500, 'Database binding DB is not configured');
  // Schema is expected to be pre-initialized via schema.sql

  const method = request.method.toUpperCase();
  const id = params.id;
  const deviceId = getDeviceId(request);
  const admin = await isAdmin(request, env);

  if (!id) return error(400, 'Missing id');

  if (method === 'GET') {
    // Return topic with comments
    const tRes = await DB.prepare('SELECT id, title, body, author, created_at, created_by FROM topics WHERE id = ?').bind(id).all();
    const t = (tRes.results || [])[0];
    if (!t) return error(404, 'Not found');
    // Comments pagination support
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get('limit') || '200', 10)));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
    const cRes = await DB.prepare('SELECT id, author, body, created_at, created_by FROM comments WHERE topic_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?').bind(id, limit, offset).all();
    const comments = (cRes.results || []).map(c => ({ id: c.id, author: c.author, body: c.body, createdAt: c.created_at, canDelete: admin }));
    return json({ topic: { id: t.id, title: t.title, body: t.body, author: t.author, createdAt: t.created_at, comments, canDelete: admin } });
  }

  if (method === 'DELETE') {
    // Admin-only delete
    if (!admin) return error(403, 'Forbidden');
    await DB.prepare('DELETE FROM topics WHERE id = ?').bind(id).run();
    await DB.prepare('DELETE FROM comments WHERE topic_id = ?').bind(id).run();
    return new Response(null, { status: 204 });
  }

  return error(405, 'Method Not Allowed');
}
