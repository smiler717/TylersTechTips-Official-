/**
 * Upload API Endpoint
 * Handle file uploads
 */

import { json, error } from '../_utils.js';
import { getUserFromToken } from '../_auth.js';
import { validateCsrf } from '../_csrf-middleware.js';
import {
  validateFile,
  generateStorageKey,
  uploadToR2,
  uploadToCloudflareImages,
  createAttachment,
  getAttachmentUrl,
  ALLOWED_IMAGE_TYPES
} from '../_attachments.js';

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-id, x-csrf-token',
    'Access-Control-Max-Age': '86400'
  }});
}

/**
 * POST - Upload file
 */
export async function onRequestPost({ request, env }) {
  // Validate CSRF
  const deviceId = request.headers.get('x-device-id');
  if (!deviceId) {
    return error(400, 'Device ID required');
  }
  const csrfValid = await validateCsrf(request, env, deviceId);
  if (!csrfValid) {
    return error(403, 'Invalid CSRF token');
  }

  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  // Require authentication
  const user = await getUserFromToken(request, env);
  if (!user) {
    return error(401, 'Authentication required');
  }

  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file');
    const targetType = formData.get('targetType');
    const targetId = formData.get('targetId');

    if (!file) {
      return error(400, 'No file provided');
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return error(400, validation.errors.join('; '));
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const storageKey = generateStorageKey(user.id, file.name);

    let imageId = null;
    let width = null;
    let height = null;

    // Upload to appropriate service
    if (isImage && env.CF_ACCOUNT_ID && env.CF_API_TOKEN) {
      // Use Cloudflare Images for images
      try {
        const imageResult = await uploadToCloudflareImages(env, file);
        imageId = imageResult.imageId;

        // Also upload to R2 as backup
        await uploadToR2(env, file, storageKey);
      } catch (imgError) {
        console.error('Cloudflare Images upload failed, using R2:', imgError);
        await uploadToR2(env, file, storageKey);
      }
    } else {
      // Use R2 for non-images or if Images not configured
      await uploadToR2(env, file, storageKey);
    }

    // Create database record
    const attachment = await createAttachment(DB, {
      filename: file.name,
      originalFilename: file.name,
      mimeType: file.type,
      fileSize: file.size,
      storageKey,
      imageId,
      uploaderId: user.id,
      targetType: targetType || null,
      targetId: targetId ? parseInt(targetId, 10) : null,
      width,
      height
    });

    // Update attachment count if attached to target
    if (targetType && targetId) {
      const table = targetType === 'topic' ? 'topics' : 'comments';
      await DB.prepare(`
        UPDATE ${table}
        SET attachment_count = attachment_count + 1
        WHERE id = ?
      `).bind(parseInt(targetId, 10)).run();
    }

    // Get URL for immediate use
    const url = getAttachmentUrl({ ...attachment, image_id: imageId, storage_key: storageKey }, env);

    return json({
      success: true,
      attachment: {
        id: attachment.id,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        url,
        isImage,
        imageId,
        createdAt: attachment.createdAt
      }
    }, { status: 201 });

  } catch (e) {
    console.error('Upload error:', e);
    return error(500, 'File upload failed: ' + e.message);
  }
}
