// Automatically populate related articles based on tags/categories
(function() {
    // Article metadata - maps article filename to its info
    const articles = {
        'build-pc.html': {
            title: 'Building Your First PC',
            tags: ['hardware', 'pc building', 'beginner'],
            category: 'articles',
            icon: 'fa-tools',
            description: 'A complete guide to building your first computer from scratch.'
        },
        'cpu-2025.html': {
            title: 'Understanding CPUs in 2025',
            tags: ['hardware', 'cpu', 'processors'],
            category: 'articles',
            icon: 'fa-microchip',
            description: 'A deep dive into the latest processor trends and technologies.'
        },
        'how-to-install-ssd.html': {
            title: 'How to Install an SSD',
            tags: ['hardware', 'storage', 'tutorial'],
            category: 'articles',
            icon: 'fa-hdd',
            description: 'Step-by-step guide to installing a solid-state drive.'
        },
        'windows-server-setup.html': {
            title: 'Windows Server Setup',
            tags: ['server', 'windows', 'enterprise'],
            category: 'projects',
            icon: 'fa-server',
            description: 'Complete guide to setting up Windows Server 2025.'
        },
        'intune-setup.html': {
            title: 'Microsoft Intune Implementation',
            tags: ['cloud', 'management', 'enterprise'],
            category: 'projects',
            icon: 'fa-mobile-alt',
            description: 'Implementing Microsoft Intune for device management.'
        },
        'network-monitoring.html': {
            title: 'Network Monitoring Tools',
            tags: ['networking', 'monitoring', 'enterprise'],
            category: 'projects',
            icon: 'fa-chart-line',
            description: 'Setting up network monitoring and analysis tools.'
        }
    };

    function getCurrentArticle() {
        // Normalize current path to a known key, tolerating pretty URLs without .html
        const path = decodeURIComponent(window.location.pathname);
        const last = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
        if (articles[last]) return last;
        // Try adding .html if missing
        if (!last.includes('.')) {
            const withHtml = `${last}.html`;
            if (articles[withHtml]) return withHtml;
        }
        // Try index.html in a folder
        if (last === '' && articles['index.html']) return 'index.html';
        // As a final fallback, try matching by title text
        const h1 = document.querySelector('.article-header h1, h1');
        const text = h1 ? h1.textContent.trim().toLowerCase() : '';
        if (text) {
            const match = Object.entries(articles).find(([, a]) => (a.title || '').toLowerCase() === text);
            if (match) return match[0];
        }
        return last;
    }

    function calculateSimilarity(tags1, tags2) {
        const set1 = new Set(tags1);
        const set2 = new Set(tags2);
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        return intersection.size / union.size; // Jaccard similarity
    }

    function getRelatedArticles(currentFile, maxResults = 3) {
        const current = articles[currentFile];
        if (!current) return [];

        const scored = Object.entries(articles)
            .filter(([file]) => file !== currentFile)
            .map(([file, article]) => ({
                file,
                ...article,
                score: calculateSimilarity(current.tags, article.tags)
            }))
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);

        return scored;
    }

    function renderRelatedArticles() {
        const container = document.querySelector('.related-articles');
        if (!container) return;

        const currentFile = getCurrentArticle();
        const related = getRelatedArticles(currentFile, 3);

        // If nothing computed, keep any existing static content visible
        if (related.length === 0) return;

        const grid = container.querySelector('.article-grid');
        if (!grid) return;

        grid.innerHTML = related.map(article => `
            <div class="article-card">
                <h3><i class="fas ${article.icon}"></i> ${article.title}</h3>
                <p>${article.description}</p>
                <a href="${article.file}" class="read-more">Read More</a>
            </div>
        `).join('');
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderRelatedArticles);
    } else {
        renderRelatedArticles();
    }
})();
