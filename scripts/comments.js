(function(){
  // Determine slug from path
  const slug = (location.pathname.split('/').pop() || '').trim() || 'index.html';
  if (!slug || slug === 'index.html') return; // no comments on home

  const container = document.querySelector('.article-content');
  if (!container) return;

  // Utility: escape HTML
  function escapeHTML(str){
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  }

  // Utility: get or create device id
  function getDeviceId(){
    try {
      let id = localStorage.getItem('device-id');
      if (!id) {
        id = 'dev-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
        localStorage.setItem('device-id', id);
      }
      return id;
    } catch {
      return 'dev-anon';
    }
  }

  // Build comments section
  const section = document.createElement('section');
  section.className = 'comments-section';
  section.style.marginTop = '3rem';

  section.innerHTML = `
    <h2 style="margin-bottom: 1rem;"><i class="fas fa-comments"></i> Comments</h2>
    <div class="comment-form" style="margin-bottom:1rem;">
      <div class="form-group">
        <label for="comment-author">Name</label>
        <input type="text" id="comment-author" placeholder="Your name (optional)" maxlength="60">
      </div>
      <div class="form-group">
        <label for="comment-body">Comment</label>
        <textarea id="comment-body" rows="4" placeholder="Write your comment..." maxlength="2000" required></textarea>
      </div>
      <button id="comment-submit" class="pill"><i class="fas fa-paper-plane"></i> Post Comment</button>
      <div id="comment-msg" style="display:none;margin-top:.5rem;padding:.5rem;border-radius:4px;"></div>
    </div>
    <div id="comments-list" class="comments-list" aria-live="polite"></div>
  `;

  // Insert after related-articles if present, else at end of article-content
  const related = container.querySelector('.related-articles');
  if (related && related.parentNode) {
    related.parentNode.insertBefore(section, related.nextSibling);
  } else {
    container.appendChild(section);
  }

  const authorEl = section.querySelector('#comment-author');
  const bodyEl = section.querySelector('#comment-body');
  const submitBtn = section.querySelector('#comment-submit');
  const msgEl = section.querySelector('#comment-msg');
  const listEl = section.querySelector('#comments-list');

  function showMsg(text, type){
    msgEl.textContent = text;
    msgEl.style.display = 'block';
    msgEl.style.background = type === 'error' ? 'var(--error-bg, #f8d7da)' : 'var(--success-bg, #d4edda)';
    msgEl.style.color = type === 'error' ? 'var(--error-text, #721c24)' : 'var(--success-text, #155724)';
    msgEl.style.border = `1px solid ${type === 'error' ? 'var(--error-border, #f5c6cb)' : 'var(--success-border, #c3e6cb)'}`;
  }

  function clearMsg(){
    msgEl.style.display = 'none';
  }

  async function loadComments(){
    try {
      listEl.innerHTML = '<div style="color:var(--secondary-text);padding:.5rem;">Loading comments…</div>';
      const res = await fetch(`/api/page-comments/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const comments = Array.isArray(data.comments) ? data.comments : [];
      if (comments.length === 0) {
        listEl.innerHTML = '<div style="color:var(--secondary-text);">No comments yet. Be the first to comment!</div>';
        return;
      }
      listEl.innerHTML = comments.map(c => {
        const date = c.createdAt ? new Date(c.createdAt) : null;
        const when = date ? `${date.toLocaleDateString()} ${date.toLocaleTimeString()}` : '';
        return `
          <div class="comment-item" style="background:var(--secondary-bg);border:1px solid var(--card-bg);border-radius:8px;padding:1rem;margin:.75rem 0;">
            <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;">
              <strong>${escapeHTML(c.author || 'Anonymous')}</strong>
              <span style="color:var(--secondary-text);font-size:.9rem;">${escapeHTML(when)}</span>
            </div>
            <div style="white-space:pre-wrap;margin-top:.5rem;">${escapeHTML(c.body || '')}</div>
          </div>`;
      }).join('');
    } catch (e) {
      listEl.innerHTML = '<div style="color:#dc3545;">Failed to load comments.</div>';
    }
  }

  async function postComment(){
    clearMsg();
    const author = (authorEl.value || '').trim();
    const body = (bodyEl.value || '').trim();
    if (!body) {
      showMsg('Please enter a comment.', 'error');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting…';
    try {
      const res = await fetch(`/api/page-comments/${encodeURIComponent(slug)}` , {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-id': getDeviceId()
        },
        body: JSON.stringify({ author, body })
      });
      if (res.status === 429) {
        const data = await res.json();
        const waitSec = Math.ceil((data.waitMs || 10000) / 1000);
        showMsg(`You're commenting too fast. Please wait ${waitSec}s.`, 'error');
        return;
      }
      if (!res.ok) {
        // Try to surface server error message if available
        try {
          const data = await res.json();
          if (data && data.error) {
            showMsg(data.error, 'error');
          } else {
            showMsg('Network error. Please try again.', 'error');
          }
        } catch {
          showMsg('Network error. Please try again.', 'error');
        }
        return;
      }
      bodyEl.value = '';
      showMsg('Comment posted!', 'success');
      await loadComments();
      setTimeout(clearMsg, 3000);
    } catch (e) {
      showMsg('Network error. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Post Comment';
    }
  }

  submitBtn.addEventListener('click', postComment);
  loadComments();
})();
