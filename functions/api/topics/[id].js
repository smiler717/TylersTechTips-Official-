import { json, error, getDeviceId, ensureSchema } from '../_utils.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const DB = env.DB;
  if (!DB) return error(500, 'Database binding DB is not configured');
  await ensureSchema(DB);

  const method = request.method.toUpperCase();
  const id = params.id;
  const deviceId = getDeviceId(request);

  if (!id) return error(400, 'Missing id');

  if (method === 'GET') {
    // Return topic with comments
    const tRes = await DB.prepare('SELECT id, title, body, author, created_at, created_by FROM topics WHERE id = ?').bind(id).all();
    const t = (tRes.results || [])[0];
    if (!t) return error(404, 'Not found');
    const cRes = await DB.prepare('SELECT id, author, body, created_at, created_by FROM comments WHERE topic_id = ? ORDER BY created_at ASC').bind(id).all();
    const comments = (cRes.results || []).map(c => ({ id: c.id, author: c.author, body: c.body, createdAt: c.created_at, canDelete: deviceId && c.created_by === deviceId }));
    return json({ topic: { id: t.id, title: t.title, body: t.body, author: t.author, createdAt: t.created_at, comments, canDelete: deviceId && t.created_by === deviceId } });
  }

  if (method === 'DELETE') {
    if (!deviceId) return error(400, 'Missing X-Device-Id');
    // Only creator can delete
    const tRes = await DB.prepare('SELECT created_by FROM topics WHERE id = ?').bind(id).all();
    const row = (tRes.results || [])[0];
    if (!row) return error(404, 'Not found');
    if (row.created_by !== deviceId) return error(403, 'Forbidden');
    await DB.prepare('DELETE FROM topics WHERE id = ?').bind(id).run();
    return new Response(null, { status: 204 });
  }

  return error(405, 'Method Not Allowed');
}
