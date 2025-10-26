// Reading Progress Bar
document.addEventListener('DOMContentLoaded', function() {
    const progressContainer = document.querySelector('.progress-container');
    const progressBar = document.querySelector('.progress-bar');

    if (progressContainer && progressBar) {
        window.addEventListener('scroll', function() {
            // Calculate reading progress
            const windowHeight = window.innerHeight;
            const fullHeight = document.documentElement.scrollHeight - windowHeight;
            const scrolled = (window.scrollY / fullHeight) * 100;
            
            // Update progress bar width
            progressBar.style.width = scrolled + '%';
        });
    }
});