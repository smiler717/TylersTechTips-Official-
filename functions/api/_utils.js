// Shared utilities for Cloudflare Pages Functions (Workers runtime)

/**
 * CORS headers configuration
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*', // Change to specific domain in production
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key',
  'Access-Control-Max-Age': '86400',
};

/**
 * Handle CORS preflight requests
 */
export function handleCORS(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS
    });
  }
  return null;
}

/**
 * Add CORS headers to response
 */
export function addCORSHeaders(response) {
  const newHeaders = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * JSON response helper
 */
export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  
  // Add CORS headers
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
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
 * Admin check via secret header and Pages env secret
 * Includes rate limiting to prevent brute force attacks
 */
export async function isAdmin(request, env) {
  const header = request.headers.get('x-admin-key');
  const key = header && header.trim();
  const secret = env && env.ADMIN_KEY;
  
  if (!secret) return false;
  
  // Rate limit admin login attempts
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const rateLimitKey = `admin-attempt:${ip}`;
  
  if (env.RATE_LIMIT) {
    const attempts = await env.RATE_LIMIT.get(rateLimitKey);
    if (attempts && parseInt(attempts) > 10) {
      // Too many failed attempts, block for 1 hour
      return false;
    }
  }
  
  const isValid = Boolean(key && key === secret);
  
  // Track failed attempts
  if (!isValid && env.RATE_LIMIT) {
    const current = parseInt(await env.RATE_LIMIT.get(rateLimitKey) || '0');
    await env.RATE_LIMIT.put(rateLimitKey, String(current + 1), { expirationTtl: 3600 }); // 1 hour
  } else if (isValid && env.RATE_LIMIT) {
    // Reset on success
    await env.RATE_LIMIT.delete(rateLimitKey);
  }
  
  return isValid;
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

/**
 * Views helpers using KV (same namespace as rate limit)
 */
export async function getViews(env, topicId) {
  const kv = env && env.RATE_LIMIT;
  if (!kv) return 0;
  const val = await kv.get(`views:topic:${topicId}`);
  const n = parseInt(val || '0', 10);
  return Number.isFinite(n) ? n : 0;
}

export async function incrementViews(env, topicId, by = 1) {
  const kv = env && env.RATE_LIMIT;
  if (!kv) return 0;
  const key = `views:topic:${topicId}`;
  const cur = parseInt((await kv.get(key)) || '0', 10) || 0;
  const next = cur + (Number.isFinite(by) ? by : 1);
  await kv.put(key, String(next));
  return next;
}
