// Cloudflare Pages Function: /api/feedback
// Handles user feedback submissions with rate limiting
import { sanitizeFeedbackInput, validateDeviceId } from './_sanitize.js';

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const rawInput = await request.json();
    const { name, email, type, message } = sanitizeFeedbackInput(rawInput);
    
    if (!type || !message) {
      return new Response(JSON.stringify({ error: 'Type and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get device ID for rate limiting
    const rawDeviceId = request.headers.get('x-device-id') || 
                        request.headers.get('cf-connecting-ip') || 
                        'unknown';
    
    let deviceId;
    try {
      deviceId = validateDeviceId(rawDeviceId);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid device identifier' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Rate limiting: 1 feedback per 60 seconds per device
    const rateLimitKey = `feedback:${deviceId}`;
    const lastSubmit = await env.TYLERS_TECH_KV.get(rateLimitKey);
    
    if (lastSubmit) {
      const elapsed = Date.now() - parseInt(lastSubmit, 10);
      const waitMs = 60000 - elapsed;
      
      if (waitMs > 0) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded', waitMs }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Store feedback in D1 database
    const stmt = env.TYLERS_TECH_DB.prepare(`
      INSERT INTO feedback (name, email, type, message, device_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = await stmt
      .bind(
        name || 'Anonymous',
        email || null,
        type,
        message,
        deviceId,
        Date.now()
      )
      .run();

    // Update rate limit
    await env.TYLERS_TECH_KV.put(rateLimitKey, Date.now().toString(), {
      expirationTtl: 60
    });

    return new Response(JSON.stringify({ 
      success: true, 
      id: result.meta.last_row_id 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Feedback error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET endpoint to retrieve feedback (admin only)
export async function onRequestGet({ request, env }) {
  try {
    // Require admin key
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = env.FEEDBACK_ADMIN_KEY;
    
    if (!adminKey || adminKey !== expectedKey) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const type = url.searchParams.get('type');

    let query = 'SELECT * FROM feedback';
    const params = [];

    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = env.TYLERS_TECH_DB.prepare(query);
    const { results } = await stmt.bind(...params).all();

    return new Response(JSON.stringify({ 
      feedback: results,
      count: results.length 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Feedback retrieval error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
