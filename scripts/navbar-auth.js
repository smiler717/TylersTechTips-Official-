/**
 * Navbar Auth Button
 * Adds Join Community / Profile button to navbar
 */

(function() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavbarAuth);
  } else {
    initNavbarAuth();
  }

  function initNavbarAuth() {
    const navbar = document.querySelector('.nav-links');
    if (!navbar) return;

    // Create auth button container
    const authLi = document.createElement('li');
    authLi.id = 'nav-auth-container';
    authLi.style.marginLeft = 'auto';

    // Check if user is logged in
    const token = localStorage.getItem('tt_auth_token');
    const userData = localStorage.getItem('tt_user_data');

    if (token && userData) {
      // User is logged in - show profile button
      const user = JSON.parse(userData);
      const displayName = user.displayName || user.username;
      const initial = displayName.charAt(0).toUpperCase();

      authLi.innerHTML = `
        <a href="/profile" class="profile-link" style="display:flex;align-items:center;gap:0.5rem;">
          <div class="nav-avatar" style="width:32px;height:32px;border-radius:50%;background:var(--accent-color);color:white;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:0.9rem;">
            ${user.avatarUrl ? `<img src="${user.avatarUrl}" alt="Profile" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : initial}
          </div>
          <span style="display:none;" class="profile-name-desktop">${displayName}</span>
        </a>
      `;

      // Show name on desktop
      const mediaQuery = window.matchMedia('(min-width: 768px)');
      function updateProfileDisplay(e) {
        const nameSpan = authLi.querySelector('.profile-name-desktop');
        if (nameSpan) {
          nameSpan.style.display = e.matches ? 'inline' : 'none';
        }
      }
      mediaQuery.addListener(updateProfileDisplay);
      updateProfileDisplay(mediaQuery);

    } else {
      // User not logged in - show Join Community button
      authLi.innerHTML = `
        <a href="/profile" class="join-community-btn" style="background:var(--accent-color);color:white;padding:0.5rem 1rem;border-radius:6px;font-weight:600;transition:transform 0.2s;">
          <i class="fas fa-user-plus"></i> <span class="join-text">Join Community</span>
        </a>
      `;

      // Hover effect
      const btn = authLi.querySelector('.join-community-btn');
      if (btn) {
        btn.addEventListener('mouseenter', () => {
          btn.style.transform = 'scale(1.05)';
        });
        btn.addEventListener('mouseleave', () => {
          btn.style.transform = 'scale(1)';
        });
      }

      // Hide text on mobile
      const mediaQuery = window.matchMedia('(min-width: 768px)');
      function updateJoinButton(e) {
        const textSpan = authLi.querySelector('.join-text');
        if (textSpan) {
          textSpan.style.display = e.matches ? 'inline' : 'none';
        }
      }
      mediaQuery.addListener(updateJoinButton);
      updateJoinButton(mediaQuery);
    }

    // Insert before theme toggle button (if it exists in nav-links)
    navbar.appendChild(authLi);
  }

  // Listen for login/logout events
  window.addEventListener('storage', (e) => {
    if (e.key === 'tt_auth_token' || e.key === 'tt_user_data') {
      // Token changed, reload navbar
      const container = document.getElementById('nav-auth-container');
      if (container) {
        container.remove();
      }
      initNavbarAuth();
    }
  });
})();
