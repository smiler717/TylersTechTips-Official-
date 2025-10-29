# Using Your Existing community_db Database

Perfect! You already have a D1 database set up. Here's how to upgrade it with all the advanced features.

## Quick Setup (5 minutes)

### Step 1: Run Complete Migration in D1 Console

1. In your Cloudflare Dashboard, go to **D1 Database** → **community_db** → **Console** tab
2. Open the file `RUN_IN_D1_CONSOLE.sql` (in this repo)
3. Copy the ENTIRE contents
4. Paste into the D1 Console query editor
5. Click **Execute**

This will add:
- ✅ User authentication system
- ✅ Voting and reputation
- ✅ Badges and leaderboard
- ✅ Moderation tools
- ✅ File attachments
- ✅ Notifications
- ✅ Bookmarks
- ✅ Audit logging

### Step 2: Bind Database to Pages Project

1. Go to **Pages** → Select your project → **Settings** → **Functions**
2. Scroll to **D1 database bindings**
3. Click **Add binding**:
   - **Variable name**: `DB`
   - **D1 database**: Select `community_db`
4. Click **Save**

### Step 3: Create KV Namespace (for tokens/cache)

1. Go to **Workers & Pages** → **KV**
2. Click **Create a namespace**
3. Name: `TYLERS_TECH_KV`
4. Click **Add**

### Step 4: Bind KV to Pages

1. Go to **Pages** → Your project → **Settings** → **Functions**
2. Scroll to **KV namespace bindings**
3. Click **Add binding**:
   - **Variable name**: `TYLERS_TECH_KV`
   - **KV namespace**: Select `TYLERS_TECH_KV`
4. Click **Save**

### Step 5: Set Admin Key

1. Go to **Pages** → Your project → **Settings** → **Environment variables**
2. Click **Add variable**
3. For **Production** environment:
   - Variable name: `ADMIN_KEY`
   - Value: `W2Cem=7o_IrPLRcA@k4Jpuw8DGi?#gsh`
4. Repeat for **Preview** environment
5. Click **Save**

### Step 6: Verify Migration

After running the SQL in Step 1, verify by running this query in D1 Console:

```sql
SELECT * FROM schema_migrations ORDER BY version;
```

You should see versions 2-8 listed.

## Optional: File Uploads (R2 Bucket)

If you want file attachment features:

1. Go to **R2** → **Create bucket** → Name: `tylers-tech-uploads`
2. Go to **Pages** → Settings → **Functions** → **R2 bucket bindings**
3. Add binding:
   - Variable name: `R2_BUCKET`
   - R2 bucket: `tylers-tech-uploads`

## What You Get

After completing these steps:

✅ **Community forum** with full database backend  
✅ **User accounts** with login/registration  
✅ **Voting system** on topics and comments  
✅ **Reputation & badges** for active users  
✅ **Leaderboard** showing top contributors  
✅ **Moderation tools** for spam/abuse  
✅ **Notifications** for replies and mentions  
✅ **Admin dashboard** at `/admin.html`  

## Files Updated

- `wrangler.toml` — Now references your `community_db` database
- `RUN_IN_D1_CONSOLE.sql` — Complete migration script ready to paste

## Next Steps

1. Run the migration SQL in D1 Console (Step 1)
2. Add the bindings in Pages settings (Steps 2-4)
3. Set the admin key (Step 5)
4. Redeploy your Pages project (automatic if GitHub connected)
5. Visit your site and test the features!

## Your Credentials

**Database**: `community_db` (already created ✓)  
**Admin Key**: `W2Cem=7o_IrPLRcA@k4Jpuw8DGi?#gsh`  
**Admin URL**: `https://[your-site].pages.dev/admin.html`

The migration script is idempotent (safe to run multiple times) and will skip any tables that already exist.
