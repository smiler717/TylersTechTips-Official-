/**
 * CSRF Protection Middleware
 * Validates CSRF tokens on mutating requests
 */

import { error } from './_utils.js';
import { validateCsrfToken } from './_csrf.js';

/**
 * Validate CSRF token from request headers
 * @param {Request} request - Incoming request
 * @param {object} env - Environment bindings
 * @param {string} deviceId - Device ID from headers
 * @returns {Promise<boolean>} - True if valid or not required
 */
export async function validateCsrf(request, env, deviceId) {
  const method = request.method.toUpperCase();
  
  // Only validate on mutating methods
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return true;
  }

  // Skip CSRF for OPTIONS (preflight)
  if (method === 'OPTIONS') {
    return true;
  }

  // Get CSRF token from header
  const csrfToken = request.headers.get('x-csrf-token');
  if (!csrfToken) {
    return false;
  }

  // Validate token
  const isValid = await validateCsrfToken(csrfToken, deviceId, env);
  return isValid;
}

/**
 * CSRF middleware wrapper for endpoint handlers
 * @param {Function} handler - Endpoint handler function
 * @returns {Function} - Wrapped handler with CSRF validation
 */
export function withCsrfProtection(handler) {
  return async (context) => {
    const { request, env } = context;
    const method = request.method.toUpperCase();

    // Skip validation for non-mutating methods
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      return handler(context);
    }

    // Get device ID from header
    const deviceId = request.headers.get('x-device-id');
    if (!deviceId) {
      return error(400, 'Device ID required');
    }

    // Validate CSRF token
    const csrfToken = request.headers.get('x-csrf-token');
    if (!csrfToken) {
      return error(403, 'CSRF token required');
    }

    const isValid = await validateCsrfToken(csrfToken, deviceId, env);
    if (!isValid) {
      return error(403, 'Invalid CSRF token');
    }

    // Token is valid, proceed with handler
    return handler(context);
  };
}

/**
 * CSRF middleware for authenticated endpoints
 * Combines auth and CSRF validation
 */
export function withAuthAndCsrf(handler) {
  return async (context) => {
    const { request, env } = context;
    const method = request.method.toUpperCase();

    // For mutating methods, validate CSRF
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      const deviceId = request.headers.get('x-device-id');
      if (!deviceId) {
        return error(400, 'Device ID required');
      }

      const csrfToken = request.headers.get('x-csrf-token');
      if (!csrfToken) {
        return error(403, 'CSRF token required');
      }

      const isValid = await validateCsrfToken(csrfToken, deviceId, env);
      if (!isValid) {
        return error(403, 'Invalid CSRF token');
      }
    }

    // Proceed with handler (which should validate auth)
    return handler(context);
  };
}
