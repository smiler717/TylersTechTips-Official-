-- Migration: 007_moderation_system
-- Adds moderation tables and features

-- Moderation keywords table
CREATE TABLE IF NOT EXISTS moderation_keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT NOT NULL UNIQUE,
  action TEXT NOT NULL CHECK(action IN ('block', 'flag', 'allow')),
  active INTEGER DEFAULT 1,
  added_by INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (added_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_moderation_keywords_active ON moderation_keywords(active);

-- Moderation reports table
CREATE TABLE IF NOT EXISTS moderation_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK(target_type IN ('topic', 'comment', 'user')),
  target_id INTEGER NOT NULL,
  reporter_id INTEGER,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'resolved')),
  auto_flagged INTEGER DEFAULT 0,
  reviewed_by INTEGER,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_moderation_reports_status ON moderation_reports(status);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_target ON moderation_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_created ON moderation_reports(created_at DESC);

-- Add moderation status to topics and comments
ALTER TABLE topics ADD COLUMN moderation_status TEXT DEFAULT 'approved' CHECK(moderation_status IN ('approved', 'pending', 'flagged', 'removed'));
ALTER TABLE comments ADD COLUMN moderation_status TEXT DEFAULT 'approved' CHECK(moderation_status IN ('approved', 'pending', 'flagged', 'removed'));

-- User moderation actions (bans, warnings, etc.)
CREATE TABLE IF NOT EXISTS user_moderation_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action_type TEXT NOT NULL CHECK(action_type IN ('warning', 'mute', 'ban', 'unban')),
  reason TEXT,
  duration INTEGER, -- Duration in milliseconds, NULL for permanent
  expires_at INTEGER,
  moderator_id INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (moderator_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_moderation_user ON user_moderation_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_moderation_expires ON user_moderation_actions(expires_at);

-- Add banned status to users
ALTER TABLE users ADD COLUMN banned INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN ban_expires INTEGER;

-- Insert some default banned keywords
INSERT OR IGNORE INTO moderation_keywords (keyword, action, active, created_at) VALUES
  ('viagra', 'block', 1, strftime('%s', 'now') * 1000),
  ('casino', 'block', 1, strftime('%s', 'now') * 1000),
  ('click here', 'flag', 1, strftime('%s', 'now') * 1000);
