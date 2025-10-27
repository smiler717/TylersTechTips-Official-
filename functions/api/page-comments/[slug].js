import { json, error, readJson, getDeviceId, checkRateLimit } from '../_utils.js';
import { sanitizeText, validateDeviceId } from '../_sanitize.js';

/**
 * Per-page comments stored in D1 by slug
 * GET  /api/page-comments/[slug]
 * POST /api/page-comments/[slug]
 */
export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method.toUpperCase();
  const slug = (params && params.slug) ? String(params.slug) : '';
  const DB = env && env.DB;

  if (!slug) return error(400, 'Missing page slug');
  if (!DB) return error(500, 'Database binding DB is not configured');

  // Ensure table exists (idempotent)
  await ensurePageCommentsSchema(DB);

  if (method === 'OPTIONS') {
    return json({}, { status: 204 });
  }

  if (method === 'GET') {
    try {
      const res = await DB
        .prepare('SELECT id, author, body, created_at FROM page_comments WHERE slug = ? ORDER BY created_at ASC')
        .bind(slug)
        .all();
      const rows = res.results || [];
      const comments = rows.map(r => ({
        id: r.id,
        author: r.author || 'Anonymous',
        body: r.body || '',
        createdAt: r.created_at || 0,
      }));
      return json({ comments });
    } catch (e) {
      return error(500, 'Failed to load comments');
    }
  }

  if (method === 'POST') {
    const deviceId = getDeviceId(request);
    if (!deviceId) return error(400, 'Missing X-Device-Id');

    try {
      validateDeviceId(deviceId);
    } catch {
      return error(400, 'Invalid device identifier');
    }

    const rl = await checkRateLimit(env, `page-comment:${slug}:${deviceId}`, 20000);
    if (!rl.ok) return error(429, 'Rate limited', { waitMs: rl.waitMs });

    const body = await readJson(request);
    if (!body) return error(400, 'Invalid JSON');

    const author = sanitizeText(body.author || 'Anonymous', 60) || 'Anonymous';
    const content = sanitizeText(body.body || '', 2000);
    if (!content) return error(400, 'Comment body is required');

    const id = crypto.randomUUID();
    const createdAt = Date.now();

    try {
      await DB
        .prepare('INSERT INTO page_comments (id, slug, author, body, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, slug, author, content, createdAt, deviceId)
        .run();
      return json({ comment: { id, author, body: content, createdAt } }, { status: 201 });
    } catch (e) {
      return error(500, 'Failed to save comment');
    }
  }

  return error(405, 'Method Not Allowed');
}

async function ensurePageCommentsSchema(DB) {
  await DB.exec(`
    CREATE TABLE IF NOT EXISTS page_comments (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      author TEXT,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      created_by TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_page_comments_slug ON page_comments(slug);
    CREATE INDEX IF NOT EXISTS idx_page_comments_created ON page_comments(created_at);
  `);
}
