-- Creates/verifies a test user/topic/comment, adds an upvote, bookmark, notification,
-- and recalculates topic vote counters. Safe to run multiple times.
-- NOTE: D1 Studio blocks explicit SQL transactions (BEGIN/COMMIT). Run as-is without them.

-- 1) Ensure test user exists
INSERT INTO users (username, email, created_at)
SELECT 'SmokeBot', 'smokebot@example.invalid', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'SmokeBot');

-- 2) Ensure test topic exists
INSERT INTO topics (
  title, content, category, user_id,
  upvotes, downvotes, vote_score, views, pinned, moderation_status, attachment_count,
  created_at
)
SELECT 'Smoke Test Topic',
       'This is a DB smoke test topic.',
       'General',
       (SELECT id FROM users WHERE username='SmokeBot'),
       COALESCE((SELECT upvotes FROM topics WHERE title='Smoke Test Topic'), 0),
       COALESCE((SELECT downvotes FROM topics WHERE title='Smoke Test Topic'), 0),
       COALESCE((SELECT vote_score FROM topics WHERE title='Smoke Test Topic'), 0),
       COALESCE((SELECT views FROM topics WHERE title='Smoke Test Topic'), 0),
       0,
       'visible',
       0,
       CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM topics WHERE title='Smoke Test Topic');

-- 3) Ensure first comment exists
INSERT INTO comments (topic_id, user_id, content, created_at)
SELECT (SELECT id FROM topics WHERE title='Smoke Test Topic'),
       (SELECT id FROM users WHERE username='SmokeBot'),
       'First comment!',
       CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM comments
  WHERE topic_id = (SELECT id FROM topics WHERE title='Smoke Test Topic')
    AND user_id = (SELECT id FROM users WHERE username='SmokeBot')
    AND content = 'First comment!'
);

-- 4) Ensure one upvote exists
INSERT INTO votes (user_id, target_type, target_id, is_upvote, created_at)
SELECT (SELECT id FROM users WHERE username='SmokeBot'),
       'topic',
       (SELECT id FROM topics WHERE title='Smoke Test Topic'),
       1,
       CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM votes
  WHERE user_id = (SELECT id FROM users WHERE username='SmokeBot')
    AND target_type = 'topic'
    AND target_id = (SELECT id FROM topics WHERE title='Smoke Test Topic')
);

-- 5) Ensure a bookmark exists
INSERT INTO bookmarks (user_id, target_type, target_id, created_at)
SELECT (SELECT id FROM users WHERE username='SmokeBot'),
       'topic',
       (SELECT id FROM topics WHERE title='Smoke Test Topic'),
       CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM bookmarks
  WHERE user_id = (SELECT id FROM users WHERE username='SmokeBot')
    AND target_type = 'topic'
    AND target_id = (SELECT id FROM topics WHERE title='Smoke Test Topic')
);

-- 6) Ensure a notification exists (for the comment)
-- Using generic target_type/target_id columns (no topic_id column)
INSERT INTO notifications (user_id, target_type, target_id, type, message, created_at)
SELECT (SELECT id FROM users WHERE username='SmokeBot'),
       'topic',
       (SELECT id FROM topics WHERE title='Smoke Test Topic'),
       'comment',
       'First comment!',
       CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM notifications
  WHERE user_id = (SELECT id FROM users WHERE username='SmokeBot')
    AND target_type='topic'
    AND target_id=(SELECT id FROM topics WHERE title='Smoke Test Topic')
    AND type = 'comment'
);

-- 7) Recalculate vote counters on the topic
UPDATE topics
SET upvotes = COALESCE((SELECT COUNT(*) FROM votes WHERE target_type='topic' AND target_id = topics.id AND is_upvote=1), 0),
    downvotes = COALESCE((SELECT COUNT(*) FROM votes WHERE target_type='topic' AND target_id = topics.id AND is_upvote=0), 0),
    vote_score = COALESCE((SELECT COUNT(*) FROM votes WHERE target_type='topic' AND target_id = topics.id AND is_upvote=1), 0)
              - COALESCE((SELECT COUNT(*) FROM votes WHERE target_type='topic' AND target_id = topics.id AND is_upvote=0), 0)
WHERE id = (SELECT id FROM topics WHERE title='Smoke Test Topic');

-- Verification
SELECT id, title, upvotes, downvotes, vote_score, /* comment_count, */ views
FROM topics WHERE title='Smoke Test Topic';

SELECT COUNT(*) AS bookmark_count
FROM bookmarks
WHERE user_id=(SELECT id FROM users WHERE username='SmokeBot')
  AND target_type='topic'
  AND target_id=(SELECT id FROM topics WHERE title='Smoke Test Topic');

SELECT COUNT(*) AS notifications_count
FROM notifications
WHERE user_id=(SELECT id FROM users WHERE username='SmokeBot');
