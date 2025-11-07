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

#### Option A: Using Supabase Dashboard (Requires Pre-Creating User)
1. **First, create the user record in the `users` table:**
   ```sql
   INSERT INTO users (email, business_id, is_active, role)
   VALUES ('user@example.com', 'your-business-id', true, 'user');
   ```
2. Then go to **Authentication** → **Users**
3. Click **Invite User**
4. Enter the user's email address (must match the email in users table)
5. The user will receive an email with an invitation link
6. When they accept, the callback will link their auth_user_id to the existing user record

#### Option B: Using Supabase Admin API (Recommended)

We've created a ready-to-use API route and script for inviting users:

##### Method 1: Using the API Route (From your app)

Make a POST request to `/api/invite-user`:

```typescript
// Example: From a settings page or admin panel
const response = await fetch('/api/invite-user', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'user@example.com',
    business_id: 'your-business-id',
    role: 'user', // Optional: 'admin', 'user', etc.
  }),
});

const result = await response.json();
if (result.success) {
  console.log('Invitation sent!');
}
```

##### Method 2: Using the Script (Command Line)

```bash
npx tsx scripts/invite-user.ts user@example.com your-business-id user
```

The script will:
1. ✅ Create user record in `users` table (if doesn't exist)
2. ✅ Send invitation email via Supabase Auth
3. ✅ Link `auth_user_id` automatically
4. ✅ Include `business_id` in user metadata

##### Method 3: Direct API Usage (Programmatic)

```typescript
import { getSupabaseAdminClient } from '@/lib/supabase-admin';

const supabaseAdmin = getSupabaseAdminClient();

// Step 1: Create user record (or check if exists)
const { data: existingUser } = await supabaseAdmin
  .from('users')
  .select('id, auth_user_id')
  .eq('email', 'user@example.com')
  .maybeSingle();

if (!existingUser) {
  await supabaseAdmin.from('users').insert({
    email: 'user@example.com',
    business_id: 'your-business-id',
    is_active: true,
    role: 'user',
  });
}

// Step 2: Invite with business_id in metadata
const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
  'user@example.com',
  {
    redirectTo: 'https://coya-ai.vercel.app/auth/callback',
    data: {
      business_id: 'your-business-id',
      role: 'user',
    }
  }
);
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

