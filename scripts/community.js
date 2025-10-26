// Community page logic: prefers server API (Cloudflare Pages Functions + D1),
// falls back to localStorage if API unavailable.
(function () {
  const LS_KEY = 'ttt_community_topics_v1';
  const DEVICE_KEY = 'ttt_device_id_v1';
  const RL_KEY = 'ttt_rate_limit_v1';
  const MIN_POST_INTERVAL_MS = 20000; // 20s between posts/comments
  let SERVER_MODE = false;

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
        (t) => `
      <article class="topic-card" id="t-${t.id}" data-id="${t.id}">
        <header class="topic-header">
          <h3 class="topic-title">${escapeHTML(t.title)}</h3>
          <div class="topic-meta">
            <span class="meta-item"><i class="fas fa-user"></i> ${escapeHTML(t.author || 'Anonymous')}</span>
            <span class="meta-item"><i class="fas fa-clock"></i> ${formatDate(t.createdAt)}</span>
            <span class="meta-item"><i class="fas fa-comment"></i> ${(t.comments || []).length}</span>
            <button class="pill tiny copy-link" data-id="${t.id}" title="Copy link"><i class="fas fa-link"></i></button>
            ${t.canDelete ? `<button class="pill tiny delete-topic" data-id="${t.id}" title="Delete topic"><i class="fas fa-trash"></i></button>` : ''}
          </div>
        </header>
        <div class="topic-body">${escapeHTML(t.body)}</div>
        <div class="comment-section">
          <details ${t.comments?.length ? 'open' : ''}>
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
    `
      )
      .join('');
  }

  async function onNewTopic(e) {
    e.preventDefault();
    const f = e.target;
    const author = f.author.value.trim() || 'Anonymous';
    const title = f.title.value.trim();
    const body = f.body.value.trim();
    if (!title || !body) return;
    if (SERVER_MODE) {
      try {
        const res = await fetch('/api/topics', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-device-id': getDeviceId() },
          body: JSON.stringify({ author, title, body })
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
        const topics = await loadRemote();
        f.reset();
        render(topics, currentView());
        location.hash = `#t-${j.topic.id}`;
        return;
      } catch (_) {
        // network problem: fall back locally
      }
    }
    const rl = checkRateLimit('post');
    if (!rl.ok) { alert(`Please wait ${Math.ceil(rl.waitMs/1000)}s before posting again.`); return; }
    const topics = loadLocal();
    const topic = { id: uid(), author, title, body, createdAt: Date.now(), comments: [], createdBy: getDeviceId(), canDelete: true };
    topics.push(topic);
    saveLocal(topics);
    f.reset();
    render(topics, currentView());
    location.hash = `#t-${topic.id}`;
  }

  async function onNewComment(e) {
    e.preventDefault();
    const id = e.target.getAttribute('data-id');
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
        const topics = await loadRemote();
        e.target.reset();
        render(topics, currentView());
        return;
      } catch (_) {
        // network-only failure: fall back locally
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
    e.target.reset();
    render(topics, currentView());
  }

  async function onDeleteTopic(id) {
    if (!confirm('Delete this topic?')) return;
    if (SERVER_MODE) {
      try {
        const res = await fetch(`/api/topics/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: { 'x-device-id': getDeviceId() }
        });
        if (res.status === 403) { alert('You can only delete your own topic from the same device.'); return; }
        if (res.status === 404) { /* ignore */ }
        if (!res.ok && res.status !== 204) throw new Error('Failed');
        const topics = await loadRemote();
        render(topics, currentView());
        return;
      } catch (_) {
        // fallback to local
      }
    }
    const topics = loadLocal();
    const t = topics.find((x) => x.id === id);
    if (!t || t.createdBy !== getDeviceId()) return;
    const next = topics.filter((x) => x.id !== id);
    saveLocal(next);
    render(next, currentView());
  }

  async function onDeleteComment(topicId, commentId) {
    if (!confirm('Delete this comment?')) return;
    if (SERVER_MODE) {
      try {
        const res = await fetch(`/api/topics/${encodeURIComponent(topicId)}/comments/${encodeURIComponent(commentId)}`, {
          method: 'DELETE',
          headers: { 'x-device-id': getDeviceId() }
        });
        if (res.status === 403) { alert('You can only delete your own comment from the same device.'); return; }
        if (!res.ok && res.status !== 204) throw new Error('Failed');
        const topics = await loadRemote();
        render(topics, currentView());
        return;
      } catch (_) {
        // fallback
      }
    }
    const topics = loadLocal();
    const t = topics.find((x) => x.id === topicId);
    if (!t) return;
    const c = (t.comments || []).find((y) => y.id === commentId);
    if (!c || c.createdBy !== getDeviceId()) return;
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
    const sort = $('#topic-sort')?.value || 'new';
    return { query, sort };
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

  async function loadRemoteRaw() {
    const res = await fetch('/api/topics', { headers: { 'x-device-id': getDeviceId() } });
    if (!res.ok) throw new Error('Failed');
    return res.json();
  }

  async function loadRemote() {
    const j = await loadRemoteRaw();
    return j.topics || [];
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // Try server first
    try {
      const topics = await loadRemote();
      SERVER_MODE = true;
      render(topics, currentView());
    } catch (_) {
      const topics = loadLocal();
      SERVER_MODE = false;
      // For local items, set canDelete from createdBy
      topics.forEach(t => { t.canDelete = t.createdBy === getDeviceId(); (t.comments||[]).forEach(c => c.canDelete = c.createdBy === getDeviceId()); });
      render(topics, currentView());
    }
    const form = $('#new-topic-form');
    form && form.addEventListener('submit', onNewTopic);

    document.body.addEventListener('submit', (e) => {
      if (e.target?.classList?.contains('comment-form')) onNewComment(e);
    });

    const exportBtn = $('#export-json');
    const importBtn = $('#import-json');
    const importFile = $('#import-file');
    exportBtn && exportBtn.addEventListener('click', exportJSON);
    importBtn && importBtn.addEventListener('click', () => importFile && importFile.click());
    importFile && importFile.addEventListener('change', (e) => importJSON(e.target.files));

    // Search and sort events
    $('#topic-search')?.addEventListener('input', async () => {
      const topics = SERVER_MODE ? await loadRemote() : loadLocal();
      render(topics, currentView());
    });
    $('#topic-sort')?.addEventListener('change', async () => {
      const topics = SERVER_MODE ? await loadRemote() : loadLocal();
      render(topics, currentView());
    });

    // Delegate copy-link and delete buttons
    document.body.addEventListener('click', (e) => {
      const copyBtn = e.target.closest?.('.copy-link');
      if (copyBtn) { copyLink(copyBtn.getAttribute('data-id')); return; }
      const delTopic = e.target.closest?.('.delete-topic');
      if (delTopic) { onDeleteTopic(delTopic.getAttribute('data-id')); return; }
      const delComment = e.target.closest?.('.delete-comment');
      if (delComment) { onDeleteComment(delComment.getAttribute('data-topic'), delComment.getAttribute('data-id')); return; }
    });

    // Handle deep link to a topic by hash
    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
  });
})();
