# Next Steps (Windows PowerShell)

This is your fast path to get the site running locally, wire up search, and deploy to Cloudflare Pages with the database and real-time features enabled.

## 1) Local quick run (static)

- Regenerate any article page from JSON and rebuild the search index:

```powershell
# From repo root
python .\generate_page.py .\examples\ssd.json
python .\scripts\build_search_index.py
```

- Optional: preview locally with a simple static server:

```powershell
# Python 3 built-in server
python -m http.server 8788
# Visit http://localhost:8788
```

## 2) Cloudflare setup (one-time)

```powershell
# Install Wrangler CLI (requires Node.js)
npm i -g wrangler

# Log in to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create tylers-tech-tips-db

# Create KV namespace (general purpose)
wrangler kv:namespace create "TYLERS_TECH_KV"

# Create R2 bucket for uploads (optional)
wrangler r2 bucket create tylers-tech-uploads
```

- Open `wrangler.toml` and replace placeholder IDs:
  - Set `database_id` under `[[d1_databases]]`
  - Set `id` under `[[kv_namespaces]]`
  - Confirm `[[r2_buckets]]` bucket_name matches

## 3) Run database migrations

You can run from the command line or via the admin page later. Command line:

```powershell
wrangler d1 execute tylers-tech-tips-db --file=./migrations/001_initial_schema.sql
wrangler d1 execute tylers-tech-tips-db --file=./migrations/002_add_timestamps.sql
wrangler d1 execute tylers-tech-tips-db --file=./migrations/003_add_auth.sql
wrangler d1 execute tylers-tech-tips-db --file=./migrations/004_add_notifications.sql
wrangler d1 execute tylers-tech-tips-db --file=./migrations/005_add_bookmarks.sql
wrangler d1 execute tylers-tech-tips-db --file=./migrations/006_reputation_and_voting.sql
wrangler d1 execute tylers-tech-tips-db --file=./migrations/007_moderation_system.sql
wrangler d1 execute tylers-tech-tips-db --file=./migrations/008_file_attachments.sql
```

## 4) Configure environment variables

In Cloudflare Pages → Settings → Environment variables (and Secrets):

- ADMIN_KEY = a long random string (32+ chars)
- CF_ACCOUNT_ID, CF_API_TOKEN, CF_IMAGES_ACCOUNT_HASH (only if using Cloudflare Images)
- R2_PUBLIC_URL = https://your-bucket.r2.dev (if using R2 public access)

Durable Object binding is declared in `wrangler.toml` (REALTIME). Cloudflare will provision it when you deploy.

## 5) Local integrated dev (API + pages)

```powershell
# Serve the site with Pages Functions locally
wrangler pages dev .
# Visit http://localhost:8788
```

The community page will auto-detect the server API. If the API isn’t reachable, it falls back to local mode.

## 6) Deploy

```powershell
wrangler pages publish .
```

Or connect the GitHub repo in Cloudflare Pages for automatic deploys from main.

## 7) Post-deploy verification

- Open `/admin.html`, enter your `ADMIN_KEY`, and run migrations (if not already done).
- Test: auth, topics/comments, voting, leaderboard, moderation, uploads, PWA install.
- Use `DEPLOYMENT_CHECKLIST.md` for a comprehensive test pass.

## Notes

- Search: keep `search-index.json` fresh by running `python .\scripts\build_search_index.py` after adding/editing example pages.
- PWA: `site.webmanifest` and `sw.js` are included; service worker registers on HTTPS.
- Backend optionality: community features use Cloudflare. Without bindings, UI still loads with limited local functionality.
