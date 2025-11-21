# Calendar Integration Setup Guide

## Google Calendar OAuth Credentials

Add these to your `.env.local` file (get credentials from Google Cloud Console):

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

## Important: Configure Redirect URI in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Add authorized redirect URI:
   - For local dev: `http://localhost:3000/api/calendar/callback`
   - For production: `https://your-domain.com/api/calendar/callback`

## Enable Google Calendar API

1. Go to: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
2. Click "Enable"

## Fix "Access Blocked" Error (Testing Mode)

If you see "Access blocked: coya-ai.vercel.app has not completed the Google verification process":

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Scroll down to "Test users" section
4. Click "+ ADD USERS"
5. Add your email address (e.g., `cashcowclinton99@gmail.com`)
6. Add any other test user emails
7. Click "SAVE"
8. Clear browser cache and try again

**Note:** In testing mode, only approved test users can authorize. For production, you'll need to publish and verify your app.

## Testing the Integration

1. Call `/api/calendar/connect?business_id=YOUR_BUSINESS_ID`
2. User will be redirected to Google OAuth
3. After authorization, they'll be redirected back to `/api/calendar/callback`
4. Tokens will be stored in `calendar_connections` table
5. User will be redirected to settings page with success message

## Next Steps

- Implement token refresh logic (tokens expire after 1 hour)
- Add Microsoft/Outlook calendar support
- Add Calendly integration
- Implement calendar event creation/updates

