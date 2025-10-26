// Calculate and display reading time for articles
(function() {
    function calculateReadingTime() {
        const articleBody = document.querySelector('.article-body');
        if (!articleBody) return;

        // Count words in article
        const text = articleBody.textContent || articleBody.innerText;
        const wordCount = text.trim().split(/\s+/).length;
        
        // Average reading speed: 200-250 words per minute
        const wordsPerMinute = 225;
        const readingTimeMinutes = Math.ceil(wordCount / wordsPerMinute);

        // Create reading time badge
        const readingTimeBadge = document.createElement('span');
        readingTimeBadge.className = 'reading-time-badge';
        readingTimeBadge.innerHTML = `<i class="fas fa-clock"></i> ${readingTimeMinutes} min read`;

        // Insert after article meta
        const articleMeta = document.querySelector('.article-meta');
        if (articleMeta) {
            articleMeta.parentNode.insertBefore(readingTimeBadge, articleMeta.nextSibling);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', calculateReadingTime);
    } else {
        calculateReadingTime();
    }
})();
