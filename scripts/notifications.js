/**
 * Notification UI Component
 * Displays notifications with bell icon and dropdown
 */

class NotificationManager {
  constructor() {
    this.unreadCount = 0;
    this.notifications = [];
    this.pollInterval = null;
    this.isOpen = false;
    
    this.init();
  }

  init() {
    // Create notification UI
    this.createUI();
    
    // Load initial notifications
    this.loadNotifications();
    
    // Start polling for new notifications every 30 seconds
    this.startPolling();
  }

  createUI() {
    // Create notification bell container
    const container = document.createElement('div');
    container.className = 'notification-container';
    container.innerHTML = `
      <button class="notification-bell" id="notification-bell" aria-label="Notifications">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        <span class="notification-badge" id="notification-badge" style="display: none;">0</span>
      </button>
      <div class="notification-dropdown" id="notification-dropdown" style="display: none;">
        <div class="notification-header">
          <h3>Notifications</h3>
          <button class="mark-all-read" id="mark-all-read">Mark all read</button>
        </div>
        <div class="notification-list" id="notification-list">
          <p class="notification-empty">No notifications</p>
        </div>
      </div>
    `;

    // Insert at the end of navbar or header
    const navbar = document.querySelector('nav') || document.querySelector('header');
    if (navbar) {
      navbar.appendChild(container);
    } else {
      document.body.appendChild(container);
    }

    // Event listeners
    document.getElementById('notification-bell').addEventListener('click', () => {
      this.toggleDropdown();
    });

    document.getElementById('mark-all-read').addEventListener('click', () => {
      this.markAllRead();
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.notification-container')) {
        this.closeDropdown();
      }
    });
  }

  async loadNotifications() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch('/api/notifications?limit=10', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) return;

      const data = await response.json();
      this.notifications = data.notifications || [];
      this.unreadCount = data.unread || 0;

      this.updateUI();
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }

  updateUI() {
    // Update badge
    const badge = document.getElementById('notification-badge');
    if (this.unreadCount > 0) {
      badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }

    // Update notification list
    const list = document.getElementById('notification-list');
    if (this.notifications.length === 0) {
      list.innerHTML = '<p class="notification-empty">No notifications</p>';
      return;
    }

    list.innerHTML = this.notifications.map(n => `
      <div class="notification-item ${n.isRead ? 'read' : 'unread'}" data-id="${n.id}">
        <div class="notification-content">
          <strong>${this.escapeHtml(n.title)}</strong>
          ${n.body ? `<p>${this.escapeHtml(n.body)}</p>` : ''}
          <span class="notification-time">${this.formatTime(n.createdAt)}</span>
        </div>
        <div class="notification-actions">
          ${n.link ? `<a href="${n.link}" class="notification-link">View</a>` : ''}
          ${!n.isRead ? `<button class="mark-read-btn" onclick="notificationManager.markRead(${n.id})">✓</button>` : ''}
          <button class="delete-btn" onclick="notificationManager.deleteNotification(${n.id})">×</button>
        </div>
      </div>
    `).join('');
  }

  toggleDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    this.isOpen = !this.isOpen;
    dropdown.style.display = this.isOpen ? 'block' : 'none';

    if (this.isOpen) {
      this.loadNotifications();
    }
  }

  closeDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    this.isOpen = false;
    dropdown.style.display = 'none';
  }

  async markRead(notificationId) {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'mark-read',
          ids: [notificationId]
        })
      });

      if (response.ok) {
        await this.loadNotifications();
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  async markAllRead() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: 'mark-read'
        })
      });

      if (response.ok) {
        await this.loadNotifications();
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }

  async deleteNotification(notificationId) {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ids: [notificationId]
        })
      });

      if (response.ok) {
        await this.loadNotifications();
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  }

  startPolling() {
    // Poll every 30 seconds
    this.pollInterval = setInterval(() => {
      this.loadNotifications();
    }, 30000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  formatTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize notification manager when user is logged in
let notificationManager = null;

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('authToken');
  if (token) {
    notificationManager = new NotificationManager();
  }
});

// Re-initialize when user logs in
window.addEventListener('user-logged-in', () => {
  if (!notificationManager) {
    notificationManager = new NotificationManager();
  }
});

// Stop polling when user logs out
window.addEventListener('user-logged-out', () => {
  if (notificationManager) {
    notificationManager.stopPolling();
    notificationManager = null;
  }
});
