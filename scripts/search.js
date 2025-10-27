document.addEventListener('DOMContentLoaded', function() {
    const searchBar = document.querySelector('.search-bar');

    if (!searchBar) return;

    // Create and append search results container
    const searchResults = document.createElement('div');
    searchResults.className = 'search-results';
    // ensure container positioned relative to parent
    searchBar.parentNode.style.position = 'relative';
    searchBar.parentNode.appendChild(searchResults);

    let searchIndex = [];

    // Build comprehensive search index from multiple sources
    async function buildSearchIndex() {
        const index = [];
        
        // 1. Load static search index (articles/projects)
        try {
            const res = await fetch('/search-index.json');
            const articles = await res.json();
            index.push(...articles);
        } catch (_) {}

        // 2. Load community topics
        try {
            const res = await fetch('/api/topics', { 
                headers: { 'x-device-id': localStorage.getItem('ttt_device_id_v1') || 'anon' } 
            });
            if (res.ok) {
                const data = await res.json();
                const topics = (data.topics || []).map(t => ({
                    title: t.title,
                    excerpt: t.body?.slice(0, 150) + (t.body?.length > 150 ? '…' : ''),
                    url: `community.html#t-${t.id}`,
                    keywords: ['community', 'forum', 'discussion', t.author],
                    type: 'Community Topic'
                }));
                index.push(...topics);
            }
        } catch (_) {}

        // 3. Add static pages
        index.push(
            {
                title: 'About Tyler',
                excerpt: 'Learn about Tyler\'s journey in IT, certifications, and expertise',
                url: 'about.html',
                keywords: ['about', 'bio', 'certifications', 'contact'],
                type: 'Page'
            },
            {
                title: 'Community Forum',
                excerpt: 'Join discussions, ask questions, and share tech tips',
                url: 'community.html',
                keywords: ['community', 'forum', 'discussion', 'help'],
                type: 'Page'
            },
            {
                title: 'IT Cheat Sheet - CMD Commands',
                excerpt: 'Windows CMD commands for file operations, system info, and more',
                url: 'cheat-sheet.html',
                keywords: ['cmd', 'command', 'windows', 'terminal', 'cheat sheet'],
                type: 'Cheat Sheet'
            },
            {
                title: 'IT Cheat Sheet - PowerShell',
                excerpt: 'PowerShell commands for system management and automation',
                url: 'cheat-sheet.html',
                keywords: ['powershell', 'command', 'windows', 'script', 'cheat sheet'],
                type: 'Cheat Sheet'
            },
            {
                title: 'IT Cheat Sheet - Linux/Bash',
                excerpt: 'Linux and Bash commands for file operations and system tasks',
                url: 'cheat-sheet.html',
                keywords: ['linux', 'bash', 'unix', 'terminal', 'command', 'cheat sheet'],
                type: 'Cheat Sheet'
            },
            {
                title: 'IT Cheat Sheet - Networking',
                excerpt: 'Network diagnostic commands and troubleshooting tools',
                url: 'cheat-sheet.html',
                keywords: ['network', 'ping', 'dns', 'ip', 'troubleshoot', 'cheat sheet'],
                type: 'Cheat Sheet'
            },
            {
                title: 'IT Cheat Sheet - Git',
                excerpt: 'Git commands for version control and repository management',
                url: 'cheat-sheet.html',
                keywords: ['git', 'github', 'version control', 'repository', 'cheat sheet'],
                type: 'Cheat Sheet'
            },
            {
                title: 'IT Cheat Sheet - Solutions',
                excerpt: 'Common IT problems and step-by-step solutions',
                url: 'cheat-sheet.html',
                keywords: ['troubleshooting', 'solutions', 'fix', 'problem', 'help', 'cheat sheet'],
                type: 'Cheat Sheet'
            }
        );

        return index;
    }

    // Initialize search index
    buildSearchIndex().then(idx => { searchIndex = idx; });

    let selectedIndex = -1;

    function renderResults(matches) {
        if (!matches || matches.length === 0) {
            searchResults.innerHTML = '<div class="no-results">No results found</div>';
            searchResults.style.display = 'block';
            return;
        }

        searchResults.innerHTML = matches.map((item, i) => `
            <a href="${item.url}" class="search-result-item" data-index="${i}">
                <span class="result-title">${item.title}</span>
                ${item.type ? `<span class="result-type">${item.type}</span>` : ''}
                <div class="result-excerpt">${item.excerpt || ''}</div>
            </a>
        `).join('');
        searchResults.style.display = 'block';
        selectedIndex = -1;
    }

    function doSearch(query) {
        query = query.trim().toLowerCase();
        if (!query) {
            searchResults.style.display = 'none';
            return;
        }
        const matches = searchIndex.filter(item => {
            const title = (item.title || '').toLowerCase();
            if (title.includes(query)) return true;
            if ((item.excerpt || '').toLowerCase().includes(query)) return true;
            if (Array.isArray(item.keywords) && item.keywords.some(k => k.toLowerCase().includes(query))) return true;
            return false;
        }).slice(0, 12);
        renderResults(matches);
    }

    searchBar.addEventListener('input', function(e) { doSearch(e.target.value); });

    // Keyboard navigation
    searchBar.addEventListener('keydown', function(e) {
        const items = searchResults.querySelectorAll('.search-result-item');
        if (!items.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            items.forEach((it, i) => it.classList.toggle('selected', i === selectedIndex));
            items[selectedIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            items.forEach((it, i) => it.classList.toggle('selected', i === selectedIndex));
            items[selectedIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            const sel = searchResults.querySelector('.search-result-item.selected');
            if (sel) {
                window.location.href = sel.getAttribute('href');
            }
        } else if (e.key === 'Escape') {
            searchResults.style.display = 'none';
            searchBar.value = '';
        }
    });

    // Click on result
    searchResults.addEventListener('click', function(e) {
        const a = e.target.closest('.search-result-item');
        if (a) return; // default link navigation
    });

    // Hide results when clicking outside
    document.addEventListener('click', function(e) {
        if (!searchBar.parentNode.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ignore when typing in inputs/textareas or when modifier keys are used
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        const typing = tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable;
        if (typing) return;

        // Focus search with '/'
        if (e.key === '/') {
            e.preventDefault();
            searchBar.focus();
            try { searchBar.select(); } catch(_) {}
        }

        // Quick help with '?'
        if (e.key === '?') {
            e.preventDefault();
            // Lightweight, non-intrusive hint
            const hint = document.createElement('div');
            hint.className = 'shortcut-hint';
            hint.textContent = "Tip: Press '/' to search, Esc to close results.";
            Object.assign(hint.style, {
                position: 'fixed',
                bottom: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--secondary-bg, rgba(0,0,0,0.8))',
                color: 'var(--text-color, #fff)',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--card-border, rgba(255,255,255,0.2))',
                zIndex: 9999,
                fontSize: '0.95rem',
            });
            document.body.appendChild(hint);
            setTimeout(() => hint.remove(), 2200);
        }
    });
});