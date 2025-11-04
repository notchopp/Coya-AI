/**
 * Create User Script
 * 
 * This script helps you create users properly in your multi-tenant system.
 * 
 * STEP 1: Create user in Supabase Auth
 * Option A - Via Dashboard:
 *   1. Go to Supabase Dashboard > Authentication > Users
 *   2. Click "Add User" or "Create User"
 *   3. Enter email and password
 *   4. Make sure "Auto Confirm User" is checked
 *   5. Save and note the User ID (UUID)
 * 
 * Option B - Via API (with service_role key):
 *   See create-user-admin.sql
 * 
 * STEP 2: Get your Business ID
 * Run this query in Supabase SQL Editor:
 *   SELECT id, name FROM public.businesses;
 * 
 * STEP 3: Insert into users table
 * Replace the values below and run:
 */

-- Replace these values:
-- YOUR_AUTH_USER_ID: UUID from auth.users (from Step 1)
-- YOUR_BUSINESS_ID: UUID from businesses table (from Step 2)
-- YOUR_EMAIL: Email address
-- YOUR_FULL_NAME: User's full name

INSERT INTO public.users (
  auth_user_id,
  business_id,
  email,
  full_name,
  role,
  is_active
)
VALUES (
  'YOUR_AUTH_USER_ID'::uuid,  -- Get from: SELECT id FROM auth.users WHERE email = 'user@example.com';
  'YOUR_BUSINESS_ID'::uuid,    -- Get from: SELECT id FROM public.businesses LIMIT 1;
  'user@example.com',          -- Replace with actual email
  'John Doe',                  -- Replace with full name
  'member',                    -- Options: 'member', 'owner', 'admin'
  true
)
ON CONFLICT (business_id, email) DO UPDATE
SET 
  auth_user_id = EXCLUDED.auth_user_id,
  updated_at = now();

-- Quick query to verify:
-- SELECT u.*, b.name as business_name 
-- FROM public.users u
-- JOIN public.businesses b ON u.business_id = b.id
-- WHERE u.email = 'user@example.com';

