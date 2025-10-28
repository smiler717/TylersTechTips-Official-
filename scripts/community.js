// Community page logic: prefers server API (Cloudflare Pages Functions + D1),
// falls back to localStorage if API unavailable.
(function () {
  const LS_KEY = 'ttt_community_topics_v1';
  const DEVICE_KEY = 'ttt_device_id_v1';
  const RL_KEY = 'ttt_rate_limit_v1';
  const ADMIN_KEY_KEY = 'ttt_admin_key_v1';
  const MIN_POST_INTERVAL_MS = 20000; // 20s between posts/comments
  let SERVER_MODE = false;
  const VIEWED_KEY = 'ttt_viewed_topics_session_v1';
  let viewed = new Set();
  const LOGIN_PAGE = 'profile.html';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data;
    } catch (_) {
      return [];
    }
  }

  function saveLocal(items) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(items));
    } catch (_) {
      // ignore
    }
  }

  function getDeviceId() {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  }

  function getAdminKey() {
    return localStorage.getItem(ADMIN_KEY_KEY) || '';
  }

  function ensureAdminKey() {
    let key = getAdminKey();
    if (key) return key;
    key = prompt('Enter admin key to manage posts:') || '';
    if (key) localStorage.setItem(ADMIN_KEY_KEY, key);
    return key;
  }

  function isAdmin() {
    return !!getAdminKey();
  }

  function checkRateLimit(kind) {
    // kind: 'post' | 'comment'
    let obj = {};
    try { obj = JSON.parse(localStorage.getItem(RL_KEY) || '{}'); } catch (_) {}
    const key = kind === 'comment' ? 'lastComment' : 'lastPost';
    const now = Date.now();
    const last = obj[key] || 0;
    if (now - last < MIN_POST_INTERVAL_MS) {
      return { ok: false, waitMs: MIN_POST_INTERVAL_MS - (now - last) };
    }
    obj[key] = now;
    localStorage.setItem(RL_KEY, JSON.stringify(obj));
    return { ok: true };
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  function loadViewed() {
    try { viewed = new Set(JSON.parse(sessionStorage.getItem(VIEWED_KEY) || '[]')); } catch(_) { viewed = new Set(); }
  }

  function saveViewed() {
    try { sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...viewed])); } catch(_) {}
  }

  async function recordView(id) {
    if (!id || viewed.has(id)) return;
    viewed.add(id);
    saveViewed();
    if (!SERVER_MODE) return; // only record views on server
    try {
      await fetch(`/api/topics/${encodeURIComponent(id)}/view`, {
        method: 'POST',
        headers: { 'x-device-id': getDeviceId() }
      });
    } catch (_) {}
  }

  function render(topics, { query = '', sort = 'new' } = {}) {
    const list = $('#topic-list');
    if (!list) return;
    // filter
    const q = (query || '').trim().toLowerCase();
    let items = topics.slice();
    if (q) {
      items = items.filter((t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.body || '').toLowerCase().includes(q) ||
        (t.author || '').toLowerCase().includes(q)
      );
    }
    // sort
    if (sort === 'old') items.sort((a, b) => a.createdAt - b.createdAt);
    else if (sort === 'comments') items.sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0));
    else items.sort((a, b) => b.createdAt - a.createdAt);

    if (!items.length) {
      list.innerHTML = '<div class="no-results">No topics yet. Be the first to post!</div>';
      return;
    }
    list.innerHTML = items
      .map(
        (t) => {
          const score = (t.upvotes || 0) - (t.downvotes || 0);
          const scoreClass = score > 0 ? 'positive' : score < 0 ? 'negative' : '';
          return `
      <article class="topic-card" id="t-${t.id}" data-id="${t.id}">
        <header class="topic-header">
          <h3 class="topic-title" data-id="${t.id}">${escapeHTML(t.title)}</h3>
          ${t.category ? `<span class="pill tiny" style="margin-left: 8px;"><i class="fas fa-tag"></i> ${escapeHTML(t.category)}</span>` : ''}
          <div class="topic-meta">
            <div class="vote-controls">
              <button class="vote-btn upvote ${t.userVote === 'up' ? 'active' : ''}" data-id="${t.id}" data-vote="up" title="Upvote">
                <i class="fas fa-arrow-up"></i>
              </button>
              <span class="vote-count vote-score ${scoreClass}">${score > 0 ? '+' : ''}${score}</span>
              <button class="vote-btn downvote ${t.userVote === 'down' ? 'active' : ''}" data-id="${t.id}" data-vote="down" title="Downvote">
                <i class="fas fa-arrow-down"></i>
              </button>
            </div>
            <span class="meta-item"><i class="fas fa-user"></i> ${escapeHTML(t.author || 'Anonymous')}</span>
            <span class="meta-item"><i class="fas fa-clock"></i> ${formatDate(t.createdAt)}</span>
            <span class="meta-item"><i class="fas fa-eye"></i> ${t.views || 0}</span>
            <span class="meta-item"><i class="fas fa-comment"></i> ${(t.comments || []).length}</span>
            <button class="pill tiny copy-link" data-id="${t.id}" title="Copy link"><i class="fas fa-link"></i></button>
            ${t.canDelete ? `<button class="pill tiny delete-topic" data-id="${t.id}" title="Delete topic"><i class="fas fa-trash"></i></button>` : ''}
          </div>
        </header>
        <div class="topic-body">${escapeHTML(t.body)}</div>
        <div class="comment-section">
          <details data-id="${t.id}" ${t.comments?.length ? 'open' : ''}>
            <summary><i class="fas fa-comments"></i> Comments (${(t.comments || []).length})</summary>
            <div class="comments">
              ${(t.comments || [])
                .map(
                  (c) => `
                <div class="comment">
                  <div class="comment-meta">
                    <span><i class="fas fa-user"></i> ${escapeHTML(c.author || 'Anonymous')}</span>
                    <span><i class="fas fa-clock"></i> ${formatDate(c.createdAt)}</span>
                    ${c.canDelete ? `<button class="pill tiny delete-comment" data-topic="${t.id}" data-id="${c.id}" title="Delete comment"><i class="fas fa-trash"></i></button>` : ''}
                  </div>
                  <div class="comment-body">${escapeHTML(c.body)}</div>
                </div>
              `
                )
                .join('')}
            </div>
            <form class="comment-form" data-id="${t.id}">
              <div class="form-row">
                <input type="text" name="author" placeholder="Your name" maxlength="60"/>
                <input type="text" name="body" placeholder="Write a comment" required maxlength="500"/>
                <button class="pill" type="submit"><i class="fas fa-reply"></i> Comment</button>
              </div>
            </form>
          </details>
        </div>
      </article>
    `;
        }
      )
      .join('');
  }

  async function onNewTopic(e) {
    e.preventDefault();
    // Require login to post a topic
    if (!(window.TT_Auth && typeof window.TT_Auth.isLoggedIn === 'function' && window.TT_Auth.isLoggedIn())) {
      // Redirect to signup/login, preserving intent via query params
      const next = `${location.pathname}${location.search}${location.hash}`;
      location.href = `${LOGIN_PAGE}?next=${encodeURIComponent(next)}&action=post-topic`;
      return;
    }
    const f = e.target;
    const submitBtn = f.querySelector('button[type="submit"]');
    const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting…'; }

    const author = f.author.value.trim() || 'Anonymous';
    const title = f.title.value.trim();
    const body = f.body.value.trim();
    const category = f.category?.value || 'General';
    if (!title || !body) return;
    if (SERVER_MODE) {
      try {
        const res = await fetch('/api/topics', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-device-id': getDeviceId() },
          body: JSON.stringify({ author, title, body, category })
        });
        if (res.status === 429) {
          const j = await res.json();
          alert(`Please wait ${Math.ceil((j.waitMs||20000)/1000)}s before posting again.`);
          return;
        }
        if (!res.ok) {
          let msg = 'Failed to create topic on server';
          try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
          alert(msg);
          return; // don't fall back silently; surface the error
        }
        const j = await res.json();
        const { category: filterCategory } = currentView();
        const topics = await loadRemote(filterCategory);
        f.reset();
        render(topics, currentView());
        location.hash = `#t-${j.topic.id}`;
        return;
      } catch (_) {
        // network problem: fall back locally
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origBtnHtml; }
      }
    }
    const rl = checkRateLimit('post');
    if (!rl.ok) { alert(`Please wait ${Math.ceil(rl.waitMs/1000)}s before posting again.`); return; }
    const topics = loadLocal();
    const topic = { id: uid(), author, title, body, category, createdAt: Date.now(), comments: [], createdBy: getDeviceId(), canDelete: true };
    topics.push(topic);
    saveLocal(topics);
    f.reset();
    render(topics, currentView());
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = origBtnHtml; }
    location.hash = `#t-${topic.id}`;
  }

  async function onNewComment(e) {
    e.preventDefault();
    // Require login to post a comment
    if (!(window.TT_Auth && typeof window.TT_Auth.isLoggedIn === 'function' && window.TT_Auth.isLoggedIn())) {
      const next = `${location.pathname}${location.search}${location.hash}`;
      location.href = `${LOGIN_PAGE}?next=${encodeURIComponent(next)}&action=comment`;
      return;
    }
    const form = e.target;
    const id = form.getAttribute('data-id');
    const btn = form.querySelector('button[type="submit"]');
    const old = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting…'; }
    const author = e.target.author.value.trim() || 'Anonymous';
    const body = e.target.body.value.trim();
    if (!body) return;
    if (SERVER_MODE) {
      try {
        const res = await fetch(`/api/topics/${encodeURIComponent(id)}/comments`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-device-id': getDeviceId() },
          body: JSON.stringify({ author, body })
        });
        if (res.status === 429) {
          const j = await res.json();
          alert(`Please wait ${Math.ceil((j.waitMs||20000)/1000)}s before commenting again.`);
          return;
        }
        if (!res.ok) {
          let msg = 'Failed to add comment on server';
          try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
          alert(msg);
          return; // don't fall back silently; surface the error
        }
        const { category } = currentView();
        const topics = await loadRemote(category);
        form.reset();
        render(topics, currentView());
        return;
      } catch (_) {
        // network-only failure: fall back locally
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = old; }
      }
    }
    const rl = checkRateLimit('comment');
    if (!rl.ok) { alert(`Please wait ${Math.ceil(rl.waitMs/1000)}s before commenting again.`); return; }
    const topics = loadLocal();
    const t = topics.find((x) => x.id === id);
    if (!t) return;
    t.comments = t.comments || [];
    t.comments.push({ id: uid(), author, body, createdAt: Date.now(), createdBy: getDeviceId(), canDelete: true });
    saveLocal(topics);
    form.reset();
    render(topics, currentView());
    if (btn) { btn.disabled = false; btn.innerHTML = old; }
  }

  async function onDeleteTopic(id) {
    if (!confirm('Delete this topic?')) return;
    if (SERVER_MODE) {
      try {
        const adminKey = getAdminKey() || ensureAdminKey();
        const res = await fetch(`/api/topics/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'x-device-id': getDeviceId(), ...(adminKey ? { 'x-admin-key': adminKey } : {}) }
        });
        if (res.status === 403) { alert('Admin access required to delete topics.'); return; }
        if (res.status === 404) { /* ignore */ }
        if (!res.ok && res.status !== 204) throw new Error('Failed');
        const { category } = currentView();
        const topics = await loadRemote(category);
        render(topics, currentView());
        return;
      } catch (_) {
        // fallback to local
      }
    }
    const topics = loadLocal();
    // Admin-only delete in local mode as well
    const adminKey = getAdminKey() || ensureAdminKey();
    if (!adminKey) { alert('Admin access required to delete topics.'); return; }
    const t = topics.find((x) => x.id === id);
    if (!t) return;
    const next = topics.filter((x) => x.id !== id);
    saveLocal(next);
    render(next, currentView());
  }

  async function onDeleteComment(topicId, commentId) {
    if (!confirm('Delete this comment?')) return;
    if (SERVER_MODE) {
      try {
        const adminKey = getAdminKey() || ensureAdminKey();
        const res = await fetch(`/api/topics/${encodeURIComponent(topicId)}/comments/${encodeURIComponent(commentId)}`, {
          method: 'DELETE',
          headers: { 'x-device-id': getDeviceId(), ...(adminKey ? { 'x-admin-key': adminKey } : {}) }
        });
        if (res.status === 403) { alert('Admin access required to delete comments.'); return; }
        if (!res.ok && res.status !== 204) throw new Error('Failed');
        const { category } = currentView();
        const topics = await loadRemote(category);
        render(topics, currentView());
        return;
      } catch (_) {
        // fallback
      }
    }
    const topics = loadLocal();
    // Admin-only delete in local mode as well
    const adminKey = getAdminKey() || ensureAdminKey();
    if (!adminKey) { alert('Admin access required to delete comments.'); return; }
    const t = topics.find((x) => x.id === topicId);
    if (!t) return;
    const c = (t.comments || []).find((y) => y.id === commentId);
    if (!c) return;
    t.comments = (t.comments || []).filter((y) => y.id !== commentId);
    saveLocal(topics);
    render(topics, currentView());
  }

  function showToast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    el.classList.add('show');
    setTimeout(() => { el.classList.remove('show'); el.hidden = true; }, 1400);
  }

  async function handleVote(topicId, voteType) {
    if (!SERVER_MODE) return; // Voting only works in server mode
    try {
      const res = await fetch(`/api/topics/${encodeURIComponent(topicId)}/vote`, {
        method: 'POST',
        headers: { 
          'content-type': 'application/json',
          'x-device-id': getDeviceId() 
        },
        body: JSON.stringify({ vote: voteType })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j?.error || 'Failed to vote');
        return;
      }
      // Optimistically update the UI using response payload
      const payload = await res.json().catch(() => null);
      const card = document.getElementById(`t-${topicId}`);
      if (payload && card) {
        const { upvotes = 0, downvotes = 0, userVote = null } = payload;
        const score = (parseInt(upvotes, 10) || 0) - (parseInt(downvotes, 10) || 0);
        const scoreEl = card.querySelector('.vote-count');
        if (scoreEl) {
          scoreEl.textContent = `${score > 0 ? '+' : ''}${score}`;
          scoreEl.classList.toggle('positive', score > 0);
          scoreEl.classList.toggle('negative', score < 0);
        }
        const upBtn = card.querySelector('.vote-btn.upvote');
        const downBtn = card.querySelector('.vote-btn.downvote');
        if (upBtn && downBtn) {
          upBtn.classList.toggle('active', userVote === 'up');
          downBtn.classList.toggle('active', userVote === 'down');
          upBtn.setAttribute('aria-pressed', userVote === 'up' ? 'true' : 'false');
          downBtn.setAttribute('aria-pressed', userVote === 'down' ? 'true' : 'false');
        }
      } else {
        // Fallback: reload topics if we couldn't update inline
        const { category } = currentView();
        const topics = await loadRemote(category);
        render(topics, currentView());
      }
    } catch (err) {
      console.error('Vote error:', err);
      alert('Network error voting');
    }
  }

  function copyLink(id) {
    const url = `${location.origin}${location.pathname}#t-${id}`;
    navigator.clipboard?.writeText(url).then(() => showToast('Copied link')); 
  }

  function scrollToHash() {
    const m = location.hash.match(/^#t-(.+)$/);
    if (!m) return;
    const el = document.getElementById(`t-${m[1]}`);
    if (el) {
      el.classList.add('topic-highlight');
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => el.classList.remove('topic-highlight'), 2000);
    }
  }

  function currentView() {
    const query = $('#topic-search')?.value || '';
    const category = $('#topic-category')?.value || '';
    const sort = $('#topic-sort')?.value || 'new';
    return { query, category, sort };
  }

  async function exportJSON() {
    if (SERVER_MODE) {
      try {
        const { topics } = await loadRemoteRaw();
        const blob = new Blob([JSON.stringify(topics, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'community-topics.json';
        a.click();
        URL.revokeObjectURL(url);
        return;
      } catch (_) {}
    }
    const data = loadLocal();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'community-topics.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(files) {
    if (SERVER_MODE) {
      alert('Import is not supported in server mode yet.');
      return;
    }
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arr = JSON.parse(reader.result);
        if (Array.isArray(arr)) {
          saveLocal(arr);
          render(arr);
        }
      } catch (_) {}
    };
    reader.readAsText(file);
  }

  async function loadRemoteRaw(category = '') {
    const adminKey = getAdminKey();
    const headers = { 'x-device-id': getDeviceId() };
    if (adminKey) headers['x-admin-key'] = adminKey;
    const url = category ? `/api/topics?category=${encodeURIComponent(category)}` : '/api/topics';
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  }

  async function loadRemote(category = '') {
    const j = await loadRemoteRaw(category);
    return j.topics || [];
  }

  document.addEventListener('DOMContentLoaded', async () => {
    loadViewed();
    // If not logged in, add a subtle notice above the form and adjust submit button label for clarity
    const isLoggedIn = !!(window.TT_Auth && typeof window.TT_Auth.isLoggedIn === 'function' && window.TT_Auth.isLoggedIn());
    if (!isLoggedIn) {
      const formWrap = document.querySelector('.topic-form');
      if (formWrap && !formWrap.querySelector('.login-required-note')) {
        const note = document.createElement('div');
        note.className = 'login-required-note';
        note.style.margin = '0 0 0.75rem 0';
        note.style.color = 'var(--secondary-text)';
        note.innerHTML = '<i class="fas fa-lock"></i> Login required to post topics or comments';
        const h2 = formWrap.querySelector('h2');
        if (h2) h2.insertAdjacentElement('afterend', note);
      }
      const submitBtn = document.querySelector('#new-topic-form button[type="submit"]');
      if (submitBtn) submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login to Post';
    }
    // Try server first
    try {
      const topics = await loadRemote();
      SERVER_MODE = true;
      render(topics, currentView());
    } catch (_) {
      const topics = loadLocal();
      SERVER_MODE = false;
      // In local mode, only admin sees delete buttons
      const admin = isAdmin();
      topics.forEach(t => { t.canDelete = admin; (t.comments||[]).forEach(c => c.canDelete = admin); });
      render(topics, currentView());
    }
    const form = $('#new-topic-form');
    form && form.addEventListener('submit', onNewTopic);

    document.body.addEventListener('submit', (e) => {
      if (e.target?.classList?.contains('comment-form')) onNewComment(e);
    });

  // Export/Import UI removed in server mode cleanup

    // Search and sort events
    $('#topic-search')?.addEventListener('input', async () => {
      const { category } = currentView();
      const topics = SERVER_MODE ? await loadRemote(category) : loadLocal();
      render(topics, currentView());
    });
    $('#topic-sort')?.addEventListener('change', async () => {
      const { category } = currentView();
      const topics = SERVER_MODE ? await loadRemote(category) : loadLocal();
      render(topics, currentView());
    });
    $('#topic-category')?.addEventListener('change', async () => {
      const { category } = currentView();
      const topics = SERVER_MODE ? await loadRemote(category) : loadLocal();
      render(topics, currentView());
    });

    // Delegate copy-link, delete, and vote buttons
    document.body.addEventListener('click', async (e) => {
      const copyBtn = e.target.closest?.('.copy-link');
      if (copyBtn) { copyLink(copyBtn.getAttribute('data-id')); return; }
      const title = e.target.closest?.('.topic-title');
      if (title) { recordView(title.getAttribute('data-id')); return; }
      const delTopic = e.target.closest?.('.delete-topic');
      if (delTopic) { onDeleteTopic(delTopic.getAttribute('data-id')); return; }
      const delComment = e.target.closest?.('.delete-comment');
      if (delComment) { onDeleteComment(delComment.getAttribute('data-topic'), delComment.getAttribute('data-id')); return; }
      const voteBtn = e.target.closest?.('.vote-btn');
      if (voteBtn) { await handleVote(voteBtn.getAttribute('data-id'), voteBtn.getAttribute('data-vote')); return; }
    });

    // Record a view when comments are expanded
    document.body.addEventListener('toggle', (e) => {
      if (e.target?.matches?.('details[data-id]') && e.target.open) {
        recordView(e.target.getAttribute('data-id'));
      }
    }, true);

    // Handle deep link to a topic by hash
    scrollToHash();
    const m = location.hash.match(/^#t-(.+)$/);
    if (m && m[1]) recordView(m[1]);
    window.addEventListener('hashchange', scrollToHash);
  });
})();
