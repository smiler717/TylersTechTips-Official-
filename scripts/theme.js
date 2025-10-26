// Theme switcher with localStorage persistence
(function() {
    const THEME_KEY = 'tylers-tech-theme';
    const DARK_THEME = 'dark';
    const LIGHT_THEME = 'light';

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
    }

    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (!localStorage.getItem(THEME_KEY)) {
                applyTheme(e.matches ? DARK_THEME : LIGHT_THEME);
            }
        });
    }
})();
