/**
 * CSRF (Cross-Site Request Forgery) Protection
 * Generates and validates CSRF tokens stored in KV
 */

import { error } from './_utils.js';

const CSRF_TOKEN_TTL = 3600; // 1 hour
const CSRF_HEADER = 'x-csrf-token';

/**
 * Generate a new CSRF token for a session
 */
export async function generateCsrfToken(env, sessionId) {
  const kv = env?.RATE_LIMIT;
  if (!kv) return null;

  const token = crypto.randomUUID();
  const key = `csrf:${sessionId}`;

  try {
    await kv.put(key, token, { expirationTtl: CSRF_TOKEN_TTL });
    return token;
  } catch (e) {
    console.error('CSRF token generation error:', e);
    return null;
  }
}

/**
 * Validate CSRF token from request
 */
export async function validateCsrfToken(env, sessionId, providedToken) {
  const kv = env?.RATE_LIMIT;
  if (!kv) return false; // Fail closed if KV unavailable

  if (!providedToken || !sessionId) return false;

  const key = `csrf:${sessionId}`;

  try {
    const storedToken = await kv.get(key);
    return storedToken === providedToken;
  } catch (e) {
    console.error('CSRF validation error:', e);
    return false;
  }
}

/**
 * Middleware to require CSRF token on mutating requests
 */
export async function requireCsrf(request, env, sessionId) {
  const method = request.method.toUpperCase();

  // Only validate on mutating methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null; // No validation needed
  }

  const csrfToken = request.headers.get(CSRF_HEADER);
  
  if (!csrfToken) {
    return error(403, 'CSRF token required', { code: 'CSRF_TOKEN_MISSING' });
  }

  const isValid = await validateCsrfToken(env, sessionId, csrfToken);

  if (!isValid) {
    return error(403, 'Invalid CSRF token', { code: 'CSRF_TOKEN_INVALID' });
  }

  return null; // Validation passed
}

/**
 * Get CSRF token from request or generate new one
 * Returns token to be sent to client
 */
export async function getCsrfTokenForSession(env, sessionId) {
  const kv = env?.RATE_LIMIT;
  if (!kv) return null;

  const key = `csrf:${sessionId}`;

  try {
    // Check if token exists
    let token = await kv.get(key);

    if (!token) {
      // Generate new token
      token = await generateCsrfToken(env, sessionId);
    }

    return token;
  } catch (e) {
    console.error('CSRF token retrieval error:', e);
    return null;
  }
}

/**
 * Rotate CSRF token (call after sensitive operations)
 */
export async function rotateCsrfToken(env, sessionId) {
  const kv = env?.RATE_LIMIT;
  if (!kv) return null;

  const key = `csrf:${sessionId}`;

  try {
    // Delete old token
    await kv.delete(key);
    
    // Generate new token
    return await generateCsrfToken(env, sessionId);
  } catch (e) {
    console.error('CSRF token rotation error:', e);
    return null;
  }
}

/**
 * Delete CSRF token (call on logout)
 */
export async function deleteCsrfToken(env, sessionId) {
  const kv = env?.RATE_LIMIT;
  if (!kv) return;

  const key = `csrf:${sessionId}`;

  try {
    await kv.delete(key);
  } catch (e) {
    console.error('CSRF token deletion error:', e);
  }
}
