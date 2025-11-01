// Cloudflare Pages Function: /api/feedback
// Handles user feedback submissions with rate limiting
import { sanitizeFeedbackInput, validateDeviceId } from './_sanitize.js';

// Lightweight MailChannels sender (same pattern as auth/resend-verification)
async function sendMailchannels(env, toEmail, subject, html, text) {
  try {
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
    const body = await res.text().catch(() => '');
    return { sent: res.ok, status: res.status, body: body?.slice(0, 500) };
  } catch (e) {
    return { sent: false, reason: e?.message || 'send failed' };
  }
}

// Microsoft 365 (Graph API) sender using client credentials
async function sendMicrosoftGraphMail(env, toEmail, subject, html, text) {
  const tenant = env.MS_TENANT_ID;
  const clientId = env.MS_CLIENT_ID;
  const clientSecret = env.MS_CLIENT_SECRET;
  const sender = env.MS_SENDER || env.MAIL_FROM; // no-reply@tylerstechtips.com
  if (!tenant || !clientId || !clientSecret || !sender) {
    return { sent: false, reason: 'Missing MS_* config (MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_SENDER)' };
  }
  try {
    const scope = 'https://graph.microsoft.com/.default';
    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope,
        grant_type: 'client_credentials'
      })
    });
    const tokenBody = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenBody.access_token) {
      return { sent: false, status: tokenRes.status, reason: 'Token error', body: JSON.stringify(tokenBody).slice(0, 500) };
    }

    const message = {
      message: {
        subject,
        body: { contentType: html ? 'HTML' : 'Text', content: html || text || '' },
        toRecipients: [{ emailAddress: { address: toEmail } }]
      },
      saveToSentItems: false
    };

    // Send as specific user/mailbox
    const sendRes = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${tokenBody.access_token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    // Graph returns 202 on success with empty body
    const sendText = await sendRes.text().catch(() => '');
    return { sent: sendRes.ok, status: sendRes.status, body: sendText?.slice(0, 500) };
  } catch (e) {
    return { sent: false, reason: e?.message || 'graph send failed' };
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-device-id, x-admin-key',
      'Access-Control-Max-Age': '86400',
    }
  });
}

export async function onRequestPost({ request, env }) {
  try {
    const rawInput = await request.json();
    const { name, email, type, message } = sanitizeFeedbackInput(rawInput);
    
    if (!type || !message) {
      return new Response(JSON.stringify({ error: 'Type and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get device ID for rate limiting
    const rawDeviceId = request.headers.get('x-device-id') || 
                        request.headers.get('cf-connecting-ip') || 
                        'unknown';
    
    let deviceId;
    try {
      deviceId = validateDeviceId(rawDeviceId);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid device identifier' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Rate limiting: 1 feedback per 60 seconds per device
    const rateLimitKey = `feedback:${deviceId}`;
    const KV = env.RATE_LIMIT || env.TYLERS_TECH_KV;
    
    if (KV) {
      const lastSubmit = await KV.get(rateLimitKey);
      
      if (lastSubmit) {
        const elapsed = Date.now() - parseInt(lastSubmit, 10);
        const waitMs = 60000 - elapsed;
        
        if (waitMs > 0) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded', waitMs }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // Store feedback in D1 database
    const DB = env.DB || env.TYLERS_TECH_DB;
    if (!DB) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const stmt = DB.prepare(`
      INSERT INTO feedback (name, email, type, message, device_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = await stmt
      .bind(
        name || 'Anonymous',
        email || null,
        type,
        message,
        deviceId,
        Date.now()
      )
      .run();

    // Update rate limit
    if (KV) {
      await KV.put(rateLimitKey, Date.now().toString(), {
        expirationTtl: 60
      });
    }

    // Send notification email (optional)
    let mail = { sent: false };
    try {
      if (env.ENABLE_EMAIL_SENDING) {
        const to = env.MAIL_TO_FEEDBACK || 'feedback@tylerstechtips.com';
        const site = env.SITE_URL || 'https://tylerstechtips.com';
        const subject = `New Feedback: ${type}${name ? ` from ${name}` : ''}`;
        const safeName = name || 'Anonymous';
        const safeEmail = email || 'N/A';
        const created = new Date().toISOString();
        const html = `
          <h2>New Feedback Received</h2>
          <p><strong>Type:</strong> ${type}</p>
          <p><strong>Name:</strong> ${safeName}</p>
          <p><strong>Email:</strong> ${safeEmail}</p>
          <p><strong>Submitted:</strong> ${created}</p>
          <hr />
          <p><strong>Message:</strong></p>
          <pre style="white-space:pre-wrap;font-family:system-ui,Segoe UI,Roboto,Arial">${message}</pre>
          <hr />
          <p>View site: <a href="${site}">${site}</a></p>
        `;
        const text = `New Feedback\nType: ${type}\nName: ${safeName}\nEmail: ${safeEmail}\nSubmitted: ${created}\n\nMessage:\n${message}\n\nSite: ${site}`;
        // Prefer Microsoft Graph if configured, else MailChannels
        if (env.MS_TENANT_ID && env.MS_CLIENT_ID && env.MS_CLIENT_SECRET && (env.MS_SENDER || env.MAIL_FROM)) {
          mail = await sendMicrosoftGraphMail(env, to, subject, html, text);
        } else {
          mail = await sendMailchannels(env, to, subject, html, text);
        }
      }
    } catch (e) {
      // Don't fail the request if email fails; just log
      console.error('Feedback email send failed', e);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      id: result.meta.last_row_id,
      mail
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Feedback error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// GET endpoint to retrieve feedback (admin only)
export async function onRequestGet({ request, env }) {
  try {
    // Require admin key
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = env.FEEDBACK_ADMIN_KEY || env.ADMIN_KEY;
    
    if (!adminKey || adminKey !== expectedKey) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get query parameters
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const type = url.searchParams.get('type');

    // Optional: test email send
    if (url.searchParams.get('action') === 'test-email') {
      if (!env.ENABLE_EMAIL_SENDING) {
        return new Response(JSON.stringify({ ok: true, email: { sent: false, reason: 'ENABLE_EMAIL_SENDING not set' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      const to = url.searchParams.get('to') || env.MAIL_TO_FEEDBACK || 'feedback@tylerstechtips.com';
      const subject = 'Test: Feedback email delivery check';
      const html = '<p>This is a test email from /api/feedback?action=test-email</p>';
      const text = 'This is a test email from /api/feedback?action=test-email';
      const mail = await sendMailchannels(env, to, subject, html, text);
      return new Response(JSON.stringify({ ok: true, email: mail, to }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let query = 'SELECT * FROM feedback';
    const params = [];

    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const DB = env.DB || env.TYLERS_TECH_DB;
    if (!DB) {
      return new Response(JSON.stringify({ error: 'Database not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  const stmt = DB.prepare(query);
    const { results } = await stmt.bind(...params).all();

    return new Response(JSON.stringify({ 
      feedback: results,
      count: results.length 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Feedback retrieval error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
