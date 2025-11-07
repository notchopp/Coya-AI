# Supabase Auth Invitation Setup

This guide explains how to configure Supabase Auth to work with the invitation flow.

## Configuration Steps

### 1. Set Redirect URL in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **URL Configuration**
3. Add the following to **Redirect URLs**:
   ```
   https://coya-ai.vercel.app/auth/callback
   http://localhost:3000/auth/callback (for local development)
   ```

### 2. Sending Invitations

To send an invitation to a user:

#### Option A: Using Supabase Dashboard
1. Go to **Authentication** → **Users**
2. Click **Invite User**
3. Enter the user's email address
4. The user will receive an email with an invitation link

#### Option B: Using Supabase Admin API
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key for admin operations
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Invite a user
const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
  'user@example.com',
  {
    redirectTo: 'https://coya-ai.vercel.app/auth/callback'
  }
)
```

### 3. User Flow

1. **User receives invitation email** from Supabase
2. **User clicks the link** in the email
3. **Redirected to** `/auth/callback?code=...&type=invite`
4. **Callback page**:
   - Exchanges the code for a session
   - Detects if password needs to be set
   - Shows password setup form if needed
   - Redirects to dashboard after password is set

### 4. Environment Variables

Make sure these are set in your `.env.local` and Vercel:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

For admin operations (sending invites programmatically):
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Testing Locally

1. Set redirect URL to `http://localhost:3000/auth/callback` in Supabase
2. Send a test invitation
3. Click the link in the email
4. You should be redirected to the password setup page
5. Set your password and you'll be logged in

## Troubleshooting

### "Invalid invitation link"
- Check that the redirect URL is correctly configured in Supabase
- Ensure the code parameter is present in the URL
- Verify the invitation hasn't expired

### "User account not found"
- Make sure the user exists in the `users` table
- Verify the `auth_user_id` matches the Supabase Auth user ID
- Check RLS policies allow reading the user record

### Password not setting
- Check browser console for errors
- Verify Supabase Auth is properly configured
- Ensure the user has the correct permissions

