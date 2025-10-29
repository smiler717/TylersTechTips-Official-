/**
 * Audit Logging System
 * Logs all important actions to audit_logs table
 */

/**
 * Log an action to the audit table
 */
export async function logAudit(env, {
  userId = null,
  action,
  resourceType = null,
  resourceId = null,
  ipAddress = null,
  userAgent = null,
  metadata = null
}) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return false;

  try {
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    await DB.prepare(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      action,
      resourceType,
      resourceId,
      ipAddress,
      userAgent,
      metadataStr,
      Date.now()
    ).run();

    return true;
  } catch (e) {
    console.error('Audit log error:', e);
    return false;
  }
}

/**
 * Extract IP and user agent from request
 */
export function getRequestMetadata(request) {
  return {
    ipAddress: request.headers.get('cf-connecting-ip') || 
               request.headers.get('x-forwarded-for') || 
               'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown'
  };
}

/**
 * Audit actions enum for consistency
 */
export const AuditAction = {
  // Authentication
  LOGIN: 'auth.login',
  LOGIN_FAILED: 'auth.login_failed',
  LOGOUT: 'auth.logout',
  LOGOUT_ALL: 'auth.logout_all',
  REGISTER: 'auth.register',
  PASSWORD_CHANGE: 'auth.password_change',
  EMAIL_VERIFY: 'auth.email_verify',
  TOKEN_REFRESH: 'auth.token_refresh',
  
  // Topics
  TOPIC_CREATE: 'topic.create',
  TOPIC_UPDATE: 'topic.update',
  TOPIC_DELETE: 'topic.delete',
  TOPIC_VIEW: 'topic.view',
  TOPIC_VOTE: 'topic.vote',
  
  // Comments
  COMMENT_CREATE: 'comment.create',
  COMMENT_UPDATE: 'comment.update',
  COMMENT_DELETE: 'comment.delete',
  
  // Moderation
  REPORT_CREATE: 'report.create',
  REPORT_REVIEW: 'report.review',
  USER_BAN: 'user.ban',
  USER_UNBAN: 'user.unban',
  CONTENT_MODERATE: 'content.moderate',
  
  // Admin
  ADMIN_ACTION: 'admin.action',
  MIGRATION_RUN: 'admin.migration',
  
  // User
  PROFILE_UPDATE: 'user.profile_update',
  BOOKMARK_ADD: 'user.bookmark_add',
  BOOKMARK_REMOVE: 'user.bookmark_remove',
};

/**
 * Get audit logs for a user
 */
export async function getUserAuditLogs(env, userId, limit = 50, offset = 0) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return [];

  try {
    const result = await DB.prepare(`
      SELECT id, action, resource_type, resource_id, ip_address, created_at
      FROM audit_logs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).bind(userId, limit, offset).all();

    return result.results || [];
  } catch (e) {
    console.error('Get audit logs error:', e);
    return [];
  }
}

/**
 * Get audit logs for a resource
 */
export async function getResourceAuditLogs(env, resourceType, resourceId, limit = 50) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return [];

  try {
    const result = await DB.prepare(`
      SELECT id, user_id, action, ip_address, created_at
      FROM audit_logs
      WHERE resource_type = ? AND resource_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).bind(resourceType, resourceId, limit).all();

    return result.results || [];
  } catch (e) {
    console.error('Get resource audit logs error:', e);
    return [];
  }
}

/**
 * Get all audit logs (admin only)
 */
export async function getAllAuditLogs(env, filters = {}, limit = 100, offset = 0) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return { logs: [], total: 0 };

  try {
    let sql = 'SELECT id, user_id, action, resource_type, resource_id, ip_address, created_at FROM audit_logs WHERE 1=1';
    const params = [];

    if (filters.userId) {
      sql += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.action) {
      sql += ' AND action = ?';
      params.push(filters.action);
    }

    if (filters.resourceType) {
      sql += ' AND resource_type = ?';
      params.push(filters.resourceType);
    }

    if (filters.startDate) {
      sql += ' AND created_at >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND created_at <= ?';
      params.push(filters.endDate);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const result = await DB.prepare(sql).bind(...params).all();

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM audit_logs WHERE 1=1';
    const countParams = params.slice(0, -2); // Remove limit/offset

    if (filters.userId) countSql += ' AND user_id = ?';
    if (filters.action) countSql += ' AND action = ?';
    if (filters.resourceType) countSql += ' AND resource_type = ?';
    if (filters.startDate) countSql += ' AND created_at >= ?';
    if (filters.endDate) countSql += ' AND created_at <= ?';

    const countResult = await DB.prepare(countSql).bind(...countParams).first();

    return {
      logs: result.results || [],
      total: countResult?.total || 0
    };
  } catch (e) {
    console.error('Get all audit logs error:', e);
    return { logs: [], total: 0 };
  }
}
