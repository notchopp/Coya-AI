# Supabase Email Templates Setup

This guide shows you how to replace the default Supabase email templates with custom COYA AI branded templates.

## Available Templates

We have 5 professional email templates ready:

1. **Invite user** (`invite-user.html`) - For sending invitations
2. **Confirm signup** (`confirm-signup.html`) - For email confirmation
3. **Magic link** (`magic-link.html`) - For passwordless login
4. **Change email** (`change-email.html`) - For email address changes
5. **Reset password** (`reset-password.html`) - For password resets

## Step 1: Copy the HTML Template

1. Open the template file you want to use (e.g., `email-templates/invite-user.html`)
2. Copy the entire HTML content

## Step 2: Configure in Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Find the template you want to customize:
   - **Invite user** → Use `invite-user.html`
   - **Confirm signup** → Use `confirm-signup.html`
   - **Magic Link** → Use `magic-link.html`
   - **Change email address** → Use `change-email.html`
   - **Reset password** → Use `reset-password.html`
4. Click **Edit** or **Customize**

## Step 3: Replace the Template

1. In the email template editor, select **HTML** mode
2. Delete the default template content
3. Paste the HTML from the corresponding template file
4. All templates use these Supabase variables:
   - `{{ .ConfirmationURL }}` - The confirmation/reset link
   - `{{ .SiteURL }}` - Your site URL (if needed)

## Step 4: Test the Template

1. Send a test invitation to yourself
2. Check the email in your inbox
3. Verify:
   - Logo displays correctly
   - Branding looks professional
   - Button works and links correctly
   - Footer shows "COYA SYSTEMS LLC"

## Customization Options

### Logo URL
If your logo is hosted elsewhere, update this line:
```html
<img src="https://coya-ai.vercel.app/logo.gif" alt="COYA AI" width="80" height="80" ... />
```

### Colors
The template uses COYA AI brand colors:
- Primary: `#eab308` (Golden yellow)
- Background: `#121212` (Dark)
- Text: `#ffffff` (White)

To change colors, search and replace:
- `#eab308` - Primary accent color
- `#121212` - Background color
- `#0a0a0a` - Outer background

### Company Name
To change "COYA SYSTEMS LLC", search for:
```html
COYA SYSTEMS LLC
```

## Email Client Compatibility

This template is designed to work with:
- ✅ Gmail (Web, iOS, Android)
- ✅ Apple Mail (macOS, iOS)
- ✅ Outlook (Web, Desktop)
- ✅ Yahoo Mail
- ✅ Most modern email clients

## Troubleshooting

### Logo not showing
- Ensure the logo URL is publicly accessible
- Check that the URL uses HTTPS
- Verify the image dimensions are correct

### Button not working
- Check that `{{ .ConfirmationURL }}` is properly formatted
- Ensure Supabase variables are not escaped
- Test the link in a browser

### Styling issues
- Some email clients strip certain CSS
- Inline styles are used for maximum compatibility
- Test in multiple email clients

## Preview

The email includes:
- ✅ COYA AI logo and branding
- ✅ Professional dark theme
- ✅ Clear call-to-action button
- ✅ Feature highlights
- ✅ Security note
- ✅ Professional signature
- ✅ COYA SYSTEMS LLC footer
- ✅ Responsive design

## Next Steps

After setting up the template:
1. Send a test invitation
2. Verify the email looks correct
3. Test the invitation link
4. Ensure users can set their password
5. Confirm redirect to dashboard works

