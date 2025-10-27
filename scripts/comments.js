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
      const flat = Array.isArray(data.comments) ? data.comments : [];
      if (flat.length === 0) {
        listEl.innerHTML = '<div style="color:var(--secondary-text);">No comments yet. Be the first to comment!</div>';
        return;
      }
      // Build tree
      const nodes = new Map();
      flat.forEach(c => nodes.set(c.id, { ...c, children: [] }));
      const roots = [];
      nodes.forEach(n => {
        if (n.parentId && nodes.has(n.parentId)) nodes.get(n.parentId).children.push(n); else roots.push(n);
      });

      function renderNode(n, depth=0){
        const date = n.createdAt ? new Date(n.createdAt) : null;
        const when = date ? `${date.toLocaleDateString()} ${date.toLocaleTimeString()}` : '';
        const isReply = depth > 0;
        const margin = Math.min(depth, 4) * 40; // 40px indent for better visual distinction
        const bg = isReply ? 'var(--card-bg)' : 'var(--secondary-bg)';
        const borderLeft = isReply ? '4px solid var(--accent-color)' : 'none';
        const boxShadow = isReply ? '0 2px 4px rgba(0,0,0,.1)' : 'none';
        const replyBadge = isReply ? `<div style="display:inline-block;background:var(--accent-color);color:white;font-size:.7rem;font-weight:700;padding:.25rem .6rem;border-radius:3px;margin-bottom:.5rem;letter-spacing:.5px;"><i class="fas fa-reply" style="margin-right:.3rem;"></i>REPLY</div>` : '';
        const childHtml = (n.children || []).map(ch => renderNode(ch, depth+1)).join('');
        return `
          ${replyBadge}
          <div class="comment-item" data-id="${n.id}" style="background:${bg};border:1px solid var(--card-bg);border-left:${borderLeft};border-radius:8px;padding:1rem;margin:.75rem 0 .75rem ${margin}px;${boxShadow ? `box-shadow:${boxShadow};` : ``}">
            <div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap;">
              <strong>${escapeHTML(n.author || 'Anonymous')}</strong>
              <span style="color:var(--secondary-text);font-size:.9rem;">${escapeHTML(when)}</span>
            </div>
            <div style="white-space:pre-wrap;margin-top:.5rem;">${escapeHTML(n.body || '')}</div>
            <div class="comment-actions" style="margin-top:.5rem;">
              <button class="reply-btn" data-target="${n.id}" style="background:transparent;border:none;color:var(--accent-color);cursor:pointer;padding:0;font-weight:600;">Reply</button>
            </div>
            <div class="reply-form-slot"></div>
          </div>
          ${childHtml}`;
      }

      listEl.innerHTML = roots.map(r => renderNode(r, 0)).join('');
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

  // Event delegation for Reply buttons
  listEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest && ev.target.closest('.reply-btn');
    if (!btn) return;
    const id = btn.getAttribute('data-target');
    const item = btn.closest('.comment-item');
    if (!item) return;
    const slot = item.querySelector('.reply-form-slot');
    // Toggle existing
    if (slot.dataset.open === '1') {
      slot.innerHTML = '';
      slot.dataset.open = '0';
      return;
    }
    // Close any other open forms
    listEl.querySelectorAll('.reply-form-slot[data-open="1"]').forEach(s => { s.innerHTML=''; s.dataset.open='0'; });
    slot.dataset.open = '1';
    slot.innerHTML = `
      <div class="reply-form" style="margin-top:.5rem;padding:.5rem;border-left:3px solid var(--accent-color);">
        <div class="form-group" style="margin-bottom:.5rem;">
          <label style="display:block;font-size:.9rem;">Name</label>
          <input type="text" class="reply-author" placeholder="Your name (optional)" maxlength="60" style="width:100%;">
        </div>
        <div class="form-group" style="margin-bottom:.5rem;">
          <label style="display:block;font-size:.9rem;">Reply</label>
          <textarea class="reply-body" rows="3" placeholder="Write your reply..." maxlength="2000" style="width:100%;"></textarea>
        </div>
        <div style="display:flex;gap:.5rem;">
          <button class="pill reply-submit" data-parent="${id}"><i class="fas fa-reply"></i> Post Reply</button>
          <button class="pill reply-cancel" style="background:var(--secondary-bg);color:var(--text-color);border:1px solid var(--card-bg);">Cancel</button>
        </div>
      </div>`;
  });

  // Handle reply submit/cancel
  listEl.addEventListener('click', async (ev) => {
    const cancel = ev.target.closest && ev.target.closest('.reply-cancel');
    if (cancel) {
      const slot = cancel.closest('.reply-form-slot');
      if (slot) { slot.innerHTML=''; slot.dataset.open='0'; }
      return;
    }
    const submit = ev.target.closest && ev.target.closest('.reply-submit');
    if (submit) {
      const parentId = submit.getAttribute('data-parent');
      const wrap = submit.closest('.reply-form');
      if (!wrap) return;
      const a = wrap.querySelector('.reply-author');
      const b = wrap.querySelector('.reply-body');
      const author = (a && a.value || '').trim();
      const body = (b && b.value || '').trim();
      if (!body) return; // simple guard
      submit.disabled = true;
      submit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting…';
      try {
        const res = await fetch(`/api/page-comments/${encodeURIComponent(slug)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-device-id': getDeviceId() },
          body: JSON.stringify({ author, body, parentId })
        });
        if (!res.ok) {
          // ignore inline error UI for brevity; full form message is above
        } else {
          await loadComments();
        }
      } catch {}
      finally {
        submit.disabled = false;
      }
    }
  });

  submitBtn.addEventListener('click', postComment);
  loadComments();
})();
