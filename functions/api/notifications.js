/**
 * Notifications API
 * GET /api/notifications - Get user notifications
 * POST /api/notifications/mark-read - Mark notifications as read
 * DELETE /api/notifications - Delete notifications
 */

import { json, error, readJson } from './_utils.js';
import { getCurrentUser } from './_auth.js';
import { getUserNotifications, markNotificationsRead, deleteNotifications, getUnreadCount } from './_notifications.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestGet({ request, env }) {
  const currentUser = await getCurrentUser(request, env);
  if (!currentUser) {
    return error(401, 'Authentication required');
  }

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));
  const unreadOnly = url.searchParams.get('unread') === 'true';

  const { notifications, total, unread } = await getUserNotifications(
    env,
    currentUser.userId,
    limit,
    offset,
    unreadOnly
  );

  return json({
    notifications: notifications.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      isRead: !!n.is_read,
      createdAt: n.created_at
    })),
    total,
    unread,
    limit,
    offset
  });
}

export async function onRequestPost({ request, env }) {
  const currentUser = await getCurrentUser(request, env);
  if (!currentUser) {
    return error(401, 'Authentication required');
  }

  const body = await readJson(request);
  if (!body) return error(400, 'Invalid JSON');

  // Mark as read
  if (body.action === 'mark-read') {
    const notificationIds = body.ids || null; // null means all
    const success = await markNotificationsRead(env, currentUser.userId, notificationIds);

    if (!success) {
      return error(500, 'Failed to mark notifications as read');
    }

    const unread = await getUnreadCount(env, currentUser.userId);

    return json({ success: true, unread });
  }

  return error(400, 'Invalid action');
}

export async function onRequestDelete({ request, env }) {
  const currentUser = await getCurrentUser(request, env);
  if (!currentUser) {
    return error(401, 'Authentication required');
  }

  const body = await readJson(request);
  if (!body) return error(400, 'Invalid JSON');

  const notificationIds = body.ids;
  if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
    return error(400, 'Notification IDs required');
  }

  const success = await deleteNotifications(env, currentUser.userId, notificationIds);

  if (!success) {
    return error(500, 'Failed to delete notifications');
  }

  return json({ success: true });
}
