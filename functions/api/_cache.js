/**
 * KV-based caching layer with TTL and invalidation
 * Caches topics, comments, and user data
 */

const DEFAULT_TTL = 300; // 5 minutes
const TOPIC_TTL = 900; // 15 minutes for topics
const COMMENT_TTL = 600; // 10 minutes for comments
const USER_TTL = 1800; // 30 minutes for user profiles

/**
 * Cache key generators
 */
export const CacheKey = {
  topic: (id) => `cache:topic:${id}`,
  topicList: (limit, offset, category) => `cache:topics:${limit}:${offset}:${category || 'all'}`,
  topicComments: (topicId, limit, offset) => `cache:comments:${topicId}:${limit}:${offset}`,
  user: (userId) => `cache:user:${userId}`,
  userProfile: (username) => `cache:profile:${username}`,
  searchResults: (query) => `cache:search:${query}`,
};

/**
 * Get cached data from KV
 */
export async function getCached(env, key) {
  const kv = env?.RATE_LIMIT; // Using same KV namespace
  if (!kv) return null;
  
  try {
    const value = await kv.get(key);
    if (!value) return null;
    
    const parsed = JSON.parse(value);
    
    // Check if expired
    if (parsed.expires && parsed.expires < Date.now()) {
      await kv.delete(key);
      return null;
    }
    
    return parsed.data;
  } catch (e) {
    console.error('Cache get error:', e);
    return null;
  }
}

/**
 * Set cached data in KV
 */
export async function setCached(env, key, data, ttlSeconds = DEFAULT_TTL) {
  const kv = env?.RATE_LIMIT;
  if (!kv) return false;
  
  try {
    const payload = {
      data,
      expires: Date.now() + (ttlSeconds * 1000),
      cached_at: Date.now()
    };
    
    await kv.put(key, JSON.stringify(payload), { 
      expirationTtl: Math.max(60, ttlSeconds) // KV requires min 60s
    });
    
    return true;
  } catch (e) {
    console.error('Cache set error:', e);
    return false;
  }
}

/**
 * Invalidate cache entries by prefix
 */
export async function invalidateCache(env, prefix) {
  const kv = env?.RATE_LIMIT;
  if (!kv) return false;
  
  try {
    // KV doesn't support prefix deletion, so we'll use a manifest approach
    // Store list of cache keys for bulk invalidation
    const manifestKey = `cache:manifest:${prefix}`;
    const manifest = await kv.get(manifestKey);
    
    if (manifest) {
      const keys = JSON.parse(manifest);
      await Promise.all(keys.map(k => kv.delete(k)));
      await kv.delete(manifestKey);
    }
    
    return true;
  } catch (e) {
    console.error('Cache invalidation error:', e);
    return false;
  }
}

/**
 * Add key to manifest for later bulk invalidation
 */
async function addToManifest(env, prefix, key) {
  const kv = env?.RATE_LIMIT;
  if (!kv) return;
  
  try {
    const manifestKey = `cache:manifest:${prefix}`;
    const existing = await kv.get(manifestKey);
    const keys = existing ? JSON.parse(existing) : [];
    
    if (!keys.includes(key)) {
      keys.push(key);
      await kv.put(manifestKey, JSON.stringify(keys), { expirationTtl: 86400 }); // 24h manifest TTL
    }
  } catch (e) {
    console.error('Manifest update error:', e);
  }
}

/**
 * Invalidate specific topic caches
 */
export async function invalidateTopic(env, topicId) {
  const kv = env?.RATE_LIMIT;
  if (!kv) return;
  
  const keys = [
    CacheKey.topic(topicId),
    CacheKey.topicComments(topicId, 20, 0),
    CacheKey.topicComments(topicId, 50, 0),
  ];
  
  // Also invalidate topic list caches
  await Promise.all([
    ...keys.map(k => kv.delete(k)),
    invalidateCache(env, 'topics'), // All topic lists
  ]);
}

/**
 * Invalidate comment caches for a topic
 */
export async function invalidateComments(env, topicId) {
  const kv = env?.RATE_LIMIT;
  if (!kv) return;
  
  await Promise.all([
    kv.delete(CacheKey.topicComments(topicId, 20, 0)),
    kv.delete(CacheKey.topicComments(topicId, 50, 0)),
    invalidateTopic(env, topicId), // Topic data includes comment count
  ]);
}

/**
 * Invalidate user caches
 */
export async function invalidateUser(env, userId, username) {
  const kv = env?.RATE_LIMIT;
  if (!kv) return;
  
  await Promise.all([
    kv.delete(CacheKey.user(userId)),
    username ? kv.delete(CacheKey.userProfile(username)) : Promise.resolve(),
  ]);
}

/**
 * Cache response helper with cache headers
 */
export function cacheResponse(data, init = {}, cacheControl = 'public, max-age=300') {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', cacheControl);
  headers.set('x-cache-status', 'HIT');
  
  // CORS
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, x-device-id, x-admin-key, Authorization');
  
  return new Response(JSON.stringify(data), { ...init, headers });
}

/**
 * No-cache response helper
 */
export function noCacheResponse(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store, no-cache, must-revalidate');
  headers.set('x-cache-status', 'MISS');
  
  // CORS
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, x-device-id, x-admin-key, Authorization');
  
  return new Response(JSON.stringify(data), { ...init, headers });
}

/**
 * Higher-order function to wrap GET endpoints with caching
 */
export function withCache(handler, ttl = DEFAULT_TTL, keyGenerator) {
  return async (context) => {
    const { request, env } = context;
    
    // Only cache GET requests
    if (request.method !== 'GET') {
      return handler(context);
    }
    
    // Generate cache key
    const cacheKey = keyGenerator ? keyGenerator(context) : `cache:${request.url}`;
    
    // Try cache first
    const cached = await getCached(env, cacheKey);
    if (cached) {
      return cacheResponse(cached, {}, `public, max-age=${ttl}`);
    }
    
    // Execute handler
    const response = await handler(context);
    
    // Cache successful responses
    if (response.ok) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        await setCached(env, cacheKey, data, ttl);
      } catch (e) {
        console.error('Failed to cache response:', e);
      }
    }
    
    return response;
  };
}
