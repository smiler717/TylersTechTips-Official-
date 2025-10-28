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
            if (isLoggedIn()) {
                const user = getUser() || {};
                const name = (user.displayName || user.username || 'My Profile');
                // Switch button to profile with name
                btn.href = 'profile.html';
                btn.innerHTML = `<i class="fas fa-user-circle"></i> ${escapeHtml(name)}`;
                btn.title = 'View your profile';
                // Ensure a logout pill exists to the right
                let logout = navbar.querySelector('.nav-logout-pill');
                if (!logout) {
                    logout = document.createElement('button');
                    logout.className = 'nav-logout-pill pill';
                    logout.type = 'button';
                    logout.style.marginLeft = '8px';
                    logout.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
                    logout.addEventListener('click', (e) => { e.preventDefault(); clearAuthAndReload(); });
                    // Insert after the profile button
                    btn.insertAdjacentElement('afterend', logout);
                }
            } else {
                // Logged out: ensure default Join Community button
                btn.href = 'profile.html';
                btn.innerHTML = '<i class="fas fa-users"></i> Join Community';
                btn.title = 'Join the community';
                // Remove logout pill if present
                const logout = navbar.querySelector('.nav-logout-pill');
                if (logout) logout.remove();
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
})();
