// Auto-insert breadcrumbs on all pages except the homepage
(function(){
  const file = location.pathname.split('/').pop() || 'index.html';
  if (file === '' || file === 'index.html') return; // no breadcrumbs on home
  if (!document.querySelector('.article-header')) return; // only add where article layout exists
  if (document.querySelector('.breadcrumb')) return; // avoid duplicates if page already has breadcrumbs

  // Map filename to section
  const sectionMap = {
    // Article detail pages
    'build-pc.html': { name: 'Articles', link: 'articles.html' },
    'cpu-2025.html': { name: 'Articles', link: 'articles.html' },
    'how-to-install-ssd.html': { name: 'Articles', link: 'articles.html' },
    // Project detail pages
    'windows-server-setup.html': { name: 'Projects', link: 'projects.html' },
    'intune-setup.html': { name: 'Projects', link: 'projects.html' },
    'network-monitoring.html': { name: 'Projects', link: 'projects.html' },
    // Top-level sections/pages
    'articles.html': { name: 'Articles', link: 'articles.html', sectionOnly: true },
    'projects.html': { name: 'Projects', link: 'projects.html', sectionOnly: true },
    'community.html': { name: 'Community', link: 'community.html', sectionOnly: true },
    'feedback.html': { name: 'Feedback', link: 'feedback.html', sectionOnly: true },
    'admin-feedback.html': { name: 'Admin', link: 'admin-feedback.html', sectionOnly: true },
    'cheat-sheet.html': { name: 'Cheat Sheet', link: 'cheat-sheet.html', sectionOnly: true },
    'about.html': { name: 'About', link: 'about.html', sectionOnly: true },
    'analytics.html': { name: 'Analytics', link: 'analytics.html', sectionOnly: true },
    'explore.html': { name: 'Explore', link: 'explore.html', sectionOnly: true },
    '404.html': { name: '404', link: '404.html', sectionOnly: true },
  };

  const section = sectionMap[file] || null;
  const h1 = document.querySelector('.article-header h1');
  const title = (h1 ? h1.textContent : document.title || '').trim();

  // Build breadcrumb HTML
  const nav = document.createElement('nav');
  nav.className = 'breadcrumb';
  nav.setAttribute('aria-label', 'Breadcrumb');

  const ul = document.createElement('ul');
  ul.className = 'breadcrumb-list';

  // Home
  const liHome = document.createElement('li');
  liHome.className = 'breadcrumb-item';
  liHome.innerHTML = '<a href="index.html"><i class="fas fa-home"></i> Home</a>';
  ul.appendChild(liHome);

  const sep1 = document.createElement('li');
  sep1.className = 'breadcrumb-separator';
  sep1.textContent = '/';
  ul.appendChild(sep1);

  if (section && !section.sectionOnly) {
    const liSection = document.createElement('li');
    liSection.className = 'breadcrumb-item';
    liSection.innerHTML = `<a href="${section.link}">${section.name}</a>`;
    ul.appendChild(liSection);

    const sep2 = document.createElement('li');
    sep2.className = 'breadcrumb-separator';
    sep2.textContent = '/';
    ul.appendChild(sep2);

    const liActive = document.createElement('li');
    liActive.className = 'breadcrumb-item active';
    liActive.textContent = title || file.replace(/\.html$/, '');
    ul.appendChild(liActive);
  } else {
    // Section-only page (e.g., Articles listing or About)
    const liActive = document.createElement('li');
    liActive.className = 'breadcrumb-item active';
    liActive.textContent = section ? section.name : (title || file.replace(/\.html$/, ''));
    ul.appendChild(liActive);
  }

  nav.appendChild(ul);

  const header = document.querySelector('.article-header');
  header.parentNode.insertBefore(nav, header); // insert before header
})();
