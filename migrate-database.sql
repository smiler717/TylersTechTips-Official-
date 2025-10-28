-- =============================================================================
-- Tyler's Tech Tips - Database Migration for User Authentication
-- =============================================================================
-- Run these commands in your Cloudflare D1 Console
-- Dashboard → Workers & Pages → D1 → [Your Database] → Console
-- =============================================================================

-- Step 1: Create the users table
-- This stores user accounts with authentication and profile info
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

-- Step 2: Create indexes for users table (improves query performance)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);

-- Step 3: Create page_comments table with user_id support
-- This table stores comments on articles with threading and user association
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

-- Step 4: Create indexes for page_comments table
CREATE INDEX IF NOT EXISTS idx_page_comments_slug ON page_comments(slug);
CREATE INDEX IF NOT EXISTS idx_page_comments_created ON page_comments(created_at);
CREATE INDEX IF NOT EXISTS idx_page_comments_parent ON page_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_page_comments_user ON page_comments(user_id);

-- Step 5: Add user_id to existing topics table
-- Note: This will fail silently if the column already exists
ALTER TABLE topics ADD COLUMN user_id TEXT;

-- Step 6: Add user_id to existing comments table
-- Note: This will fail silently if the column already exists
ALTER TABLE comments ADD COLUMN user_id TEXT;

-- Step 7: Create indexes for the new user_id columns
CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

-- =============================================================================
-- Verification Queries (run these to confirm migration worked)
-- =============================================================================

-- Check all tables exist
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;

-- Verify users table structure
PRAGMA table_info(users);

-- Verify page_comments table structure
PRAGMA table_info(page_comments);

-- Verify topics has user_id column
PRAGMA table_info(topics);

-- Verify comments has user_id column
PRAGMA table_info(comments);

-- =============================================================================
-- MIGRATION COMPLETE!
-- =============================================================================
-- Next steps:
-- 1. Visit your site at https://tylerstechti.ps/profile.html
-- 2. Register a new account
-- 3. Login and try posting a comment
-- 4. Verify the comment has a user_id by running:
--    SELECT id, author, user_id, body FROM page_comments ORDER BY created_at DESC LIMIT 5;
-- =============================================================================
