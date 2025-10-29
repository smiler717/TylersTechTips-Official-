/**
 * File Upload Helpers
 * Handle file uploads to Cloudflare R2 and Images
 */

// Allowed file types
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed'
];

// File size limits (in bytes)
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate uploaded file
 */
export function validateFile(file, allowedTypes = ALLOWED_FILE_TYPES, maxSize = MAX_FILE_SIZE) {
  const errors = [];

  if (!file) {
    errors.push('No file provided');
    return { valid: false, errors };
  }

  // Check file type
  if (!allowedTypes.includes(file.type)) {
    errors.push(`File type ${file.type} not allowed`);
  }

  // Check file size
  if (file.size > maxSize) {
    errors.push(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds limit of ${(maxSize / 1024 / 1024).toFixed(2)}MB`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Generate unique storage key
 */
export function generateStorageKey(userId, filename) {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const ext = filename.split('.').pop();
  return `uploads/${userId}/${timestamp}-${random}.${ext}`;
}

/**
 * Upload file to Cloudflare R2
 */
export async function uploadToR2(env, file, storageKey) {
  const R2 = env.R2_BUCKET || env.TYLERS_TECH_R2;
  if (!R2) {
    throw new Error('R2 bucket not configured');
  }

  try {
    await R2.put(storageKey, file, {
      httpMetadata: {
        contentType: file.type
      }
    });

    return { success: true, key: storageKey };
  } catch (error) {
    console.error('R2 upload error:', error);
    throw new Error('Failed to upload file to R2');
  }
}

/**
 * Upload image to Cloudflare Images
 */
export async function uploadToCloudflareImages(env, file) {
  const accountId = env.CF_ACCOUNT_ID;
  const apiToken = env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Images not configured');
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`
        },
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error('Cloudflare Images upload failed');
    }

    const data = await response.json();
    return {
      success: true,
      imageId: data.result.id,
      variants: data.result.variants
    };

  } catch (error) {
    console.error('Cloudflare Images upload error:', error);
    throw error;
  }
}

/**
 * Create attachment record in database
 */
export async function createAttachment(db, data) {
  const {
    filename,
    originalFilename,
    mimeType,
    fileSize,
    storageKey,
    imageId,
    uploaderId,
    targetType,
    targetId,
    width,
    height
  } = data;

  const now = Date.now();

  const result = await db.prepare(`
    INSERT INTO attachments (
      filename, original_filename, mime_type, file_size,
      storage_key, image_id, uploader_id, target_type, target_id,
      width, height, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    filename,
    originalFilename,
    mimeType,
    fileSize,
    storageKey,
    imageId || null,
    uploaderId,
    targetType || null,
    targetId || null,
    width || null,
    height || null,
    now
  ).run();

  return { id: result.meta.last_row_id, createdAt: now };
}

/**
 * Get attachment URL
 */
export function getAttachmentUrl(attachment, env, variant = 'public') {
  if (attachment.image_id) {
    // Cloudflare Images URL
    const accountHash = env.CF_IMAGES_ACCOUNT_HASH;
    return `https://imagedelivery.net/${accountHash}/${attachment.image_id}/${variant}`;
  } else {
    // R2 URL (if public bucket or using signed URLs)
    const bucketUrl = env.R2_PUBLIC_URL;
    return `${bucketUrl}/${attachment.storage_key}`;
  }
}

/**
 * Delete attachment
 */
export async function deleteAttachment(env, db, attachmentId) {
  const attachment = await db.prepare(`
    SELECT * FROM attachments WHERE id = ?
  `).bind(attachmentId).first();

  if (!attachment) {
    throw new Error('Attachment not found');
  }

  // Delete from R2
  if (attachment.storage_key) {
    const R2 = env.R2_BUCKET || env.TYLERS_TECH_R2;
    if (R2) {
      try {
        await R2.delete(attachment.storage_key);
      } catch (error) {
        console.error('R2 delete error:', error);
      }
    }
  }

  // Delete from Cloudflare Images
  if (attachment.image_id) {
    const accountId = env.CF_ACCOUNT_ID;
    const apiToken = env.CF_API_TOKEN;

    if (accountId && apiToken) {
      try {
        await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1/${attachment.image_id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${apiToken}`
            }
          }
        );
      } catch (error) {
        console.error('Cloudflare Images delete error:', error);
      }
    }
  }

  // Delete from database
  await db.prepare(`DELETE FROM attachments WHERE id = ?`).bind(attachmentId).run();

  return { success: true };
}

/**
 * Get attachments for target
 */
export async function getAttachments(db, targetType, targetId) {
  const attachments = await db.prepare(`
    SELECT * FROM attachments
    WHERE target_type = ? AND target_id = ?
    ORDER BY created_at ASC
  `).bind(targetType, targetId).all();

  return attachments.results || [];
}
