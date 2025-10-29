/**
 * Client-side authentication handling
 */

(function() {
  const TOKEN_KEY = 'tt_auth_token';
  const USER_KEY = 'tt_user_data';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearAuth() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getUserData() {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  }

  function setUserData(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function showError(message) {
    const container = document.getElementById('error-container');
    if (container) {
      container.innerHTML = `<div class="error-msg"><i class="fas fa-exclamation-circle"></i> ${message}</div>`;
      setTimeout(() => container.innerHTML = '', 5000);
    }
  }

  function showSuccess(message) {
    const container = document.getElementById('success-container');
    if (container) {
      container.innerHTML = `<div class="success-msg"><i class="fas fa-check-circle"></i> ${message}</div>`;
      setTimeout(() => container.innerHTML = '', 5000);
    }
  }

  // Switch between login/register tabs
  window.switchTab = function(tab, event) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    if (event && event.target) {
      event.target.classList.add('active');
    }
    document.getElementById(`${tab}-form`).classList.add('active');
  };

  // Handle login
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Login failed');
        return;
      }

      setToken(data.token);
      setUserData(data.user);
      showSuccess('Login successful!');
      // If a return URL is provided, navigate back after login
      const params = new URLSearchParams(location.search);
      const next = params.get('next');
      setTimeout(() => {
        if (next) {
          location.href = next;
        } else {
          loadProfile();
        }
      }, 600);

    } catch (e) {
      showError('Network error. Please try again.');
    }
  });

  // Handle registration
  document.getElementById('register-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const displayName = document.getElementById('register-display-name').value;

    try {
      // Client-side password complexity check
      if (!/^.{8,}$/.test(password) || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        showError('Password must be at least 8 chars and include uppercase, lowercase, number, and special character.');
        return;
      }
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, displayName })
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Registration failed');
        return;
      }

      showSuccess('Account created! Please login.');
      setTimeout(() => {
        document.querySelector('[onclick*="login"]').click();
        document.getElementById('login-username').value = username;
      }, 1500);

    } catch (e) {
      showError('Network error. Please try again.');
    }
  });

  // Handle profile update
  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    const displayName = document.getElementById('edit-display-name').value;
    const bio = document.getElementById('edit-bio').value;
    const avatarUrl = document.getElementById('edit-avatar-url').value;

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ displayName, bio, avatarUrl })
      });

      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'Update failed');
        return;
      }

  setUserData(data.user);
  showSuccess('Profile updated!');
      loadProfile();

    } catch (e) {
      showError('Network error. Please try again.');
    }
  });

  // Load profile
  async function loadProfile() {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        clearAuth();
        return;
      }

  const data = await res.json();
  const user = data.user;

      // Hide auth forms, show profile
      document.getElementById('auth-section').style.display = 'none';
      document.getElementById('profile-section').classList.add('active');

  // Populate profile
      document.getElementById('profile-display-name').textContent = user.displayName || user.username;
      document.getElementById('profile-username').textContent = user.username;
      document.getElementById('profile-email').textContent = user.email;

      // Avatar is set below with fallback

      // Edit form
      document.getElementById('edit-display-name').value = user.displayName || '';
      document.getElementById('edit-bio').value = user.bio || '';
      document.getElementById('edit-avatar-url').value = user.avatarUrl || '';

      // Member since
      if (user.createdAt) {
        const date = new Date(user.createdAt);
        document.getElementById('profile-member-since').textContent = `Member since ${date.toLocaleDateString()}`;
        const days = Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24));
        document.getElementById('stat-days').textContent = days;
      } else {
        document.getElementById('profile-member-since').textContent = '';
      }

      // Last login
      const lastLoginEl = document.getElementById('profile-last-login');
      if (lastLoginEl) {
        if (user.lastLogin) {
          const last = new Date(user.lastLogin);
          lastLoginEl.textContent = `Last login ${last.toLocaleString()}`;
        } else {
          lastLoginEl.textContent = '';
        }
      }

      // Email verification banner
      const verifyBanner = document.getElementById('verify-banner');
      if (verifyBanner) {
        verifyBanner.style.display = user.emailVerified ? 'none' : '';
      }

      // Avatar fallback
      var avatar = document.getElementById('profile-avatar');
      if (user.avatarUrl) {
        avatar.innerHTML = `<img src="${user.avatarUrl}" alt="Avatar">`;
      } else {
        avatar.innerHTML = `<span style='font-size:2.5rem;'>${(user.displayName || user.username).charAt(0).toUpperCase()}</span>`;
      }

      // Persist latest user data (includes createdAt/lastLogin for navbar tooltip on other pages)
      try { setUserData(user); } catch (_) {}

    } catch (e) {
      console.error('Failed to load profile:', e);
    }
  }

  // Logout
  window.handleLogout = async function() {
    const token = getToken();
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {
        // Ignore errors
      }
    }
    clearAuth();
    location.reload();
  };

  // Check if already logged in
  (function onLoadRouting() {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    const next = params.get('next');
    const token = getToken();

    // Preselect tab based on action param
    if (action === 'register') {
      document.querySelector('[onclick*="register"]')?.click();
    } else if (action === 'login') {
      document.querySelector('[onclick*="login"]')?.click();
    }

    // If already logged in and a next URL exists, go there immediately
    if (token && next) {
      location.href = next;
      return;
    }

    if (token) {
      loadProfile();
    }
  })();

  // Change password handler
  document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    const current = document.getElementById('current-password').value;
    const next = document.getElementById('new-password').value;
    if (!current || !next || next.length < 8 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/\d/.test(next) || !/[^A-Za-z0-9]/.test(next)) {
      showError('New password must be 8+ chars and include uppercase, lowercase, number, and special character.');
      return;
    }
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ password: next, currentPassword: current })
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error || 'Password change failed');
        return;
      }
      showSuccess('Password changed!');
      document.getElementById('change-password-form').reset();
    } catch (e) {
      showError('Network error. Please try again.');
    }
  });

  // Security actions: Refresh session
  document.getElementById('refresh-session-btn')?.addEventListener('click', async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error || 'Failed to refresh session');
        return;
      }
      setToken(data.token);
      if (window.TT_UI?.toast) window.TT_UI.toast('Session refreshed', 'success'); else showSuccess('Session refreshed');
    } catch (_) {
      showError('Network error. Please try again.');
    }
  });

  // Security actions: Logout all devices
  document.getElementById('logout-all-btn')?.addEventListener('click', async () => {
    const token = getToken();
    if (!token) return;
    if (!confirm('Logout from all devices? You will need to login again.')) return;
    try {
      const res = await fetch('/api/auth/logout-all', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || 'Failed to logout all devices');
        return;
      }
      if (window.TT_UI?.toast) window.TT_UI.toast('Logged out on all devices', 'success');
      // Current token revoked too; clear and reload
      clearAuth();
      location.reload();
    } catch (_) {
      showError('Network error. Please try again.');
    }
  });

  // Resend verification
  document.getElementById('resend-verify-btn')?.addEventListener('click', async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/auth/resend-verification', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(data.error || 'Failed to resend verification');
        return;
      }
      if (window.TT_UI?.toast) window.TT_UI.toast('Verification email sent (or link generated)', 'success'); else showSuccess('Verification email sent');
      // Dev: if endpoint returned, try to copy the link
      if (data?.verify?.endpoint) {
        const site = location.origin || '';
        const link = `${site}${data.verify.endpoint}`;
        try {
          await navigator.clipboard?.writeText(link);
          if (window.TT_UI?.toast) window.TT_UI.toast('Verification link copied to clipboard', 'success');
        } catch (_) {}
      }
    } catch (_) {
      showError('Network error. Please try again.');
    }
  });

  // Export auth functions for use in other scripts
  window.TT_Auth = {
    getToken,
    getUserData,
    isLoggedIn: () => !!getToken(),
    clearAuth
  };
})();
