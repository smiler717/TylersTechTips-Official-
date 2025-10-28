-- D1 schema for Tyler's Tech Tips Community
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author TEXT,
  category TEXT DEFAULT 'General',
  created_at INTEGER NOT NULL,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  author TEXT,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  device_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_comments_topic ON comments(topic_id);
CREATE INDEX IF NOT EXISTS idx_topics_created ON topics(created_at);
CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
-- Users table for authentication and profiles
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  last_login INTEGER,
  is_verified INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);

-- Page comments table (per-article comments with threading)
CREATE TABLE IF NOT EXISTS page_comments (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  author TEXT,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  parent_id TEXT,
  user_id TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_page_comments_slug ON page_comments(slug);
CREATE INDEX IF NOT EXISTS idx_page_comments_created ON page_comments(created_at);
CREATE INDEX IF NOT EXISTS idx_page_comments_parent ON page_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_page_comments_user ON page_comments(user_id);

-- Add user_id to existing tables for full user integration
-- Note: Run these ALTER statements on your D1 database via Cloudflare Dashboard or Wrangler
-- ALTER TABLE topics ADD COLUMN user_id TEXT;
-- ALTER TABLE comments ADD COLUMN user_id TEXT;
-- CREATE INDEX idx_topics_user ON topics(user_id);
-- CREATE INDEX idx_comments_user ON comments(user_id);
