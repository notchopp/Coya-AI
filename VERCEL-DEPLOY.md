# Quick Vercel Deployment Steps

## Option 1: Web UI (Recommended for first time)

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin master
   ```

2. **Deploy on Vercel:**
   - Go to https://vercel.com
   - Click "Add New Project"
   - Import your GitHub repo
   - Add environment variables:
     - `NEXT_PUBLIC_SUPABASE_URL` = `https://pewjkqekmengoxncwooj.supabase.co`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBld2prcWVrbWVuZ294bmN3b29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODkxMDMsImV4cCI6MjA2OTc2NTEwM30.V4c1NBNIrIv4SJX3RUggZNIT80A0NMJoQhvYah-Ahb4`
   - Click "Deploy"

## Option 2: CLI

```bash
# Install Vercel CLI (one time)
npm i -g vercel

# Login
vercel login

# Deploy (from project directory)
cd C:\Users\whoch\receptionist-dashboard
vercel

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production

# Deploy to production
vercel --prod
```

## Important:
- Make sure `public/logo.gif` is committed
- `.env.local` should be in `.gitignore` (don't commit secrets)
- After first deploy, every git push auto-deploys!
