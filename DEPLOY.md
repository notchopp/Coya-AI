# Vercel Deployment Guide

## Method 1: Deploy via Vercel Web UI (Easiest)

### Step 1: Push to GitHub
1. Create a new repository on GitHub (if you haven't already)
2. Initialize git and push:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/receptionist-dashboard.git
   git push -u origin main
   ```

### Step 2: Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) and sign in (or create account)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. Configure project:
   - **Framework Preset:** Next.js (auto-detected)
   - **Root Directory:** `./` (default)
   - **Build Command:** `npm run build` (default)
   - **Output Directory:** `.next` (default)
   - **Install Command:** `npm install` (default)

### Step 3: Add Environment Variables
In Vercel project settings, add these environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://pewjkqekmengoxncwooj.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBld2prcWVrbWVuZ294bmN3b29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODkxMDMsImV4cCI6MjA2OTc2NTEwM30.V4c1NBNIrIv4SJX3RUggZNIT80A0NMJoQhvYah-Ahb4`

### Step 4: Deploy
Click **"Deploy"** and wait for build to complete!

---

## Method 2: Deploy via Vercel CLI

### Step 1: Install Vercel CLI
```bash
npm i -g vercel
```

### Step 2: Login
```bash
vercel login
```

### Step 3: Deploy
```bash
cd C:\Users\whoch\receptionist-dashboard
vercel
```

Follow the prompts:
- Set up and deploy? **Yes**
- Which scope? (select your account)
- Link to existing project? **No** (for first deploy)
- Project name? `receptionist-dashboard` (or your choice)
- Directory? `./` (default)
- Override settings? **No**

### Step 4: Add Environment Variables
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
# Paste: https://pewjkqekmengoxncwooj.supabase.co

vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
# Paste: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBld2prcWVrbWVuZ294bmN3b29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODkxMDMsImV4cCI6MjA2OTc2NTEwM30.V4c1NBNIrIv4SJX3RUggZNIT80A0NMJoQhvYah-Ahb4
```

### Step 5: Deploy to Production
```bash
vercel --prod
```

---

## Important Notes

1. **Environment Variables:** Make sure to add both Supabase env vars in Vercel dashboard
2. **Git Ignore:** Ensure `.env.local` is in `.gitignore` (it should be)
3. **Build:** Vercel will auto-detect Next.js and run `npm run build`
4. **Logo:** Make sure `/public/logo.gif` is committed to git
5. **Auto-Deploy:** After connecting to GitHub, every push to main will auto-deploy

---

## Quick Deploy Command (if already set up)
```bash
vercel --prod
```

Your dashboard will be live at: `https://your-project-name.vercel.app`
