/**
 * Database Migration System
 * POST /api/admin/migrate
 * Requires admin authentication
 */

import { json, error, isAdmin } from '../_utils.js';

const MIGRATIONS = [
  { version: 1, name: '001_initial_schema', file: '001_initial_schema.sql' },
  { version: 2, name: '002_users_and_auth', file: '002_users_and_auth.sql' },
  { version: 3, name: '003_page_comments', file: '003_page_comments.sql' },
  { version: 4, name: '004_user_associations', file: '004_user_associations.sql' },
  { version: 5, name: '005_advanced_features', file: '005_advanced_features.sql' },
];

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key, Authorization',
    'Access-Control-Max-Age': '86400'
  }});
}

export async function onRequestPost({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  // Require admin
  const admin = await isAdmin(request, env);
  if (!admin) return error(403, 'Admin access required');

  try {
    // Ensure schema_migrations table exists
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )
    `).run();

    // Get current schema version
    const appliedMigrations = await DB.prepare(
      'SELECT version FROM schema_migrations ORDER BY version'
    ).all();
    
    const appliedVersions = new Set((appliedMigrations.results || []).map(r => r.version));
    const pending = MIGRATIONS.filter(m => !appliedVersions.has(m.version));

    if (pending.length === 0) {
      return json({ success: true, message: 'All migrations already applied', current: Math.max(...appliedVersions, 0) });
    }

    const results = [];
    for (const migration of pending) {
      try {
        // Fetch migration SQL from embedded content
        const sql = await getMigrationSQL(migration.file);
        
        // Execute migration
        await DB.exec(sql);
        
        // Record migration
        await DB.prepare(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
        ).bind(migration.version, migration.name, Date.now()).run();

        results.push({ version: migration.version, name: migration.name, status: 'success' });
      } catch (e) {
        results.push({ version: migration.version, name: migration.name, status: 'failed', error: e.message });
        // Stop on first failure
        return json({ 
          success: false, 
          message: `Migration ${migration.version} failed`,
          error: e.message,
          results 
        }, { status: 500 });
      }
    }

    return json({ 
      success: true, 
      message: `Applied ${results.length} migration(s)`,
      results 
    });

  } catch (e) {
    console.error('Migration error:', e);
    return error(500, 'Migration failed: ' + e.message);
  }
}

export async function onRequestGet({ request, env }) {
  const DB = env.DB || env.TYLERS_TECH_DB;
  if (!DB) return error(500, 'Database not configured');

  const admin = await isAdmin(request, env);
  if (!admin) return error(403, 'Admin access required');

  try {
    // Ensure table exists
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )
    `).run();

    const applied = await DB.prepare(
      'SELECT version, name, applied_at FROM schema_migrations ORDER BY version'
    ).all();

    const appliedVersions = new Set((applied.results || []).map(r => r.version));
    const pending = MIGRATIONS.filter(m => !appliedVersions.has(m.version));

    return json({
      applied: applied.results || [],
      pending: pending.map(m => ({ version: m.version, name: m.name })),
      current: applied.results?.length ? Math.max(...appliedVersions) : 0,
      latest: MIGRATIONS[MIGRATIONS.length - 1].version
    });
  } catch (e) {
    console.error('Migration status error:', e);
    return error(500, 'Failed to get migration status');
  }
}

// Helper to get migration SQL
// In production, you'd fetch from R2 or embed them
async function getMigrationSQL(filename) {
  // For now, return inline SQL based on filename
  // In a real system, fetch from R2 or embed during build
  const migrations = {
    '001_initial_schema.sql': `
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
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);`,
    '002_users_and_auth.sql': `
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
  verification_expires INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);`,
    '003_page_comments.sql': `
CREATE TABLE IF NOT EXISTS page_comments (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  author TEXT,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT,
  parent_id TEXT,
  user_id INTEGER,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_page_comments_slug ON page_comments(slug);
CREATE INDEX IF NOT EXISTS idx_page_comments_created ON page_comments(created_at);
CREATE INDEX IF NOT EXISTS idx_page_comments_parent ON page_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_page_comments_user ON page_comments(user_id);`,
    '004_user_associations.sql': `
ALTER TABLE topics ADD COLUMN user_id INTEGER;
ALTER TABLE comments ADD COLUMN user_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);`,
    '005_advanced_features.sql': `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  topic_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(user_id, topic_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_topic ON bookmarks(topic_id);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
CREATE TABLE IF NOT EXISTS user_stats (
  user_id INTEGER PRIMARY KEY,
  reputation INTEGER DEFAULT 0,
  topics_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  upvotes_received INTEGER DEFAULT 0,
  downvotes_received INTEGER DEFAULT 0,
  badges TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_by INTEGER,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(reporter_id) REFERENCES users(id),
  FOREIGN KEY(reviewed_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_resource ON reports(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at);
CREATE VIRTUAL TABLE IF NOT EXISTS topics_fts USING fts5(
  id UNINDEXED,
  title,
  body,
  author,
  category,
  content=topics,
  content_rowid=rowid
);
CREATE TRIGGER IF NOT EXISTS topics_fts_insert AFTER INSERT ON topics BEGIN
  INSERT INTO topics_fts(rowid, id, title, body, author, category)
  VALUES (new.rowid, new.id, new.title, new.body, new.author, new.category);
END;
CREATE TRIGGER IF NOT EXISTS topics_fts_delete AFTER DELETE ON topics BEGIN
  DELETE FROM topics_fts WHERE rowid = old.rowid;
END;
CREATE TRIGGER IF NOT EXISTS topics_fts_update AFTER UPDATE ON topics BEGIN
  UPDATE topics_fts SET title = new.title, body = new.body, author = new.author, category = new.category
  WHERE rowid = new.rowid;
END;
CREATE TABLE IF NOT EXISTS user_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);`
  };

  return migrations[filename] || '';
}
