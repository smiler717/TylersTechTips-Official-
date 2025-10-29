-- Migration: 008_file_attachments
-- Adds file attachment support

-- Attachments table
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE, -- R2 object key
  image_id TEXT, -- Cloudflare Images ID if applicable
  uploader_id INTEGER NOT NULL,
  target_type TEXT CHECK(target_type IN ('topic', 'comment', 'user_avatar')),
  target_id INTEGER,
  width INTEGER, -- For images
  height INTEGER, -- For images
  created_at INTEGER NOT NULL,
  FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_target ON attachments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploader ON attachments(uploader_id);
CREATE INDEX IF NOT EXISTS idx_attachments_created ON attachments(created_at DESC);

-- Add attachment count to topics and comments
ALTER TABLE topics ADD COLUMN attachment_count INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN attachment_count INTEGER DEFAULT 0;
