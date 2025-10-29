-- STEP 1: Create schema_migrations table first
-- Run this query first, then proceed to Step 2

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at INTEGER NOT NULL
);
