import { json, error, getDeviceId, checkRateLimit, incrementViews } from '../../_utils.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key, Authorization',
      'Access-Control-Max-Age': '86400'
    }});
  }
  if (method !== 'POST') return error(405, 'Method Not Allowed');

  const topicId = params.id;
  if (!topicId) return error(400, 'Missing topic id');

  const deviceId = getDeviceId(request);
  if (!deviceId) return error(400, 'Missing X-Device-Id');

  // Limit one view per device per minute per topic
  const rl = await checkRateLimit(env, `view:${topicId}:${deviceId}`, 60000);
  if (!rl.ok) return json({ ok: true, rateLimited: true });

  const count = await incrementViews(env, topicId, 1);
  return json({ ok: true, views: count });
}
