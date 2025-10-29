# Cloudflare Setup Guide (No CLI Required)

Since Node.js/Wrangler is not installed, here's how to set up your Tyler's Tech Tips platform using **only the Cloudflare Dashboard**.

## Prerequisites
- GitHub account (you already have repo: smiler717/TylersTechTips-Official-)
- Cloudflare account (free tier works)

## Step 1: Connect GitHub to Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Click **Pages** in the left sidebar
3. Click **Create a project** → **Connect to Git**
4. Authorize Cloudflare to access your GitHub
5. Select repository: **smiler717/TylersTechTips-Official-**
6. Configure build settings:
   - **Project name**: `tylers-tech-tips`
   - **Production branch**: `main`
   - **Build command**: (leave blank)
   - **Build output directory**: `/`
7. Click **Save and Deploy**

## Step 2: Create D1 Database

1. In Cloudflare Dashboard, go to **Workers & Pages** → **D1**
2. Click **Create database**
3. Name: `tylers-tech-tips-db`
4. Click **Create**
5. **Copy the Database ID** (you'll need this)

## Step 3: Bind D1 to Pages Project

1. Go back to **Pages** → **tylers-tech-tips** project
2. Click **Settings** tab → **Functions**
3. Scroll to **D1 database bindings**
4. Click **Add binding**:
   - **Variable name**: `DB`
   - **D1 database**: Select `tylers-tech-tips-db`
5. Click **Save**

## Step 4: Create KV Namespace

1. Go to **Workers & Pages** → **KV**
2. Click **Create a namespace**
3. Name: `TYLERS_TECH_KV`
4. Click **Add**
5. **Copy the Namespace ID**

## Step 5: Bind KV to Pages Project

1. Go to **Pages** → **tylers-tech-tips** → **Settings** → **Functions**
2. Scroll to **KV namespace bindings**
3. Click **Add binding**:
   - **Variable name**: `TYLERS_TECH_KV`
   - **KV namespace**: Select `TYLERS_TECH_KV`
4. Click **Save**

## Step 6: Create R2 Bucket (Optional - for file uploads)

1. Go to **R2** in the left sidebar
2. Click **Create bucket**
3. Name: `tylers-tech-uploads`
4. Click **Create bucket**

## Step 7: Bind R2 to Pages Project

1. Go to **Pages** → **tylers-tech-tips** → **Settings** → **Functions**
2. Scroll to **R2 bucket bindings**
3. Click **Add binding**:
   - **Variable name**: `R2_BUCKET`
   - **R2 bucket**: Select `tylers-tech-uploads`
4. Click **Save**

## Step 8: Set Environment Variables

1. Go to **Pages** → **tylers-tech-tips** → **Settings** → **Environment variables**
2. Add these variables (Production AND Preview):

### Required
```
ADMIN_KEY = W2Cem=7o_IrPLRcA@k4Jpuw8DGi?#gsh
```
*(This is your secure admin key - SAVE IT SOMEWHERE SAFE)*

### Optional (for Cloudflare Images)
```
CF_ACCOUNT_ID = <your-cloudflare-account-id>
CF_API_TOKEN = <create-token-with-Images-Write-permission>
CF_IMAGES_ACCOUNT_HASH = <from-Images-settings>
R2_PUBLIC_URL = https://tylers-tech-uploads.<your-account>.r2.dev
```

To find your Account ID:
- Dashboard → **Overview** → copy Account ID from right sidebar

## Step 9: Run Database Migrations

Since you can't use Wrangler CLI, you have two options:

### Option A: Via D1 Dashboard (Manual)
1. Go to **Workers & Pages** → **D1** → **tylers-tech-tips-db**
2. Click **Console** tab
3. Copy and paste each migration file content (001 through 008) one at a time
4. Click **Execute** after each

### Option B: Via Admin Dashboard (After Deploy)
1. Wait for your Pages deployment to finish
2. Visit `https://tylers-tech-tips.pages.dev/admin.html`
3. Enter admin key: `W2Cem=7o_IrPLRcA@k4Jpuw8DGi?#gsh`
4. Go to **Settings** tab
5. Click **Run Migrations**

**(Option B is easier - recommended)**

## Step 10: Setup Durable Objects (for Real-time)

1. Go to **Workers & Pages** → **tylers-tech-tips** project
2. Click **Settings** → **Functions**
3. Scroll to **Durable Object bindings**
4. Click **Add binding**:
   - **Variable name**: `REALTIME`
   - **Durable Object class name**: `RealtimeConnection`
   - **Environment**: Select your Pages project
5. Click **Save**

Note: Durable Objects may require upgrading to Workers Paid plan ($5/month). The site works fine without it (real-time features will fall back to polling).

## Step 11: Verify Deployment

1. Wait 1-2 minutes for deployment to complete
2. Visit your site: `https://tylers-tech-tips.pages.dev`
3. Test these pages:
   - Homepage: Should load with articles
   - Community: Should show forum (may be empty)
   - Profile: Registration/login
4. Go to `/admin.html` with your admin key and run migrations

## Step 12: Custom Domain (Optional)

1. Go to **Pages** → **tylers-tech-tips** → **Custom domains**
2. Click **Set up a custom domain**
3. Enter your domain (e.g., `tylerstechtips.com`)
4. Follow DNS instructions
5. Wait for SSL certificate (automatic)

## Troubleshooting

### Deployment fails
- Check **Deployments** tab for error logs
- Ensure all bindings are set correctly
- Verify environment variables are set for both Production and Preview

### Database errors
- Make sure D1 binding is set with variable name `DB`
- Run migrations via admin dashboard
- Check D1 console for successful migrations

### Real-time not working
- This is normal without Durable Objects binding
- Site will fall back to polling (works fine)
- Only needed for instant notifications

## What You Get

✅ **Static site** served from Cloudflare edge  
✅ **Community forum** with topics and comments  
✅ **Authentication** with JWT tokens  
✅ **Search** across articles and topics  
✅ **PWA support** for offline and install  
✅ **Admin dashboard** at /admin.html  
✅ **Automatic deployments** from GitHub main branch  

## Next Steps

1. Customize content by editing HTML files and pushing to GitHub
2. Add articles using `generate_page.py` with JSON examples
3. Configure moderation keywords via admin dashboard
4. Add Cloudflare Analytics for visitor tracking
5. Set up email notifications (future feature)

## Your Admin Credentials

**Admin Key**: `W2Cem=7o_IrPLRcA@k4Jpuw8DGi?#gsh`  
**Admin URL**: `https://tylers-tech-tips.pages.dev/admin.html`

**SAVE THESE SOMEWHERE SAFE** - You'll need them to manage the site.

---

**Total Setup Time**: ~10-15 minutes  
**Cost**: Free (unless you enable Durable Objects for $5/month)  
**Updates**: Auto-deploy when you push to GitHub
