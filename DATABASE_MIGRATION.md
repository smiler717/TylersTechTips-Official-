# Database Migration Guide

After deploying the new authentication system, you'll need to update your Cloudflare D1 database with the new schema.

## Method 1: Via Cloudflare Dashboard (Recommended)

1. Go to your Cloudflare Dashboard
2. Navigate to **Workers & Pages** → **D1**
3. Select your database
4. Click on **Console** tab
5. Run these SQL commands one at a time:

```sql
-- Create users table
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

-- Create page_comments table (if not exists)
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

-- Add user_id to existing tables (only if columns don't exist)
ALTER TABLE topics ADD COLUMN user_id TEXT;
ALTER TABLE comments ADD COLUMN user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
```

## Method 2: Via Wrangler CLI

If you have Wrangler installed:

```bash
# Execute the full schema
wrangler d1 execute YOUR_DATABASE_NAME --file=schema.sql --remote

# Or execute individual commands
wrangler d1 execute YOUR_DATABASE_NAME --remote --command="CREATE TABLE IF NOT EXISTS users (...)"
```

## Method 3: Let the App Handle It

The backend code includes automatic schema migration for `page_comments` table. For the `users` table, it will be created on first registration attempt if it doesn't exist.

However, to add `user_id` to existing `topics` and `comments` tables, you'll need to run those ALTER statements manually.

## Verification

After migration, verify the tables exist:

```sql
-- List all tables
SELECT name FROM sqlite_master WHERE type='table';

-- Check users table structure
PRAGMA table_info(users);

-- Check page_comments table structure
PRAGMA table_info(page_comments);

-- Check topics has user_id
PRAGMA table_info(topics);

-- Check comments has user_id
PRAGMA table_info(comments);
```

## Notes

- The `user_id` column will be `NULL` for existing comments/topics created before authentication
- New comments/topics from logged-in users will have their `user_id` populated
- The `author` field is still kept for backward compatibility and display purposes
- Foreign key constraints are informational in SQLite by default (not enforced unless enabled)

## Rollback (if needed)

If you need to rollback:

```sql
DROP TABLE IF EXISTS users;
ALTER TABLE topics DROP COLUMN user_id;  -- Note: SQLite may not support DROP COLUMN in older versions
ALTER TABLE comments DROP COLUMN user_id;
-- For older SQLite: You'll need to recreate the table without user_id
```

## Testing

1. Visit your site's `/profile.html` page
2. Register a new account
3. Login
4. Post a comment on an article
5. Check the database to verify the comment has a `user_id`

```sql
SELECT id, author, user_id, body FROM page_comments LIMIT 5;
```
