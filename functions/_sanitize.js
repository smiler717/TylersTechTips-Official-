/**
 * Security utilities for sanitizing user input
 */

/**
 * Sanitize text input to prevent XSS attacks
 * Removes HTML tags and dangerous characters
 */
export function sanitizeText(input, maxLength = 5000) {
  if (typeof input !== 'string') return '';
  
  // Trim and limit length
  let text = input.trim().substring(0, maxLength);
  
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Escape special HTML characters
  text = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  return text;
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(input) {
  if (typeof input !== 'string') return '';
  
  const email = input.trim().toLowerCase().substring(0, 100);
  
  // Basic email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) return '';
  
  return email;
}

/**
 * Sanitize category/type selection (must match predefined values)
 */
export function sanitizeSelection(input, allowedValues) {
  if (typeof input !== 'string') return allowedValues[0] || '';
  
  const value = input.trim();
  
  return allowedValues.includes(value) ? value : allowedValues[0] || '';
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(input) {
  if (typeof input !== 'string') return '';
  
  const url = input.trim().substring(0, 2000);
  
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Rate limit validation helper
 * Returns sanitized device ID or throws
 */
export function validateDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== 'string' || deviceId.length > 100) {
    throw new Error('Invalid device ID');
  }
  
  // Only allow alphanumeric, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(deviceId)) {
    throw new Error('Invalid device ID format');
  }
  
  return deviceId;
}

/**
 * Sanitize user input object for feedback/comments
 */
export function sanitizeFeedbackInput(input) {
  return {
    name: input.name ? sanitizeText(input.name, 60) : '',
    email: input.email ? sanitizeEmail(input.email) : '',
    type: sanitizeSelection(input.type, ['suggestion', 'bug', 'topic-request', 'question', 'other']),
    message: sanitizeText(input.message, 2000)
  };
}

/**
 * Sanitize topic/comment input
 */
export function sanitizeTopicInput(input) {
  return {
    title: sanitizeText(input.title || '', 200),
    body: sanitizeText(input.body || '', 5000),
    author: sanitizeText(input.author || 'Anonymous', 60),
    category: sanitizeSelection(input.category, ['General', 'Hardware', 'Software', 'Networking', 'Security', 'Cloud'])
  };
}
