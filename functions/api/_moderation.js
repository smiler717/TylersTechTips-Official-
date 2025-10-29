/**
 * Content Moderation Helpers
 * Spam detection, keyword filtering, and auto-moderation
 */

// Common spam patterns
const SPAM_PATTERNS = [
  /\b(viagra|cialis|pharmacy)\b/i,
  /\b(casino|poker|gambling)\b/i,
  /\b(make money (fast|quick|online))\b/i,
  /\b(click here|download now)\b/i,
  /(http[s]?:\/\/[^\s]+){3,}/gi, // Multiple URLs
  /[A-Z]{10,}/, // Excessive caps
  /(.)\1{10,}/, // Repeated characters
];

// Offensive word list (simplified - expand as needed)
const OFFENSIVE_WORDS = [
  'spam', 'scam', 'offensive1', 'offensive2' // Replace with actual list
];

/**
 * Check content for spam
 * @param {string} content - Content to check
 * @returns {object} - { isSpam: boolean, reason: string, confidence: number }
 */
export function detectSpam(content) {
  if (!content || typeof content !== 'string') {
    return { isSpam: false, reason: null, confidence: 0 };
  }

  const text = content.toLowerCase();
  let spamScore = 0;
  const reasons = [];

  // Check spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(content)) {
      spamScore += 30;
      reasons.push(`Matched spam pattern: ${pattern.toString()}`);
    }
  }

  // Check for excessive URLs
  const urlCount = (content.match(/https?:\/\//gi) || []).length;
  if (urlCount >= 3) {
    spamScore += 25;
    reasons.push(`Excessive URLs: ${urlCount}`);
  }

  // Check for excessive caps
  const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
  if (capsRatio > 0.5 && content.length > 20) {
    spamScore += 20;
    reasons.push(`Excessive capitals: ${(capsRatio * 100).toFixed(0)}%`);
  }

  // Check for repeated words
  const words = text.split(/\s+/);
  const wordCounts = {};
  for (const word of words) {
    if (word.length < 3) continue;
    wordCounts[word] = (wordCounts[word] || 0) + 1;
    if (wordCounts[word] >= 5) {
      spamScore += 15;
      reasons.push(`Repeated word: "${word}"`);
      break;
    }
  }

  const confidence = Math.min(spamScore / 100, 1);
  return {
    isSpam: spamScore >= 50,
    reason: reasons.join('; '),
    confidence,
    score: spamScore
  };
}

/**
 * Check content for offensive words
 * @param {string} content - Content to check
 * @returns {object} - { hasOffensive: boolean, words: string[] }
 */
export function detectOffensive(content) {
  if (!content || typeof content !== 'string') {
    return { hasOffensive: false, words: [] };
  }

  const text = content.toLowerCase();
  const foundWords = [];

  for (const word of OFFENSIVE_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(text)) {
      foundWords.push(word);
    }
  }

  return {
    hasOffensive: foundWords.length > 0,
    words: foundWords
  };
}

/**
 * Filter content based on keyword rules
 * @param {object} db - D1 database
 * @param {string} content - Content to filter
 * @returns {Promise<object>} - { allowed: boolean, reason: string }
 */
export async function filterByKeywords(db, content) {
  try {
    // Get banned keywords from database
    const keywords = await db.prepare(`
      SELECT keyword, action FROM moderation_keywords
      WHERE active = 1
    `).all();

    for (const { keyword, action } of keywords.results || []) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(content)) {
        if (action === 'block') {
          return { allowed: false, reason: `Blocked keyword: ${keyword}` };
        } else if (action === 'flag') {
          return { allowed: true, flagged: true, reason: `Flagged keyword: ${keyword}` };
        }
      }
    }

    return { allowed: true, flagged: false };
  } catch (error) {
    console.error('Keyword filter error:', error);
    return { allowed: true, flagged: false }; // Fail open
  }
}

/**
 * Auto-moderate content
 * @param {object} db - D1 database
 * @param {string} content - Content to moderate
 * @param {number} authorId - Author user ID
 * @returns {Promise<object>} - Moderation result
 */
export async function autoModerate(db, content, authorId) {
  const result = {
    approved: true,
    flagged: false,
    blocked: false,
    reasons: []
  };

  // Check spam
  const spamCheck = detectSpam(content);
  if (spamCheck.isSpam) {
    result.flagged = true;
    result.reasons.push(`Spam detected (${(spamCheck.confidence * 100).toFixed(0)}%)`);
    
    if (spamCheck.confidence >= 0.8) {
      result.blocked = true;
      result.approved = false;
    }
  }

  // Check offensive content
  const offensiveCheck = detectOffensive(content);
  if (offensiveCheck.hasOffensive) {
    result.flagged = true;
    result.reasons.push(`Offensive language: ${offensiveCheck.words.join(', ')}`);
  }

  // Check keyword filters
  const keywordCheck = await filterByKeywords(db, content);
  if (!keywordCheck.allowed) {
    result.blocked = true;
    result.approved = false;
    result.reasons.push(keywordCheck.reason);
  } else if (keywordCheck.flagged) {
    result.flagged = true;
    result.reasons.push(keywordCheck.reason);
  }

  // Check user trust score (users with good reputation get less scrutiny)
  try {
    const user = await db.prepare(`
      SELECT reputation FROM users WHERE id = ?
    `).bind(authorId).first();

    if (user && user.reputation >= 500) {
      // Trusted user - relax auto-moderation
      if (result.flagged && !result.blocked) {
        result.approved = true;
        result.flagged = false;
        result.reasons.push('Trusted user - auto-approved');
      }
    }
  } catch (error) {
    console.error('User check error:', error);
  }

  return result;
}

/**
 * Create moderation report
 */
export async function createModerationReport(db, data) {
  const { targetType, targetId, reason, details, autoFlagged = false } = data;

  const now = Date.now();

  await db.prepare(`
    INSERT INTO moderation_reports (target_type, target_id, reason, details, status, auto_flagged, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?, ?)
  `).bind(targetType, targetId, reason, details || '', autoFlagged ? 1 : 0, now).run();
}

/**
 * Get pending reports
 */
export async function getPendingReports(db, limit = 50, offset = 0) {
  const reports = await db.prepare(`
    SELECT * FROM moderation_reports
    WHERE status = 'pending'
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  return reports.results || [];
}
