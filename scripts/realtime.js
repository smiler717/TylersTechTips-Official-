/**
 * Real-time WebSocket Client
 * Handles live updates for notifications and comments
 */

class RealtimeClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.listeners = new Map();
    this.pingInterval = null;
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    if (!window.authManager || !window.authManager.isAuthenticated()) {
      console.log('Not authenticated, skipping WebSocket connection');
      return;
    }

    const user = window.authManager.getCurrentUser();
    const token = localStorage.getItem('token');

    if (!user || !token) return;

    try {
      // Note: In production, use wss:// protocol
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${location.host}/realtime?userId=${user.id}&token=${encodeURIComponent(token)}`;

      this.socket = new WebSocket(wsUrl);

      this.socket.addEventListener('open', () => {
        console.log('WebSocket connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.startPing();
        this.emit('connected');
      });

      this.socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('WebSocket message parse error:', error);
        }
      });

      this.socket.addEventListener('close', () => {
        console.log('WebSocket disconnected');
        this.connected = false;
        this.stopPing();
        this.emit('disconnected');
        this.attemptReconnect();
      });

      this.socket.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      });

    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.attemptReconnect();
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
    this.stopPing();
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Send message to server
   */
  send(data) {
    if (this.socket && this.connected) {
      this.socket.send(JSON.stringify(data));
    }
  }

  /**
   * Start ping interval to keep connection alive
   */
  startPing() {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop ping interval
   */
  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Handle incoming message
   */
  handleMessage(data) {
    switch (data.type) {
      case 'connected':
        console.log('Connected to real-time server');
        break;
      case 'pong':
        // Ping response
        break;
      case 'notification':
        this.emit('notification', data);
        break;
      case 'new_comment':
        this.emit('new_comment', data);
        break;
      case 'topic_update':
        this.emit('topic_update', data);
        break;
      case 'typing':
        this.emit('typing', data);
        break;
    }
  }

  /**
   * Register event listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove event listener
   */
  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const callbacks = this.listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error in ${event} listener:`, error);
      }
    });
  }

  /**
   * Send typing indicator
   */
  sendTyping(topicId, username) {
    this.send({
      type: 'typing',
      topicId,
      username
    });
  }
}

// Global realtime client
window.realtimeClient = new RealtimeClient();

// Auto-connect when authenticated
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for auth to initialize
  setTimeout(() => {
    if (window.authManager && window.authManager.isAuthenticated()) {
      window.realtimeClient.connect();
    }
  }, 1000);
});

// Handle auth state changes
if (window.authManager) {
  window.authManager.on('login', () => {
    window.realtimeClient.connect();
  });

  window.authManager.on('logout', () => {
    window.realtimeClient.disconnect();
  });
}

// Graceful disconnect on page unload
window.addEventListener('beforeunload', () => {
  window.realtimeClient.disconnect();
});
