# Fix Google OAuth "Access Blocked" Error

## Problem
Your Google OAuth app is in "Testing" mode, which means only approved test users can access it.

## Solution: Add Test Users

### Option 1: Add Test Users (Quick Fix - For Development)

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID (the one with your client ID)
3. Scroll down to "Test users" section
4. Click "+ ADD USERS"
5. Add your email: `cashcowclinton99@gmail.com`
6. Add any other emails that need to test the integration
7. Click "SAVE"

**Note:** In testing mode, you can add up to 100 test users.

### Option 2: Publish Your App (For Production)

If you want anyone to be able to use your calendar integration:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click on your OAuth 2.0 Client ID
3. Scroll to "Publishing status" section
4. Click "PUBLISH APP"
5. Fill out the OAuth consent screen:
   - App name: "Coya AI"
   - User support email: your email
   - Developer contact: your email
   - Scopes: `https://www.googleapis.com/auth/calendar` and `https://www.googleapis.com/auth/calendar.events`
6. Submit for verification (this can take a few days)

**For now, use Option 1 to test immediately.**

## After Adding Test Users

1. Clear your browser cache/cookies for Google
2. Try the OAuth flow again
3. You should now be able to authorize the app

## Important Notes

- **Testing Mode**: Only approved test users can authorize
- **Production Mode**: Anyone can authorize (requires Google verification)
- **Verification**: Required if you use sensitive scopes (Calendar is sensitive)
- **Time**: Verification can take 1-7 days

