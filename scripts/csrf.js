/**
 * CSRF Token Management
 * Automatically includes CSRF tokens in API requests
 */

class CsrfManager {
  constructor() {
    this.token = null;
    this.deviceId = this.getOrCreateDeviceId();
  }

  /**
   * Get or create a unique device ID
   */
  getOrCreateDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
      deviceId = this.generateDeviceId();
      localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
  }

  /**
   * Generate a random device ID
   */
  generateDeviceId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Fetch a new CSRF token from the server
   */
  async fetchToken() {
    try {
      const response = await fetch('/api/csrf/token', {
        headers: {
          'x-device-id': this.deviceId
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch CSRF token:', response.statusText);
        return null;
      }

      const data = await response.json();
      this.token = data.token;
      return this.token;
    } catch (error) {
      console.error('Error fetching CSRF token:', error);
      return null;
    }
  }

  /**
   * Get current token or fetch a new one
   */
  async getToken() {
    if (!this.token) {
      await this.fetchToken();
    }
    return this.token;
  }

  /**
   * Refresh the CSRF token
   */
  async refreshToken() {
    this.token = null;
    return this.fetchToken();
  }

  /**
   * Get headers including CSRF token and device ID
   */
  async getHeaders(additionalHeaders = {}) {
    const token = await this.getToken();
    return {
      'x-device-id': this.deviceId,
      'x-csrf-token': token || '',
      ...additionalHeaders
    };
  }

  /**
   * Enhanced fetch with automatic CSRF token inclusion
   */
  async fetch(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();

    // Include CSRF token for mutating methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const token = await this.getToken();
      options.headers = {
        'x-device-id': this.deviceId,
        'x-csrf-token': token || '',
        ...options.headers
      };
    }

    try {
      const response = await fetch(url, options);

      // If we get a 403 with CSRF error, try refreshing token once
      if (response.status === 403 && method !== 'GET') {
        const errorData = await response.json().catch(() => ({}));
        if (errorData.error?.includes('CSRF')) {
          console.log('CSRF token invalid, refreshing...');
          await this.refreshToken();

          // Retry with new token
          const newToken = await this.getToken();
          options.headers = {
            ...options.headers,
            'x-csrf-token': newToken || ''
          };
          return fetch(url, options);
        }
      }

      return response;
    } catch (error) {
      console.error('Fetch error:', error);
      throw error;
    }
  }
}

// Global CSRF manager instance
window.csrfManager = new CsrfManager();

// Initialize token on page load
document.addEventListener('DOMContentLoaded', () => {
  window.csrfManager.fetchToken();
});
