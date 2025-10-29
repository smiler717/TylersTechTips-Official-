/**
 * Reputation and Voting Helpers
 */

/**
 * Cast or change a vote
 * @param {object} db - D1 database instance
 * @param {number} userId - User ID casting the vote
 * @param {string} targetType - 'topic' or 'comment'
 * @param {number} targetId - Target ID
 * @param {number} voteType - 1 for upvote, -1 for downvote
 * @returns {Promise<object>} - Result with success, action, and updated counts
 */
export async function castVote(db, userId, targetType, targetId, voteType) {
  if (!['topic', 'comment'].includes(targetType)) {
    throw new Error('Invalid target type');
  }
  if (![1, -1].includes(voteType)) {
    throw new Error('Invalid vote type');
  }

  const now = Date.now();

  // Check if user already voted
  const existing = await db.prepare(`
    SELECT vote_type FROM votes
    WHERE user_id = ? AND target_type = ? AND target_id = ?
  `).bind(userId, targetType, targetId).first();

  let action = 'created';
  let oldVote = 0;

  if (existing) {
    if (existing.vote_type === voteType) {
      // Same vote - remove it (toggle off)
      await db.prepare(`
        DELETE FROM votes
        WHERE user_id = ? AND target_type = ? AND target_id = ?
      `).bind(userId, targetType, targetId).run();
      action = 'removed';
      oldVote = voteType;
      voteType = 0; // No vote now
    } else {
      // Different vote - update it
      await db.prepare(`
        UPDATE votes SET vote_type = ?, created_at = ?
        WHERE user_id = ? AND target_type = ? AND target_id = ?
      `).bind(voteType, now, userId, targetType, targetId).run();
      action = 'changed';
      oldVote = existing.vote_type;
    }
  } else {
    // New vote
    await db.prepare(`
      INSERT INTO votes (user_id, target_type, target_id, vote_type, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(userId, targetType, targetId, voteType, now).run();
    action = 'created';
  }

  // Update vote counts on target
  await updateVoteCounts(db, targetType, targetId);

  // Update author's reputation
  const table = targetType === 'topic' ? 'topics' : 'comments';
  const author = await db.prepare(`SELECT author_id FROM ${table} WHERE id = ?`)
    .bind(targetId).first();
  
  if (author && author.author_id !== userId) { // Don't count self-votes
    await updateUserReputation(db, author.author_id);
  }

  return { success: true, action, voteType };
}

/**
 * Update vote counts for a target
 */
async function updateVoteCounts(db, targetType, targetId) {
  const table = targetType === 'topic' ? 'topics' : 'comments';

  // Count upvotes and downvotes
  const counts = await db.prepare(`
    SELECT
      COUNT(CASE WHEN vote_type = 1 THEN 1 END) as upvotes,
      COUNT(CASE WHEN vote_type = -1 THEN 1 END) as downvotes
    FROM votes
    WHERE target_type = ? AND target_id = ?
  `).bind(targetType, targetId).first();

  const upvotes = counts?.upvotes || 0;
  const downvotes = counts?.downvotes || 0;
  const voteScore = upvotes - downvotes;

  await db.prepare(`
    UPDATE ${table}
    SET upvotes = ?, downvotes = ?, vote_score = ?
    WHERE id = ?
  `).bind(upvotes, downvotes, voteScore, targetId).run();

  return { upvotes, downvotes, voteScore };
}

/**
 * Get user's vote on a target
 */
export async function getUserVote(db, userId, targetType, targetId) {
  if (!userId) return null;

  const vote = await db.prepare(`
    SELECT vote_type FROM votes
    WHERE user_id = ? AND target_type = ? AND target_id = ?
  `).bind(userId, targetType, targetId).first();

  return vote?.vote_type || 0;
}

/**
 * Update user's reputation based on all their content
 */
export async function updateUserReputation(db, userId) {
  // Calculate reputation:
  // - Each upvote on topic: +10 points
  // - Each downvote on topic: -2 points
  // - Each upvote on comment: +5 points
  // - Each downvote on comment: -1 point

  const topicVotes = await db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN v.vote_type = 1 THEN 10 ELSE 0 END), 0) as upvote_points,
      COALESCE(SUM(CASE WHEN v.vote_type = -1 THEN 2 ELSE 0 END), 0) as downvote_points
    FROM votes v
    JOIN topics t ON v.target_id = t.id AND v.target_type = 'topic'
    WHERE t.author_id = ? AND v.user_id != ?
  `).bind(userId, userId).first();

  const commentVotes = await db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN v.vote_type = 1 THEN 5 ELSE 0 END), 0) as upvote_points,
      COALESCE(SUM(CASE WHEN v.vote_type = -1 THEN 1 ELSE 0 END), 0) as downvote_points
    FROM votes v
    JOIN comments c ON v.target_id = c.id AND v.target_type = 'comment'
    WHERE c.author_id = ? AND v.user_id != ?
  `).bind(userId, userId).first();

  const topicUp = topicVotes?.upvote_points || 0;
  const topicDown = topicVotes?.downvote_points || 0;
  const commentUp = commentVotes?.upvote_points || 0;
  const commentDown = commentVotes?.downvote_points || 0;

  const reputation = Math.max(0, topicUp - topicDown + commentUp - commentDown);

  // Count total upvotes received
  const votesReceived = await db.prepare(`
    SELECT COUNT(*) as count FROM votes v
    WHERE v.vote_type = 1 AND v.target_type = 'topic' AND v.target_id IN (
      SELECT id FROM topics WHERE author_id = ?
    )
    UNION ALL
    SELECT COUNT(*) FROM votes v
    WHERE v.vote_type = 1 AND v.target_type = 'comment' AND v.target_id IN (
      SELECT id FROM comments WHERE author_id = ?
    )
  `).bind(userId, userId).all();

  const totalVotes = votesReceived.results.reduce((sum, r) => sum + (r.count || 0), 0);

  await db.prepare(`
    UPDATE users
    SET reputation = ?, votes_received = ?
    WHERE id = ?
  `).bind(reputation, totalVotes, userId).run();

  // Check and award badges
  await checkAndAwardBadges(db, userId);

  return { reputation, votesReceived: totalVotes };
}

/**
 * Check and award badges to user based on achievements
 */
export async function checkAndAwardBadges(db, userId) {
  // Get user stats
  const user = await db.prepare(`
    SELECT
      reputation,
      votes_received,
      (SELECT COUNT(*) FROM topics WHERE author_id = ?) as topic_count,
      (SELECT COUNT(*) FROM comments WHERE author_id = ?) as comment_count,
      created_at
    FROM users WHERE id = ?
  `).bind(userId, userId, userId).first();

  if (!user) return;

  const accountAgeDays = Math.floor((Date.now() - user.created_at) / (24 * 60 * 60 * 1000));

  // Get all badges the user doesn't have yet
  const availableBadges = await db.prepare(`
    SELECT b.* FROM badges b
    WHERE b.id NOT IN (
      SELECT badge_id FROM user_badges WHERE user_id = ?
    )
  `).bind(userId).all();

  const now = Date.now();
  const awarded = [];

  for (const badge of availableBadges.results) {
    let qualifies = false;

    switch (badge.criteria_type) {
      case 'reputation':
        qualifies = user.reputation >= badge.criteria_value;
        break;
      case 'topics':
        qualifies = user.topic_count >= badge.criteria_value;
        break;
      case 'comments':
        qualifies = user.comment_count >= badge.criteria_value;
        break;
      case 'votes_received':
        qualifies = user.votes_received >= badge.criteria_value;
        break;
      case 'account_age_days':
        qualifies = accountAgeDays >= badge.criteria_value;
        break;
    }

    if (qualifies) {
      await db.prepare(`
        INSERT OR IGNORE INTO user_badges (user_id, badge_id, awarded_at)
        VALUES (?, ?, ?)
      `).bind(userId, badge.id, now).run();
      awarded.push(badge);
    }
  }

  return awarded;
}

/**
 * Get leaderboard users
 */
export async function getLeaderboard(db, limit = 50, offset = 0) {
  const users = await db.prepare(`
    SELECT
      u.id,
      u.username,
      u.display_name,
      u.avatar_url,
      u.reputation,
      u.votes_received,
      (SELECT COUNT(*) FROM topics WHERE author_id = u.id) as topic_count,
      (SELECT COUNT(*) FROM comments WHERE author_id = u.id) as comment_count,
      (SELECT COUNT(*) FROM user_badges WHERE user_id = u.id) as badge_count
    FROM users u
    WHERE u.reputation > 0
    ORDER BY u.reputation DESC, u.votes_received DESC
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  return users.results || [];
}

/**
 * Get user's badges
 */
export async function getUserBadges(db, userId) {
  const badges = await db.prepare(`
    SELECT b.*, ub.awarded_at
    FROM badges b
    JOIN user_badges ub ON b.id = ub.badge_id
    WHERE ub.user_id = ?
    ORDER BY ub.awarded_at DESC
  `).bind(userId).all();

  return badges.results || [];
}
