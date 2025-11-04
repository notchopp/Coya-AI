-- Helper script to create a user properly
-- This shows the process - you'll need to run this in Supabase SQL editor
-- OR use the Supabase dashboard to create users

-- Step 1: Create user in Supabase Auth (via Dashboard or Admin API)
-- You can do this via:
-- 1. Supabase Dashboard > Authentication > Users > Add User
-- 2. Or use the Admin API (see create-user.sql)

-- Step 2: After creating the auth user, insert into users table
-- Replace these values:
-- - YOUR_AUTH_USER_ID: The UUID from auth.users table
-- - YOUR_BUSINESS_ID: The UUID from businesses table
-- - YOUR_EMAIL: The email address
-- - YOUR_FULL_NAME: The user's full name

INSERT INTO public.users (
  auth_user_id,
  business_id,
  email,
  full_name,
  role,
  is_active
)
VALUES (
  'YOUR_AUTH_USER_ID'::uuid,  -- Replace with actual auth.users.id
  'YOUR_BUSINESS_ID'::uuid,    -- Replace with actual business ID
  'user@example.com',          -- Replace with email
  'John Doe',                  -- Replace with full name
  'member',                    -- or 'owner' or 'admin'
  true
);

-- To find your business_id:
-- SELECT id FROM public.businesses LIMIT 1;

-- To find auth user ID after creating in Auth dashboard:
-- SELECT id, email FROM auth.users WHERE email = 'user@example.com';

