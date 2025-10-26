// Generate Table of Contents from article headings
(function() {
    function generateTOC() {
        const articleBody = document.querySelector('.article-body');
        if (!articleBody) return;

        // Find all h2 and h3 headings
        const headings = articleBody.querySelectorAll('h2, h3');
        if (headings.length < 3) return; // Only show TOC if 3+ headings

        // Create TOC container
        const tocContainer = document.createElement('div');
        tocContainer.className = 'toc-container';
        tocContainer.innerHTML = `
            <div class="toc-header">
                <h3><i class="fas fa-list"></i> Table of Contents</h3>
            </div>
            <nav class="toc-nav">
                <ul class="toc-list"></ul>
            </nav>
        `;

        const tocList = tocContainer.querySelector('.toc-list');

        // Generate TOC items and add IDs to headings
        headings.forEach((heading, index) => {
            // Add ID to heading if it doesn't have one
            if (!heading.id) {
                heading.id = `heading-${index}`;
            }

            const li = document.createElement('li');
            li.className = `toc-item toc-${heading.tagName.toLowerCase()}`;
            
            const link = document.createElement('a');
            link.href = `#${heading.id}`;
            link.textContent = heading.textContent;
            link.className = 'toc-link';
            
            // Smooth scroll on click
            link.addEventListener('click', (e) => {
                e.preventDefault();
                heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
                history.pushState(null, null, `#${heading.id}`);
            });

            li.appendChild(link);
            tocList.appendChild(li);
        });

        // Insert TOC after article header
        const articleHeader = document.querySelector('.article-header');
        const shareButtons = document.querySelector('.share-buttons');
        
        if (shareButtons) {
            shareButtons.parentNode.insertBefore(tocContainer, shareButtons.nextSibling);
        } else if (articleHeader) {
            articleHeader.parentNode.insertBefore(tocContainer, articleHeader.nextSibling);
        }

        // Highlight active section on scroll
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const id = entry.target.id;
                const tocLink = tocContainer.querySelector(`a[href="#${id}"]`);
                
                if (entry.isIntersecting) {
                    // Remove active class from all links
                    tocContainer.querySelectorAll('.toc-link').forEach(link => {
                        link.classList.remove('active');
                    });
                    // Add active class to current link
                    if (tocLink) {
                        tocLink.classList.add('active');
                    }
                }
            });
        }, {
            rootMargin: '-20% 0px -70% 0px'
        });

        headings.forEach(heading => observer.observe(heading));
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', generateTOC);
    } else {
        generateTOC();
    }
})();
