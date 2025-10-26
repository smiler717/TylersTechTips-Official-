// Social sharing functionality
(function() {
    function createShareButtons() {
        const shareButtons = document.querySelector('.share-buttons');
        if (!shareButtons) return;

        const pageUrl = encodeURIComponent(window.location.href);
        const pageTitle = encodeURIComponent(document.title);
        
        // Twitter share with @Tylers_TechTips mention
        const twitterBtn = shareButtons.querySelector('.share-twitter');
        if (twitterBtn) {
            twitterBtn.href = `https://twitter.com/intent/tweet?url=${pageUrl}&text=${pageTitle}&via=Tylers_TechTips`;
        }

        // Facebook share
        const facebookBtn = shareButtons.querySelector('.share-facebook');
        if (facebookBtn) {
            facebookBtn.href = `https://www.facebook.com/sharer/sharer.php?u=${pageUrl}`;
        }

        // LinkedIn share
        const linkedinBtn = shareButtons.querySelector('.share-linkedin');
        if (linkedinBtn) {
            linkedinBtn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${pageUrl}`;
        }

        // Copy link button
        const copyBtn = shareButtons.querySelector('.share-copy');
        if (copyBtn) {
            copyBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    const originalText = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                    copyBtn.classList.add('copied');
                    
                    setTimeout(() => {
                        copyBtn.innerHTML = originalText;
                        copyBtn.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy link:', err);
                }
            });
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createShareButtons);
    } else {
        createShareButtons();
    }
})();
