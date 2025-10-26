import { error, getDeviceId, ensureSchema } from '../../../_utils.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const DB = env.DB;
  if (!DB) return error(500, 'Database binding DB is not configured');
  await ensureSchema(DB);

  const method = request.method.toUpperCase();
  const topicId = params.id;
  const commentId = params.commentId;
  const deviceId = getDeviceId(request);

  if (method !== 'DELETE') return error(405, 'Method Not Allowed');
  if (!topicId || !commentId) return error(400, 'Missing ids');
  if (!deviceId) return error(400, 'Missing X-Device-Id');

  const cRes = await DB.prepare('SELECT created_by FROM comments WHERE id = ? AND topic_id = ?').bind(commentId, topicId).all();
  const row = (cRes.results || [])[0];
  if (!row) return error(404, 'Not found');
  if (row.created_by !== deviceId) return error(403, 'Forbidden');
  await DB.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
  return new Response(null, { status: 204 });
}
