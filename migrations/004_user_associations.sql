-- Migration: 004_user_associations
-- Description: Add user_id to existing tables for full user integration
-- Created: 2025-10-29

ALTER TABLE topics ADD COLUMN user_id INTEGER;
ALTER TABLE comments ADD COLUMN user_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
