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
  const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000); // 30 days
  
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
      expirationTtl: 30 * 24 * 60 * 60 // 30 days in seconds
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
