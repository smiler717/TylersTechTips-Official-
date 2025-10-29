# Configuration Guide for Tyler's Tech Tips Platform

This guide covers the environment variables and setup required for the newly implemented features.

## Environment Variables

Add these to your Cloudflare Pages project settings:

### Required for Core Features
```bash
# Database
DB=<your-d1-database-binding>
TYLERS_TECH_DB=<your-d1-database-binding>

# KV Namespaces
TYLERS_TECH_KV=<your-kv-namespace>
TOKENS=<your-kv-namespace>
CACHE=<your-kv-namespace>
RATE_LIMIT=<your-kv-namespace>

# Admin
ADMIN_KEY=<your-secure-admin-key>
```

### Required for WebSocket/Real-time Features
```bash
# Durable Objects
REALTIME=<your-durable-object-binding>
```

**Setup Steps:**
1. Create Durable Object class in wrangler.toml:
```toml
[[durable_objects.bindings]]
name = "REALTIME"
class_name = "RealtimeConnection"
script_name = "tylers-tech-tips"

[[migrations]]
tag = "v1"
new_classes = ["RealtimeConnection"]
```

2. Deploy the Durable Object defined in `functions/_realtime.js`

### Required for File Attachments
```bash
# Cloudflare R2
R2_BUCKET=<your-r2-bucket-binding>
TYLERS_TECH_R2=<your-r2-bucket-binding>
R2_PUBLIC_URL=https://your-bucket.r2.dev

# Cloudflare Images (optional but recommended)
CF_ACCOUNT_ID=<your-cloudflare-account-id>
CF_API_TOKEN=<your-api-token-with-images-permissions>
CF_IMAGES_ACCOUNT_HASH=<your-images-account-hash>
```

**Setup Steps:**
1. Create R2 bucket: `wrangler r2 bucket create tylers-tech-uploads`
2. Bind in wrangler.toml:
```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "tylers-tech-uploads"
```

3. For Cloudflare Images:
   - Go to Cloudflare Dashboard → Images
   - Create API token with Images:Write permission
   - Get account hash from Images settings

### Optional for Push Notifications
```bash
# VAPID keys for push notifications
VAPID_PUBLIC_KEY=<your-vapid-public-key>
VAPID_PRIVATE_KEY=<your-vapid-private-key>
```

**Generate VAPID keys:**
```bash
npm install -g web-push
web-push generate-vapid-keys
```

## Database Migrations

Run the new migrations via the admin dashboard:

1. Navigate to `/admin.html`
2. Enter your admin key
3. Go to "Settings" tab
4. Click "Run Migrations"
5. Verify migrations 006, 007, and 008 are applied

**Migrations Include:**
- **006_reputation_and_voting.sql**: Votes, badges, reputation system
- **007_moderation_system.sql**: Moderation keywords, reports, user actions
- **008_file_attachments.sql**: File attachments table

## Feature Configuration

### 1. CSRF Protection
No additional setup required. CSRF tokens are automatically generated and validated.

**How it works:**
- Device ID stored in localStorage
- Tokens fetched from `/api/csrf/token`
- Auto-included in all POST/PUT/DELETE requests

### 2. Voting System
No additional setup required after migration.

**Features:**
- Upvote/downvote on topics and comments
- Automatic reputation calculation
- Badge awards based on achievements

### 3. Real-time Updates
Requires Durable Object binding (see above).

**Fallback:**
- If WebSocket unavailable, falls back to 30-second polling
- No configuration needed for fallback

### 4. Moderation
Access via admin dashboard at `/admin.html`

**Default Settings:**
- 3 default banned keywords in database
- Auto-moderation threshold: 50% spam confidence
- Trusted users (500+ reputation) bypass some filters

**Customize:**
- Add keywords via admin panel (when UI is built)
- Adjust spam patterns in `functions/api/_moderation.js`

### 5. File Attachments
Requires R2 bucket binding (see above).

**Limits:**
- Images: 5MB max
- Other files: 10MB max
- Max 5 files per upload session

**Supported Types:**
- Images: JPEG, PNG, GIF, WebP
- Documents: PDF
- Text: Plain text
- Archives: ZIP

### 6. PWA Features
No additional setup required.

**Auto-enabled:**
- Service worker registers on page load
- Install prompt shows after 1 minute
- Offline caching active immediately

**Customize:**
- Edit `manifest.json` for app name, colors, icons
- Modify cache strategy in `sw.js`
- Add custom screenshots to manifest

## Testing Checklist

### CSRF Protection
- [ ] Registration requires CSRF token
- [ ] Token auto-refreshes on 403 error
- [ ] Device ID persists in localStorage

### Voting System
- [ ] Upvote/downvote toggle works
- [ ] Vote counts update immediately
- [ ] Reputation increases with upvotes
- [ ] Leaderboard displays top users
- [ ] Badges auto-award on achievement

### Real-time Updates
- [ ] WebSocket connects on login
- [ ] Notifications appear without refresh
- [ ] Falls back to polling if WS fails
- [ ] Connection re-establishes after disconnect

### Moderation
- [ ] Spam content flagged automatically
- [ ] Banned keywords block posts
- [ ] Reports created successfully
- [ ] Admin can review reports

### File Attachments
- [ ] Drag-and-drop upload works
- [ ] File size validation enforced
- [ ] Images display in gallery
- [ ] Files accessible via URL

### PWA
- [ ] Service worker registers
- [ ] Install banner appears
- [ ] App works offline
- [ ] Update prompt shows on new version
- [ ] Manifest loads correctly

## Troubleshooting

### WebSocket Connection Fails
- Check Durable Object binding in Cloudflare dashboard
- Verify REALTIME environment variable is set
- Check browser console for connection errors
- Ensure wrangler.toml has Durable Object configuration

### File Upload Fails
- Verify R2 bucket exists and is bound
- Check R2_BUCKET environment variable
- Ensure file size is under limit
- Check CORS settings on R2 bucket

### Service Worker Not Registering
- Must be served over HTTPS (or localhost)
- Check `sw.js` is at root of domain
- Clear browser cache and reload
- Check browser console for errors

### Voting Not Working
- Run migration 006 via admin panel
- Verify votes table exists in D1
- Check browser console for API errors
- Ensure CSRF token is being sent

## Security Recommendations

1. **Admin Key**: Use a strong, random admin key (32+ characters)
2. **API Tokens**: Restrict Cloudflare API token to minimum required permissions
3. **R2 Bucket**: Keep bucket private, serve via signed URLs or Workers
4. **Rate Limiting**: Monitor KV usage for rate limit effectiveness
5. **CSRF Tokens**: Tokens expire with user sessions (7 days)

## Performance Optimization

1. **Caching**: All GET endpoints cache for 5-15 minutes in KV
2. **CDN**: Static assets auto-cached by Cloudflare Pages
3. **Database**: Indexes created on all foreign keys and frequently queried columns
4. **Images**: Use Cloudflare Images for automatic optimization
5. **Service Worker**: Static assets cached indefinitely, API cached with network-first

## Monitoring

Monitor these metrics in Cloudflare dashboard:

- **Workers Analytics**: API request volume and errors
- **D1 Metrics**: Query performance and database size
- **KV Metrics**: Read/write operations and storage
- **R2 Metrics**: Storage used and bandwidth
- **Durable Objects**: Active connections and CPU time

## Next Steps

1. Run database migrations
2. Set environment variables
3. Test each feature thoroughly
4. Configure moderation keywords
5. Upload icon assets for PWA
6. Set up push notification VAPID keys (optional)
7. Monitor analytics and error rates

For issues or questions, check:
- Browser console for client-side errors
- Cloudflare Pages logs for server-side errors
- D1 console for database queries
- GitHub issues for known problems
