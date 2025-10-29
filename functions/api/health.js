/**
 * Simple health check endpoint to verify Functions are working
 * GET /api/health
 */
export async function onRequestGet({ request, env }) {
  return new Response(JSON.stringify({
    status: 'ok',
    message: 'API Functions are working!',
    timestamp: new Date().toISOString(),
    bindings: {
      hasDB: !!env.DB,
      hasRateLimit: !!env.RATE_LIMIT,
      hasAdminKey: !!env.ADMIN_KEY
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    }
  });
}
