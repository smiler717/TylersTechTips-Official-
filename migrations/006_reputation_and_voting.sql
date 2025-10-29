-- Migration: 006_reputation_and_voting
-- Adds voting, reputation, and badge systems

-- Votes table for topics and comments
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('topic', 'comment')),
  target_id INTEGER NOT NULL,
  vote_type INTEGER NOT NULL CHECK(vote_type IN (-1, 1)), -- -1 downvote, 1 upvote
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, target_type, target_id) -- One vote per user per target
);

-- Indexes for vote queries
CREATE INDEX IF NOT EXISTS idx_votes_target ON votes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_created ON votes(created_at);

-- Add reputation and vote count columns to users table
ALTER TABLE users ADD COLUMN reputation INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN votes_received INTEGER DEFAULT 0;

-- Add vote count columns to topics
ALTER TABLE topics ADD COLUMN upvotes INTEGER DEFAULT 0;
ALTER TABLE topics ADD COLUMN downvotes INTEGER DEFAULT 0;
ALTER TABLE topics ADD COLUMN vote_score INTEGER DEFAULT 0;

-- Add vote count columns to comments
ALTER TABLE comments ADD COLUMN upvotes INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN downvotes INTEGER DEFAULT 0;
ALTER TABLE comments ADD COLUMN vote_score INTEGER DEFAULT 0;

-- Badges table
CREATE TABLE IF NOT EXISTS badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT, -- Font Awesome class or emoji
  tier TEXT DEFAULT 'bronze' CHECK(tier IN ('bronze', 'silver', 'gold', 'platinum')),
  criteria_type TEXT NOT NULL, -- reputation, topics, comments, votes_received, etc.
  criteria_value INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- User badges (many-to-many)
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
CREATE INDEX IF NOT EXISTS idx_user_badges_awarded ON user_badges(awarded_at);

-- Insert default badges
INSERT OR IGNORE INTO badges (name, description, icon, tier, criteria_type, criteria_value, created_at) VALUES
  ('First Post', 'Created your first topic', 'fa-pen', 'bronze', 'topics', 1, strftime('%s', 'now') * 1000),
  ('Commenter', 'Posted 10 comments', 'fa-comment', 'bronze', 'comments', 10, strftime('%s', 'now') * 1000),
  ('Active Contributor', 'Posted 50 comments', 'fa-comments', 'silver', 'comments', 50, strftime('%s', 'now') * 1000),
  ('Respected', 'Reached 100 reputation', 'fa-star', 'silver', 'reputation', 100, strftime('%s', 'now') * 1000),
  ('Highly Regarded', 'Reached 500 reputation', 'fa-award', 'gold', 'reputation', 500, strftime('%s', 'now') * 1000),
  ('Expert', 'Reached 1000 reputation', 'fa-trophy', 'platinum', 'reputation', 1000, strftime('%s', 'now') * 1000),
  ('Popular', 'Received 100 upvotes', 'fa-thumbs-up', 'silver', 'votes_received', 100, strftime('%s', 'now') * 1000),
  ('Community Favorite', 'Received 500 upvotes', 'fa-heart', 'gold', 'votes_received', 500, strftime('%s', 'now') * 1000),
  ('Veteran', 'Member for 1 year', 'fa-calendar', 'gold', 'account_age_days', 365, strftime('%s', 'now') * 1000);

-- Add indexes to improve voting performance
CREATE INDEX IF NOT EXISTS idx_topics_vote_score ON topics(vote_score DESC);
CREATE INDEX IF NOT EXISTS idx_comments_vote_score ON comments(vote_score DESC);
CREATE INDEX IF NOT EXISTS idx_users_reputation ON users(reputation DESC);
