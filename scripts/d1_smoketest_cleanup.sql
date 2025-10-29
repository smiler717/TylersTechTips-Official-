-- Cloudflare D1 Smoke Test Cleanup
-- Removes the vote, bookmark, notification, comment, topic, and the SmokeBot user.
-- Run only if you want to clear the test data.
-- NOTE: D1 Studio blocks explicit SQL transactions (BEGIN/COMMIT). Run as-is without them.

-- Delete votes first (FK-safety)
DELETE FROM votes
WHERE target_type='topic'
  AND target_id=(SELECT id FROM topics WHERE title='Smoke Test Topic');

-- Delete bookmarks
DELETE FROM bookmarks
WHERE user_id=(SELECT id FROM users WHERE username='SmokeBot')
  AND target_type='topic'
  AND target_id=(SELECT id FROM topics WHERE title='Smoke Test Topic');

-- Delete notifications
DELETE FROM notifications
WHERE user_id=(SELECT id FROM users WHERE username='SmokeBot')
  AND target_type='topic'
  AND target_id=(SELECT id FROM topics WHERE title='Smoke Test Topic');

-- Delete comments
DELETE FROM comments
WHERE topic_id=(SELECT id FROM topics WHERE title='Smoke Test Topic');

-- Delete the topic
DELETE FROM topics
WHERE title='Smoke Test Topic';

-- Delete the user last (only if it has no other content you want to keep)
DELETE FROM users
WHERE username='SmokeBot';
