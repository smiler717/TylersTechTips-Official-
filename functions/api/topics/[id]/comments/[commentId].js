import { error, getDeviceId, isAdmin } from '../../../_utils.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const DB = env.DB;
  if (!DB) return error(500, 'Database binding DB is not configured');
  // Schema is expected to be pre-initialized via schema.sql

  const method = request.method.toUpperCase();
  const topicId = params.id;
  const commentId = params.commentId;
  const deviceId = getDeviceId(request);
  const admin = await isAdmin(request, env);

  if (method !== 'DELETE') return error(405, 'Method Not Allowed');
  if (!topicId || !commentId) return error(400, 'Missing ids');
  if (!admin) return error(403, 'Forbidden');
  await DB.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
  return new Response(null, { status: 204 });
}
