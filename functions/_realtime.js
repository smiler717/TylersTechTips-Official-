/**
 * Real-time WebSocket Durable Object
 * Manages WebSocket connections for live updates
 */

export class RealtimeConnection {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // userId -> WebSocket
  }

  async fetch(request) {
    const url = new URL(request.url);

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // Handle broadcast messages from API
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      return this.handleBroadcast(request);
    }

    return new Response('Real-time connection server', { status: 200 });
  }

  /**
   * Handle WebSocket connection
   */
  async handleWebSocket(request) {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const token = url.searchParams.get('token');

    if (!userId || !token) {
      return new Response('Missing userId or token', { status: 400 });
    }

    // Verify token (simplified - in production, verify against KV)
    const kv = this.env.TOKENS || this.env.TYLERS_TECH_KV;
    if (kv) {
      const storedToken = await kv.get(`token:${userId}`);
      if (!storedToken || storedToken !== token) {
        return new Response('Invalid token', { status: 401 });
      }
    }

    // Create WebSocket pair
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept connection
    server.accept();

    // Store session
    this.sessions.set(userId, { socket: server, userId });

    // Handle messages
    server.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(userId, data);
      } catch (error) {
        console.error('Message parse error:', error);
      }
    });

    // Handle close
    server.addEventListener('close', () => {
      this.sessions.delete(userId);
    });

    // Send welcome message
    server.send(JSON.stringify({
      type: 'connected',
      userId,
      timestamp: Date.now()
    }));

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Handle incoming message from client
   */
  handleMessage(userId, data) {
    switch (data.type) {
      case 'ping':
        const session = this.sessions.get(userId);
        if (session) {
          session.socket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
        break;
      case 'typing':
        // Broadcast typing indicator to topic viewers
        this.broadcastToTopic(data.topicId, {
          type: 'typing',
          userId,
          username: data.username,
          topicId: data.topicId
        }, userId);
        break;
    }
  }

  /**
   * Handle broadcast from API
   */
  async handleBroadcast(request) {
    try {
      const data = await request.json();
      const { type, targetUserId, targetTopic, payload } = data;

      if (type === 'notification' && targetUserId) {
        // Send to specific user
        const session = this.sessions.get(String(targetUserId));
        if (session) {
          session.socket.send(JSON.stringify({
            type: 'notification',
            ...payload
          }));
        }
      } else if (type === 'comment' && targetTopic) {
        // Broadcast to all users viewing this topic
        this.broadcastToTopic(targetTopic, {
          type: 'new_comment',
          ...payload
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Broadcast error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Broadcast message to all users viewing a topic
   */
  broadcastToTopic(topicId, message, excludeUserId = null) {
    for (const [userId, session] of this.sessions.entries()) {
      if (userId !== excludeUserId) {
        try {
          session.socket.send(JSON.stringify(message));
        } catch (error) {
          console.error(`Failed to send to user ${userId}:`, error);
        }
      }
    }
  }
}

// Export for Cloudflare Workers
export default {
  async fetch(request, env) {
    // Get Durable Object ID
    const id = env.REALTIME.idFromName('global');
    const stub = env.REALTIME.get(id);
    return stub.fetch(request);
  }
};
