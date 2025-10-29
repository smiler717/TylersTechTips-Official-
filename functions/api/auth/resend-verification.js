/**
 * Resend Email Verification Token
 * POST /api/auth/resend-verification
 */

import { json, error } from '../_utils.js';
import { getCurrentUser } from '../_auth.js';

async function sendMailchannels(env, toEmail, subject, html, text) {
  try {
    // Requires MailChannels to be allowed for the domain's from address
    const fromEmail = env.MAIL_FROM;
    const fromName = env.MAIL_FROM_NAME || "Tyler's Tech Tips";
    if (!fromEmail) return { sent: false, reason: 'MAIL_FROM not configured' };
    const payload = {
      personalizations: [{ to: [{ email: toEmail }] }],
      from: { email: fromEmail, name: fromName },
      subject,
      content: [
        { type: 'text/plain', value: text || '' },
        { type: 'text/html', value: html || '' }
      ]
    };
    const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return { sent: res.ok };
  } catch (e) {
    return { sent: false, reason: e?.message || 'send failed' };
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key, Authorization',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestPost({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const user = await getCurrentUser(request, env);
  if (!user) return error(401, 'Not authenticated');

  try {
    // Load current user row
    let row = await DB.prepare('SELECT id, email, email_verified FROM users WHERE id = ?')
      .bind(user.userId).first();
    if (!row) return error(404, 'User not found');

    // If already verified, no action
    if (row.email_verified) {
      return json({ success: true, alreadyVerified: true });
    }

    // Ensure columns exist (idempotent)
    try { await DB.exec('ALTER TABLE users ADD COLUMN verification_token TEXT'); } catch (_) {}
    try { await DB.exec('ALTER TABLE users ADD COLUMN verification_expires INTEGER'); } catch (_) {}

    const token = crypto.randomUUID();
    const expires = Date.now() + (7 * 24 * 60 * 60 * 1000);
    await DB.prepare('UPDATE users SET verification_token = ?, verification_expires = ? WHERE id = ?')
      .bind(token, expires, user.userId).run();

    const endpoint = `/api/auth/verify-email?token=${token}`;

    // Optionally send via MailChannels
    let mail = { sent: false };
    if (env.ENABLE_EMAIL_SENDING) {
      const siteUrl = env.SITE_URL || '';
      const link = siteUrl ? `${siteUrl}${endpoint}` : endpoint;
      const subject = 'Verify your email - Tyler\'s Tech Tips';
      const html = `<p>Click to verify your email:</p><p><a href="${link}">${link}</a></p>`;
      const text = `Verify your email: ${link}`;
      mail = await sendMailchannels(env, row.email, subject, html, text);
    }

    return json({ success: true, verify: { token, endpoint }, mail });
  } catch (e) {
    console.error('resend-verification error:', e);
    return error(500, 'Failed to resend verification');
  }
}
