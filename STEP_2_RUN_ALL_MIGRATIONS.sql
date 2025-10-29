-- STEP 2: Run complete migrations
-- Run this AFTER Step 1 completes successfully

-- ============================================
-- MIGRATION 002: Users and Authentication
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  last_login INTEGER,
  email_verified INTEGER DEFAULT 0,
  verification_token TEXT,
  verification_expires INTEGER,
  reputation INTEGER DEFAULT 0,
  votes_received INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (2, '002_users_and_auth', strftime('%s', 'now') * 1000);

-- ============================================
-- MIGRATION 003: Page Comments
-- ============================================
CREATE TABLE IF NOT EXISTS page_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_slug TEXT NOT NULL,
  user_id INTEGER,
  author_name TEXT,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_page_comments_slug ON page_comments(page_slug);
CREATE INDEX IF NOT EXISTS idx_page_comments_created ON page_comments(created_at DESC);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (3, '003_page_comments', strftime('%s', 'now') * 1000);

-- ============================================
-- MIGRATION 004: User Associations
-- Note: These might fail if columns already exist - that's OK
-- ============================================
ALTER TABLE topics ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE comments ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (4, '004_user_associations', strftime('%s', 'now') * 1000);

-- ============================================
-- MIGRATION 005: Advanced Features
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  topic_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE,
  UNIQUE(user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_topic ON bookmarks(topic_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

ALTER TABLE topics ADD COLUMN views INTEGER DEFAULT 0;
ALTER TABLE topics ADD COLUMN pinned INTEGER DEFAULT 0;

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (5, '005_advanced_features', strftime('%s', 'now') * 1000);

-- ============================================
-- MIGRATION 006: Reputation and Voting
-- ============================================
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('topic', 'comment')),
  target_id TEXT NOT NULL,
  vote_type INTEGER NOT NULL CHECK(vote_type IN (-1, 1)),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_created ON votes(created_at);

ALTER TABLE topics ADD COLUMN upvotes INTEGER DEFAULT 0;
ALTER TABLE topics ADD COLUMN downvotes INTEGER DEFAULT 0;
ALTER TABLE topics ADD COLUMN vote_score INTEGER DEFAULT 0;

ALTER TABLE comments ADD COLUMN upvotes INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN downvotes INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN vote_score INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  tier TEXT DEFAULT 'bronze' CHECK(tier IN ('bronze', 'silver', 'gold', 'platinum')),
  criteria_type TEXT NOT NULL,
  criteria_value INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  badge_id INTEGER NOT NULL,
  awarded_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);

INSERT OR IGNORE INTO badges (name, description, icon, tier, criteria_type, criteria_value, created_at)
VALUES 
  ('First Post', 'Created your first topic', 'fa-star', 'bronze', 'topics_created', 1, strftime('%s', 'now') * 1000),
  ('Contributor', 'Posted 10 topics', 'fa-comment', 'silver', 'topics_created', 10, strftime('%s', 'now') * 1000),
  ('Regular', 'Posted 50 topics', 'fa-fire', 'gold', 'topics_created', 50, strftime('%s', 'now') * 1000),
  ('Respected', 'Reached 100 reputation', 'fa-trophy', 'silver', 'reputation', 100, strftime('%s', 'now') * 1000),
  ('Influencer', 'Reached 500 reputation', 'fa-crown', 'gold', 'reputation', 500, strftime('%s', 'now') * 1000),
  ('Legend', 'Reached 1000 reputation', 'fa-gem', 'platinum', 'reputation', 1000, strftime('%s', 'now') * 1000);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (6, '006_reputation_and_voting', strftime('%s', 'now') * 1000);

-- ============================================
-- MIGRATION 007: Moderation System
-- ============================================
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

CREATE TABLE IF NOT EXISTS moderation_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK(target_type IN ('topic', 'comment', 'user')),
  target_id TEXT NOT NULL,
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

ALTER TABLE topics ADD COLUMN moderation_status TEXT DEFAULT 'approved' CHECK(moderation_status IN ('approved', 'pending', 'flagged', 'removed'));
ALTER TABLE comments ADD COLUMN moderation_status TEXT DEFAULT 'approved' CHECK(moderation_status IN ('approved', 'pending', 'flagged', 'removed'));

CREATE TABLE IF NOT EXISTS user_moderation_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  action_type TEXT NOT NULL CHECK(action_type IN ('warning', 'mute', 'ban', 'unban')),
  reason TEXT,
  duration INTEGER,
  expires_at INTEGER,
  moderator_id INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (moderator_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_user_mod_actions_user ON user_moderation_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_mod_actions_active ON user_moderation_actions(expires_at);

INSERT OR IGNORE INTO moderation_keywords (keyword, action, active, created_at)
VALUES 
  ('spam', 'flag', 1, strftime('%s', 'now') * 1000),
  ('viagra', 'block', 1, strftime('%s', 'now') * 1000),
  ('casino', 'block', 1, strftime('%s', 'now') * 1000);

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (7, '007_moderation_system', strftime('%s', 'now') * 1000);

-- ============================================
-- MIGRATION 008: File Attachments
-- ============================================
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  image_id TEXT,
  uploader_id INTEGER NOT NULL,
  target_type TEXT CHECK(target_type IN ('topic', 'comment', 'user_avatar')),
  target_id TEXT,
  width INTEGER,
  height INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attachments_target ON attachments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploader ON attachments(uploader_id);
CREATE INDEX IF NOT EXISTS idx_attachments_created ON attachments(created_at DESC);

ALTER TABLE topics ADD COLUMN attachment_count INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN attachment_count INTEGER DEFAULT 0;

INSERT OR IGNORE INTO schema_migrations (version, name, applied_at)
VALUES (8, '008_file_attachments', strftime('%s', 'now') * 1000);
