// Theme switcher with localStorage persistence
(function() {
    const THEME_KEY = 'tylers-tech-theme';
    const DARK_THEME = 'dark';
    const LIGHT_THEME = 'light';
    // Auth keys (mirrors scripts/auth.js)
    const TOKEN_KEY = 'tt_auth_token';
    const USER_KEY = 'tt_user_data';

    // Get current theme from localStorage or system preference
    function getPreferredTheme() {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved) return saved;
        
        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return DARK_THEME;
        }
        return LIGHT_THEME;
    }

    // Apply theme to document
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem(THEME_KEY, theme);
        
        // Update toggle button if it exists
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            const icon = toggle.querySelector('.theme-icon');
            if (icon) {
                icon.textContent = theme === DARK_THEME ? '☀️' : '🌙';
            }
        }
    }

    // Toggle between themes
    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || LIGHT_THEME;
        const next = current === DARK_THEME ? LIGHT_THEME : DARK_THEME;
        applyTheme(next);
    }

    // Initialize theme immediately (before page load)
    const initialTheme = getPreferredTheme();
    applyTheme(initialTheme);

    // Setup toggle button when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupToggle);
    } else {
        setupToggle();
    }

    function setupToggle() {
        const toggle = document.getElementById('theme-toggle');
        if (toggle) {
            toggle.addEventListener('click', toggleTheme);
            // Set initial icon
            const icon = toggle.querySelector('.theme-icon');
            if (icon) {
                const current = document.documentElement.getAttribute('data-theme') || LIGHT_THEME;
                icon.textContent = current === DARK_THEME ? '☀️' : '🌙';
            }
        }

        // After theme toggle setup, render user navbar state
        renderUserNavbar();
    }

    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem(THEME_KEY)) {
                applyTheme(e.matches ? DARK_THEME : LIGHT_THEME);
            }
        });
    }

    // --- User Navbar UI ---
    function getUser() {
        try { const raw = localStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
    }
    function isLoggedIn() {
        return !!localStorage.getItem(TOKEN_KEY);
    }
    function clearAuthAndReload() {
        try {
            if (window.TT_Auth && typeof window.TT_Auth.clearAuth === 'function') {
                window.TT_Auth.clearAuth();
            } else {
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(USER_KEY);
            }
        } catch (_) {}
        // If on profile page with next param, go to that next; else reload
        const params = new URLSearchParams(location.search);
        const next = params.get('next');
        if (next) { location.href = next; return; }
        location.reload();
    }

    function renderUserNavbar() {
        try {
            const navbar = document.querySelector('nav.navbar');
            if (!navbar) return;
            const btn = navbar.querySelector('.join-community-btn');
            if (!btn) return;

            // Ensure wrapper for dropdown positioning
            let wrapper = btn.closest('.user-menu');
            if (!wrapper) {
                wrapper = document.createElement('div');
                wrapper.className = 'user-menu';
                // Keep inline in navbar
                btn.replaceWith(wrapper);
                wrapper.appendChild(btn);
            }

            // Remove any existing toggle/menu to rebuild cleanly
            wrapper.querySelector('.user-menu-toggle')?.remove();
            wrapper.querySelector('.user-menu-dropdown')?.remove();

            if (isLoggedIn()) {
                const user = getUser() || {};
                const name = (user.displayName || user.username || 'My Profile');
                const initial = (name || 'U').trim().charAt(0).toUpperCase();
                const avatarUrl = user.avatarUrl || '';
                // Switch button to profile with avatar + name
                btn.href = 'profile.html';
                btn.title = 'View your profile';
                btn.innerHTML = `
                  <span class="user-avatar-chip" ${avatarUrl ? `style=\"background-image:url('${escapeAttr(avatarUrl)}')\"` : ''}>${avatarUrl ? '' : escapeHtml(initial)}</span>
                  <span class="user-name">${escapeHtml(name)}</span>
                `;

                // Add a small caret toggle to open dropdown
                const toggle = document.createElement('button');
                toggle.className = 'user-menu-toggle';
                toggle.type = 'button';
                toggle.setAttribute('aria-expanded', 'false');
                toggle.innerHTML = '<i class="fas fa-caret-down"></i>';
                wrapper.appendChild(toggle);

                // Build dropdown
                const menu = document.createElement('div');
                menu.className = 'user-menu-dropdown';
                menu.innerHTML = `
                  <a href="profile.html"><i class="fas fa-user"></i> My Profile</a>
                  <button type="button" class="logout-item"><i class="fas fa-sign-out-alt"></i> Logout</button>
                `;
                wrapper.appendChild(menu);

                // Wire interactions
                toggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    const open = menu.classList.toggle('open');
                    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
                });
                menu.querySelector('.logout-item')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    clearAuthAndReload();
                });
                document.addEventListener('click', (e) => {
                    if (!wrapper.contains(e.target)) {
                        menu.classList.remove('open');
                        toggle.setAttribute('aria-expanded', 'false');
                    }
                }, { capture: true });
            } else {
                // Logged out: default Join Community button
                btn.href = 'profile.html';
                btn.innerHTML = '<i class="fas fa-users"></i> Join Community';
                btn.title = 'Join the community';
            }
        } catch (err) {
            // no-op
        }
    }

    function escapeHtml(str){
        const d = document.createElement('div');
        d.textContent = String(str ?? '');
        return d.innerHTML;
    }
    function escapeAttr(str){
        return String(str ?? '').replace(/"/g, '&quot;');
    }
})();
