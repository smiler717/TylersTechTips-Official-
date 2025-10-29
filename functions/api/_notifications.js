/**
 * Notification System
 * Create and manage user notifications
 */

/**
 * Notification types
 */
export const NotificationType = {
  COMMENT_REPLY: 'comment_reply',
  TOPIC_REPLY: 'topic_reply',
  MENTION: 'mention',
  UPVOTE: 'upvote',
  BADGE_EARNED: 'badge_earned',
  SYSTEM: 'system',
  MODERATION: 'moderation',
};

/**
 * Create a notification for a user
 */
export async function createNotification(env, {
  userId,
  type,
  title,
  body = null,
  link = null
}) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return false;

  try {
    await DB.prepare(`
      INSERT INTO notifications (user_id, type, title, body, link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, 0, ?)
    `).bind(userId, type, title, body, link, Date.now()).run();

    return true;
  } catch (e) {
    console.error('Create notification error:', e);
    return false;
  }
}

/**
 * Create notification for topic reply
 */
export async function notifyTopicReply(env, topicId, topicTitle, commenterUsername, topicAuthorId) {
  if (!topicAuthorId) return false;

  return await createNotification(env, {
    userId: topicAuthorId,
    type: NotificationType.TOPIC_REPLY,
    title: `${commenterUsername} commented on your topic`,
    body: topicTitle,
    link: `/community.html?topic=${topicId}`
  });
}

/**
 * Create notification for mention
 */
export async function notifyMention(env, mentionedUserId, mentionerUsername, resourceType, resourceId) {
  return await createNotification(env, {
    userId: mentionedUserId,
    type: NotificationType.MENTION,
    title: `${mentionerUsername} mentioned you`,
    body: `in a ${resourceType}`,
    link: resourceType === 'topic' ? `/community.html?topic=${resourceId}` : `/community.html?comment=${resourceId}`
  });
}

/**
 * Get user notifications
 */
export async function getUserNotifications(env, userId, limit = 20, offset = 0, unreadOnly = false) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return { notifications: [], total: 0, unread: 0 };

  try {
    let sql = 'SELECT id, type, title, body, link, is_read, created_at FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (unreadOnly) {
      sql += ' AND is_read = 0';
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await DB.prepare(sql).bind(...params).all();

    // Get unread count
    const unreadResult = await DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).bind(userId).first();

    // Get total count
    const totalResult = await DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ?'
    ).bind(userId).first();

    return {
      notifications: result.results || [],
      total: totalResult?.count || 0,
      unread: unreadResult?.count || 0
    };
  } catch (e) {
    console.error('Get notifications error:', e);
    return { notifications: [], total: 0, unread: 0 };
  }
}

/**
 * Mark notification(s) as read
 */
export async function markNotificationsRead(env, userId, notificationIds = null) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return false;

  try {
    if (notificationIds && notificationIds.length > 0) {
      // Mark specific notifications as read
      const placeholders = notificationIds.map(() => '?').join(',');
      await DB.prepare(`
        UPDATE notifications 
        SET is_read = 1 
        WHERE user_id = ? AND id IN (${placeholders})
      `).bind(userId, ...notificationIds).run();
    } else {
      // Mark all as read
      await DB.prepare(`
        UPDATE notifications 
        SET is_read = 1 
        WHERE user_id = ? AND is_read = 0
      `).bind(userId).run();
    }

    return true;
  } catch (e) {
    console.error('Mark notifications read error:', e);
    return false;
  }
}

/**
 * Delete notification(s)
 */
export async function deleteNotifications(env, userId, notificationIds) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return false;

  try {
    if (notificationIds && notificationIds.length > 0) {
      const placeholders = notificationIds.map(() => '?').join(',');
      await DB.prepare(`
        DELETE FROM notifications 
        WHERE user_id = ? AND id IN (${placeholders})
      `).bind(userId, ...notificationIds).run();
    }

    return true;
  } catch (e) {
    console.error('Delete notifications error:', e);
    return false;
  }
}

/**
 * Get unread count for a user
 */
export async function getUnreadCount(env, userId) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return 0;

  try {
    const result = await DB.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).bind(userId).first();

    return result?.count || 0;
  } catch (e) {
    console.error('Get unread count error:', e);
    return 0;
  }
}

/**
 * Parse @mentions from text
 */
export function parseMentions(text) {
  const mentionRegex = /@(\w{3,20})/g;
  const mentions = [];
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1].toLowerCase());
  }

  return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Get user IDs for usernames
 */
export async function getUserIdsByUsernames(env, usernames) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB || !usernames.length) return [];

  try {
    const placeholders = usernames.map(() => '?').join(',');
    const result = await DB.prepare(`
      SELECT id, username FROM users WHERE username IN (${placeholders})
    `).bind(...usernames).all();

    return result.results || [];
  } catch (e) {
    console.error('Get user IDs error:', e);
    return [];
  }
}
