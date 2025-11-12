# Troubleshooting: "Invalid invitation link. No code provided"

If you're seeing this error when clicking "Accept Invitation", follow these steps:

## Step 1: Check Supabase Redirect URL Configuration

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Check **Redirect URLs** section
4. Make sure these URLs are added (exact match required):
   ```
   https://coya-ai.vercel.app/auth/callback
   http://localhost:3000/auth/callback
   ```
5. **Important**: The URL must match EXACTLY (including https/http, no trailing slash)

## Step 2: Check Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for debug messages starting with 🔍
4. Check what the full URL looks like
5. Share the console output if the issue persists

## Step 3: Verify Email Template

1. Go to Supabase Dashboard → **Authentication** → **Email Templates**
2. Select **Invite user** template
3. Make sure it uses `{{ .ConfirmationURL }}` (not a custom URL)
4. The template should look like:
   ```html
   <a href="{{ .ConfirmationURL }}">Accept Invitation</a>
   ```

## Step 4: Test the Invitation Link

When you click the link in the email, the URL should look like:
```
https://coya-ai.vercel.app/auth/callback?code=abc123...&type=invite
```

OR (if using hash fragments):
```
https://coya-ai.vercel.app/auth/callback#code=abc123...&type=invite
```

## Step 5: Common Issues

### Issue: Redirect URL not in allowed list
**Solution**: Add the exact URL to Supabase Dashboard → Authentication → URL Configuration → Redirect URLs

### Issue: Code parameter missing
**Solution**: 
- Check that the redirect URL matches exactly
- Verify the email template uses `{{ .ConfirmationURL }}`
- Make sure you're using the latest invitation link (they expire)

### Issue: Wrong domain
**Solution**: If testing locally, make sure you're using `http://localhost:3000/auth/callback` (not 127.0.0.1)

## Step 6: Manual Test

1. Send a new invitation
2. Copy the full URL from the email link
3. Check if it contains `code=` parameter
4. If not, the issue is with Supabase configuration
5. If yes, the issue might be with how we're reading it

## Still Not Working?

Check the browser console for the debug messages. They will show:
- Full URL
- Hash fragment
- Search params
- Whether code was found

Share these logs for further debugging.



