# ✅ Migration Checklist

Use this checklist to track your progress through the database migration.

## Pre-Migration
- [ ] Cloudflare Dashboard access confirmed
- [ ] Database name identified: ___________________
- [ ] Backup/snapshot created (optional but recommended)

## Migration Steps
- [ ] Opened Cloudflare Dashboard → Workers & Pages → D1
- [ ] Clicked on database name
- [ ] Opened Console tab
- [ ] Copied contents of `migrate-database.sql`
- [ ] Pasted into D1 Console
- [ ] Clicked Execute
- [ ] All commands ran successfully (or with acceptable "already exists" errors)

## Verification
- [ ] Ran: `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;`
- [ ] Confirmed `users` table exists
- [ ] Confirmed `page_comments` table exists
- [ ] Ran: `PRAGMA table_info(users);`
- [ ] Saw all user columns (id, username, email, password_hash, etc.)
- [ ] Ran: `PRAGMA table_info(page_comments);`
- [ ] Confirmed `user_id` column exists

## Testing
- [ ] Visited https://tylerstechti.ps/profile.html
- [ ] Registered a new test account
  - Username: ___________________
  - Email: ___________________
- [ ] Successfully logged in
- [ ] Saw profile page with my info
- [ ] Saw profile avatar/name in navbar
- [ ] Visited an article page
- [ ] Name field was pre-filled and disabled
- [ ] Posted a test comment
- [ ] Comment appeared with my display name
- [ ] Ran: `SELECT id, author, user_id FROM page_comments ORDER BY created_at DESC LIMIT 5;`
- [ ] My comment has a `user_id` value

## Post-Migration
- [ ] Cleared browser cache / hard refresh (Ctrl+Shift+R)
- [ ] Tested on different browser/incognito mode
- [ ] "Join Community" button visible when logged out
- [ ] Profile button visible when logged in
- [ ] Can edit profile (display name, bio, avatar URL)
- [ ] Can logout successfully
- [ ] Can login again

## Issues Encountered
Write any issues here:
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________

## Resolution
Write how you resolved them:
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________

---

**Migration Status:** ⬜ Not Started | 🟡 In Progress | ✅ Complete

**Date Started:** ___________________  
**Date Completed:** ___________________  
**Migrated By:** ___________________

**Notes:**
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________
