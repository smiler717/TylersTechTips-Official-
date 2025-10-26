// Add copy buttons to all code blocks
(function() {
    function addCopyButtons() {
        // Find all command code blocks
        const codeBlocks = document.querySelectorAll('.command-code');
        
        codeBlocks.forEach(codeBlock => {
            // Skip if already has a copy button
            if (codeBlock.parentElement.querySelector('.copy-btn')) {
                return;
            }

            // Wrap code block if not already wrapped
            if (!codeBlock.parentElement.classList.contains('command-code-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'command-code-wrapper';
                codeBlock.parentNode.insertBefore(wrapper, codeBlock);
                wrapper.appendChild(codeBlock);
            }

            // Create copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.textContent = 'Copy';
            copyBtn.setAttribute('aria-label', 'Copy code to clipboard');

            // Add click handler
            copyBtn.addEventListener('click', async () => {
                const code = codeBlock.textContent.trim();
                
                try {
                    await navigator.clipboard.writeText(code);
                    
                    // Visual feedback
                    copyBtn.classList.add('copied');
                    copyBtn.textContent = 'Copied';
                    
                    // Reset after 2 seconds
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.textContent = 'Copy';
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy:', err);
                    copyBtn.textContent = 'Failed';
                    setTimeout(() => {
                        copyBtn.textContent = 'Copy';
                    }, 2000);
                }
            });

            // Append button to wrapper
            codeBlock.parentElement.appendChild(copyBtn);
        });
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addCopyButtons);
    } else {
        addCopyButtons();
    }
})();
