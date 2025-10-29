/**
 * Admin Audit Logs
 * GET /api/admin/audit-logs - Get audit logs with filtering
 */

import { json, error, isAdmin } from '../_utils.js';
import { getAllAuditLogs } from '../_audit.js';

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestGet({ request, env }) {
  const admin = await isAdmin(request, env);
  if (!admin) return error(403, 'Admin access required');

  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10));

  const filters = {};
  if (url.searchParams.get('userId')) {
    filters.userId = parseInt(url.searchParams.get('userId'));
  }
  if (url.searchParams.get('action')) {
    filters.action = url.searchParams.get('action');
  }
  if (url.searchParams.get('resourceType')) {
    filters.resourceType = url.searchParams.get('resourceType');
  }
  if (url.searchParams.get('startDate')) {
    filters.startDate = parseInt(url.searchParams.get('startDate'));
  }
  if (url.searchParams.get('endDate')) {
    filters.endDate = parseInt(url.searchParams.get('endDate'));
  }

  try {
    const { logs, total } = await getAllAuditLogs(env, filters, limit, offset);

    return json({
      logs,
      total,
      limit,
      offset,
      filters
    });
  } catch (e) {
    console.error('Get audit logs error:', e);
    return error(500, 'Failed to get audit logs');
  }
}
