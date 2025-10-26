// Shared utilities for Cloudflare Pages Functions (Workers runtime)

/**
 * JSON response helper
 */
export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

/**
 * Error helper
 */
export function error(status, message, extra = {}) {
  return json({ error: message, ...extra }, { status });
}

/**
 * Read request body as JSON safely
 */
export async function readJson(request) {
  try {
    return await request.json();
  } catch (_) {
    return null;
  }
}

/**
 * Get device id from header
 */
export function getDeviceId(request) {
  const h = request.headers.get('x-device-id');
  return h && typeof h === 'string' ? h.trim() : '';
}

/**
 * Ensure D1 schema exists (idempotent)
 */
export async function ensureSchema(DB) {
  await DB.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      author TEXT,
      created_at INTEGER NOT NULL,
      created_by TEXT
    );
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL,
      author TEXT,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      created_by TEXT,
      FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_comments_topic ON comments(topic_id);
    CREATE INDEX IF NOT EXISTS idx_topics_created ON topics(created_at);
    CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);
  `);
}

/**
 * Simple rate limit using KV per device (optional)
 * Allows one action every minIntervalMs per key.
 */
export async function checkRateLimit(env, key, minIntervalMs = 20000) {
  const kv = env && env.RATE_LIMIT;
  if (!kv) return { ok: true };
  const last = await kv.get(key);
  const now = Date.now();
  if (last) {
    const ts = parseInt(last, 10) || 0;
    if (now - ts < minIntervalMs) {
      return { ok: false, waitMs: minIntervalMs - (now - ts) };
    }
  }
  // Cloudflare KV requires TTL >= 60 seconds; keep the value for at least a minute
  const ttlSeconds = Math.max(60, Math.ceil(minIntervalMs / 1000) * 2);
  await kv.put(key, String(now), { expirationTtl: ttlSeconds });
  return { ok: true };
}
