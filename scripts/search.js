document.addEventListener('DOMContentLoaded', function() {
    const searchBar = document.querySelector('.search-bar');

    if (!searchBar) return;

    // Create and append search results container
    const searchResults = document.createElement('div');
    searchResults.className = 'search-results';
    // ensure container positioned relative to parent
    searchBar.parentNode.style.position = 'relative';
    searchBar.parentNode.appendChild(searchResults);

    let articles = [];

    // Fetch the generated search index
    fetch('/search-index.json')
        .then(res => res.json())
        .then(data => { articles = data; })
        .catch(() => { articles = []; });

    let selectedIndex = -1;

    function renderResults(matches) {
        if (!matches || matches.length === 0) {
            searchResults.innerHTML = '<div class="no-results">No matching articles found</div>';
            searchResults.style.display = 'block';
            return;
        }

        searchResults.innerHTML = matches.map((article, i) => `
            <a href="${article.url}" class="search-result-item" data-index="${i}">
                <span class="result-title">${article.title}</span>
                <div class="result-excerpt">${article.excerpt || ''}</div>
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
        const matches = articles.filter(a => {
            const title = (a.title || '').toLowerCase();
            if (title.includes(query)) return true;
            if ((a.excerpt || '').toLowerCase().includes(query)) return true;
            if (Array.isArray(a.keywords) && a.keywords.some(k => k.includes(query))) return true;
            return false;
        }).slice(0, 10);
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
});