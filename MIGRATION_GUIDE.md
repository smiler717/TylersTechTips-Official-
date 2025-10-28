# 🚀 Database Migration - Step by Step Guide

## Overview
This guide will walk you through updating your Cloudflare D1 database to support the new user authentication system.

**Time Required:** ~5 minutes  
**Difficulty:** Easy (Copy & Paste)

---

## 📋 Prerequisites
- Access to your Cloudflare Dashboard
- The database name for your Tyler's Tech Tips site

---

## 🎯 Step-by-Step Instructions

### Step 1: Open Cloudflare Dashboard
1. Go to https://dash.cloudflare.com
2. Login with your account
3. Navigate to **Workers & Pages** (left sidebar)

### Step 2: Access Your D1 Database
1. Click on **D1** in the Workers & Pages section
2. You should see your database listed (probably named something like `tylers-tech-db` or `TYLERS_TECH_DB`)
3. Click on your database name to open it

### Step 3: Open the SQL Console
1. Once in your database, click on the **Console** tab at the top
2. You should see a SQL query editor

### Step 4: Run the Migration Script

**Option A: Run All at Once (Recommended)**
1. Open the file `migrate-database.sql` in this folder
2. Copy the ENTIRE contents (Ctrl+A, then Ctrl+C)
3. Paste into the Cloudflare D1 Console
4. Click **Execute** or press Ctrl+Enter

**Option B: Run Commands One by One (Safer)**
Copy and run each section from `migrate-database.sql` individually:

1. **Create users table:**
```sql
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
```
Click Execute ✓

2. **Create indexes for users:**
```sql
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
```
Click Execute ✓

3. **Create page_comments table:**
```sql
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
```
Click Execute ✓

4. **Create indexes for page_comments:**
```sql
CREATE INDEX IF NOT EXISTS idx_page_comments_slug ON page_comments(slug);
CREATE INDEX IF NOT EXISTS idx_page_comments_created ON page_comments(created_at);
CREATE INDEX IF NOT EXISTS idx_page_comments_parent ON page_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_page_comments_user ON page_comments(user_id);
```
Click Execute ✓

5. **Add user_id to existing tables:**
```sql
ALTER TABLE topics ADD COLUMN user_id TEXT;
ALTER TABLE comments ADD COLUMN user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_topics_user ON topics(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
```
Click Execute ✓

> **Note:** If you see an error about "duplicate column name", that's okay! It means the column already exists.

---

## ✅ Verification

After running the migration, verify everything worked:

1. Run this query in the console:
```sql
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
```

You should see these tables:
- ✓ comments
- ✓ feedback
- ✓ page_comments
- ✓ topics
- ✓ users

2. Check the users table structure:
```sql
PRAGMA table_info(users);
```

You should see columns: id, username, email, password_hash, display_name, bio, avatar_url, created_at, last_login, is_verified

3. Check page_comments has user_id:
```sql
PRAGMA table_info(page_comments);
```

You should see a `user_id` column in the list.

---

## 🧪 Test the Authentication System

1. **Visit your profile page:**  
   https://tylerstechti.ps/profile.html

2. **Register a new account:**
   - Click the "Register" tab
   - Enter username, email, password
   - Click "Create Account"

3. **Login:**
   - Enter your username and password
   - Click "Login"
   - You should see your profile page

4. **Test commenting:**
   - Go to any article (like cpu-2025.html)
   - You should see your name pre-filled in the comment box
   - Post a test comment
   - The comment should show your display name

5. **Verify in database:**
```sql
SELECT id, author, user_id, body, created_at 
FROM page_comments 
ORDER BY created_at DESC 
LIMIT 5;
```

Your new comment should have a `user_id` that matches your user account!

---

## 🎉 Success!

You should now see:
- **Join Community** button in the navbar (when logged out)
- Your **profile avatar/name** in the navbar (when logged in)
- Comments automatically use your profile name
- Full user profile management at /profile.html

---

## 🆘 Troubleshooting

### "Column already exists" error
- **Solution:** This is okay! It means the migration was already partially run. Continue with the next commands.

### "No such table" error
- **Solution:** Make sure you're running the CREATE TABLE commands first, before the ALTER TABLE commands.

### Can't see the Join Community button
- **Solution:** Clear your browser cache or do a hard refresh (Ctrl+Shift+R)

### Login not working
- **Solution:** 
  1. Check browser console for errors (F12)
  2. Verify the `users` table was created
  3. Make sure your Cloudflare Pages deployment is complete

### Comments not linking to user_id
- **Solution:**
  1. Make sure you're logged in
  2. Check that the `page_comments` table has the `user_id` column
  3. Verify your auth token in localStorage (F12 → Application → Local Storage → look for `tt_auth_token`)

---

## 📞 Need Help?

If you encounter any issues:
1. Check the browser console (F12 → Console tab)
2. Check the Cloudflare D1 query results for error messages
3. Verify all tables were created successfully
4. Make sure your Cloudflare Pages deployment completed

---

## 🔄 Rollback (If Needed)

If something goes wrong and you need to revert:

```sql
-- WARNING: This will delete all user accounts and associations!
DROP TABLE IF EXISTS users;
ALTER TABLE topics DROP COLUMN user_id;  -- May not work on older SQLite
ALTER TABLE comments DROP COLUMN user_id;  -- May not work on older SQLite
```

Note: SQLite in some versions doesn't support DROP COLUMN. If that fails, you'll need to recreate the tables without the user_id column.

---

**Migration Complete! 🎊**

Your site now has a full user authentication system with profile management!
