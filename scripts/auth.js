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
  window.switchTab = function(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    
    event.target.classList.add('active');
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
      setTimeout(() => loadProfile(), 1000);

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
      showSuccess('Profile updated successfully!');
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

      // Avatar
      const avatar = document.getElementById('profile-avatar');
      if (user.avatarUrl) {
        avatar.innerHTML = `<img src="${user.avatarUrl}" alt="Avatar">`;
      } else {
        avatar.textContent = (user.displayName || user.username).charAt(0).toUpperCase();
      }

      // Edit form
      document.getElementById('edit-display-name').value = user.displayName || '';
      document.getElementById('edit-bio').value = user.bio || '';
      document.getElementById('edit-avatar-url').value = user.avatarUrl || '';

      // Stats (calculate days active)
      if (user.createdAt) {
        const days = Math.floor((Date.now() - user.createdAt) / (1000 * 60 * 60 * 24));
        document.getElementById('stat-days').textContent = days;
      }

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
  if (getToken()) {
    loadProfile();
  }

  // Export auth functions for use in other scripts
  window.TT_Auth = {
    getToken,
    getUserData,
    isLoggedIn: () => !!getToken(),
    clearAuth
  };
})();
