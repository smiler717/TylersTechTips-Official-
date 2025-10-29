/**
 * Authentication utilities for Tyler's Tech Tips
 * Handles JWT token generation, validation, and password hashing
 */

import { json, error } from './_utils.js';

/**
 * Hash a password using Web Crypto API (SHA-256 with salt)
 * For production, consider using bcrypt/scrypt via a Worker binding
 */
export async function hashPassword(password, salt = null) {
  if (!salt) {
    const saltBytes = crypto.getRandomValues(new Uint8Array(16));
    salt = Array.from(saltBytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${salt}:${hashHex}`;
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password, storedHash) {
  const [salt, _] = storedHash.split(':');
  const newHash = await hashPassword(password, salt);
  return newHash === storedHash;
}

/**
 * Generate a JWT token (simplified - stores in KV with expiry)
 * In production, use proper JWT library or Cloudflare Access
 */
export async function generateToken(userId, username, env) {
  const tokenId = crypto.randomUUID();
  const token = `tt_${tokenId}`;
  const days = Number(env?.AUTH_TTL_DAYS) && Number(env.AUTH_TTL_DAYS) > 0 ? Number(env.AUTH_TTL_DAYS) : 7;
  const expiresAt = Date.now() + (days * 24 * 60 * 60 * 1000); // default 7 days
  
  const tokenData = {
    userId,
    username,
    createdAt: Date.now(),
    expiresAt
  };
  
  // Store in KV with TTL
  const KV = env.RATE_LIMIT || env.TYLERS_TECH_KV;
  if (KV) {
    await KV.put(`auth:${token}`, JSON.stringify(tokenData), {
      expirationTtl: days * 24 * 60 * 60 // seconds
    });
  }
  
  return { token, expiresAt };
}

/**
 * Validate a token and return user data
 */
export async function validateToken(token, env) {
  if (!token || !token.startsWith('tt_')) return null;
  
  const KV = env.RATE_LIMIT || env.TYLERS_TECH_KV;
  if (!KV) return null;
  
  const data = await KV.get(`auth:${token}`, 'json');
  if (!data) return null;
  
  if (data.expiresAt < Date.now()) {
    // Token expired
    await KV.delete(`auth:${token}`);
    return null;
  }
  
  return data;
}

/**
 * Get current user from request headers
 */
export async function getCurrentUser(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;
  
  const token = authHeader.replace('Bearer ', '').trim();
  return await validateToken(token, env);
}

/**
 * Logout - delete token from KV
 */
export async function logout(token, env) {
  if (!token || !token.startsWith('tt_')) return;
  
  const KV = env.RATE_LIMIT || env.TYLERS_TECH_KV;
  if (KV) {
    await KV.delete(`auth:${token}`);
  }
}

/**
 * Logout all tokens for a user
 */
export async function logoutAllForUser(userId, env) {
  const KV = env.RATE_LIMIT || env.TYLERS_TECH_KV;
  if (!KV || !userId) return 0;
  let cursor = undefined;
  let deleted = 0;
  do {
    const list = await KV.list({ prefix: 'auth:tt_', cursor });
    cursor = list.cursor;
    const keys = list.keys || [];
    if (!keys.length) continue;
    // Fetch values in parallel in small batches to check userId
    const batch = await Promise.all(keys.map(k => KV.get(k.name, 'json').then(v => ({ key: k.name, val: v })).catch(() => ({ key: k.name, val: null }))));
    const mine = batch.filter(x => x.val && x.val.userId === userId);
    await Promise.all(mine.map(x => KV.delete(x.key)));
    deleted += mine.length;
  } while (cursor);
  return deleted;
}

/**
 * Rotate a token: create a new token for the same user and delete the old one
 */
export async function rotateToken(oldToken, env) {
  const data = await validateToken(oldToken, env);
  if (!data) return null;
  const { userId, username } = data;
  const { token, expiresAt } = await generateToken(userId, username, env);
  await logout(oldToken, env);
  return { token, expiresAt };
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate username (alphanumeric, underscore, hyphen, 3-20 chars)
 */
export function isValidUsername(username) {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
}

/**
 * Require authentication middleware helper
 */
export async function requireAuth(request, env) {
  const user = await getCurrentUser(request, env);
  if (!user) {
    return error(401, 'Authentication required');
  }
  return user;
}
