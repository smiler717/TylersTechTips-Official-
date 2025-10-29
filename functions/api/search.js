/**
 * Full-Text Search using SQLite FTS5
 * GET /api/search?q=query&category=General&limit=50&offset=0
 */

import { json, error } from './_utils.js';
import { getCached, setCached, CacheKey, cacheResponse } from './_cache.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestGet({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();
  const category = (url.searchParams.get('category') || '').trim();
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

  if (!query) {
    return error(400, 'Missing search query parameter: q');
  }

  try {
    // Check cache
    const cacheKey = CacheKey.searchResults(`${query}:${category}:${limit}:${offset}`);
    const cached = await getCached(env, cacheKey);
    if (cached) {
      return cacheResponse(cached, {}, 'public, max-age=300');
    }

    // Build FTS5 query - escape special characters
    const ftsQuery = query.replace(/[^\w\s]/g, ' ').trim();
    if (!ftsQuery) {
      return error(400, 'Invalid search query');
    }

    // FTS5 search with ranking
    let sql = `
      SELECT 
        t.id, 
        t.title, 
        t.body, 
        t.author, 
        t.category, 
        t.created_at,
        rank
      FROM topics_fts 
      INNER JOIN topics t ON topics_fts.id = t.id
      WHERE topics_fts MATCH ?
    `;
    
    const params = [ftsQuery];

    // Add category filter
    if (category) {
      sql += ` AND t.category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY rank LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await DB.prepare(sql).bind(...params).all();
    const topics = (result.results || []).map(t => ({
      id: t.id,
      title: t.title,
      body: t.body.substring(0, 200) + (t.body.length > 200 ? '...' : ''), // Truncate body
      author: t.author,
      category: t.category,
      createdAt: t.created_at,
      rank: t.rank
    }));

    // Get total count for pagination
    let countSql = `
      SELECT COUNT(*) as total
      FROM topics_fts
      INNER JOIN topics t ON topics_fts.id = t.id
      WHERE topics_fts MATCH ?
    `;
    const countParams = [ftsQuery];
    if (category) {
      countSql += ` AND t.category = ?`;
      countParams.push(category);
    }

    const countResult = await DB.prepare(countSql).bind(...countParams).first();
    const total = countResult?.total || 0;

    const response = {
      query,
      category: category || null,
      results: topics,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };

    // Cache results
    await setCached(env, cacheKey, response, 300); // 5min TTL

    return json(response);
  } catch (e) {
    console.error('Search error:', e);
    
    // Fallback to LIKE search if FTS5 not available
    try {
      let fallbackSql = `
        SELECT id, title, body, author, category, created_at
        FROM topics
        WHERE (title LIKE ? OR body LIKE ? OR author LIKE ?)
      `;
      const likeQuery = `%${query}%`;
      const fallbackParams = [likeQuery, likeQuery, likeQuery];

      if (category) {
        fallbackSql += ` AND category = ?`;
        fallbackParams.push(category);
      }

      fallbackSql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      fallbackParams.push(limit, offset);

      const result = await DB.prepare(fallbackSql).bind(...fallbackParams).all();
      const topics = (result.results || []).map(t => ({
        id: t.id,
        title: t.title,
        body: t.body.substring(0, 200) + (t.body.length > 200 ? '...' : ''),
        author: t.author,
        category: t.category,
        createdAt: t.created_at
      }));

      return json({
        query,
        category: category || null,
        results: topics,
        total: topics.length,
        limit,
        offset,
        hasMore: false,
        fallback: true
      });
    } catch (fallbackError) {
      console.error('Fallback search error:', fallbackError);
      return error(500, 'Search failed');
    }
  }
}
