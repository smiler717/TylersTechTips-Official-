/**
 * Real-time Update Helpers
 * Send live updates via WebSocket/SSE
 */

/**
 * Broadcast notification to user
 * @param {object} env - Environment bindings
 * @param {number} userId - Target user ID
 * @param {object} notification - Notification data
 */
export async function broadcastNotification(env, userId, notification) {
  try {
    // Try Durable Object WebSocket broadcast
    if (env.REALTIME) {
      const id = env.REALTIME.idFromName('global');
      const stub = env.REALTIME.get(id);
      
      await stub.fetch(new Request('https://realtime/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'notification',
          targetUserId: userId,
          payload: notification
        })
      }));
    }
  } catch (error) {
    console.error('Failed to broadcast notification:', error);
    // Non-blocking - polling will still work
  }
}

/**
 * Broadcast new comment to topic viewers
 * @param {object} env - Environment bindings
 * @param {number} topicId - Topic ID
 * @param {object} comment - Comment data
 */
export async function broadcastComment(env, topicId, comment) {
  try {
    if (env.REALTIME) {
      const id = env.REALTIME.idFromName('global');
      const stub = env.REALTIME.get(id);
      
      await stub.fetch(new Request('https://realtime/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'comment',
          targetTopic: topicId,
          payload: comment
        })
      }));
    }
  } catch (error) {
    console.error('Failed to broadcast comment:', error);
  }
}

/**
 * Broadcast topic update
 */
export async function broadcastTopicUpdate(env, topicId, update) {
  try {
    if (env.REALTIME) {
      const id = env.REALTIME.idFromName('global');
      const stub = env.REALTIME.get(id);
      
      await stub.fetch(new Request('https://realtime/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'topic_update',
          targetTopic: topicId,
          payload: update
        })
      }));
    }
  } catch (error) {
    console.error('Failed to broadcast topic update:', error);
  }
}
