-- Admin API approach to create user
-- This uses Supabase Admin API which requires SERVICE_ROLE_KEY
-- Run this via Supabase Dashboard > SQL Editor with service role

-- First, create the user in auth.users using Admin API
-- You can do this via:
-- 1. Supabase Dashboard > Authentication > Users > Add User manually
-- OR
-- 2. Use the REST API with service_role key:

/*
POST https://pewjkqekmengoxncwooj.supabase.co/auth/v1/admin/users
Headers:
  Authorization: Bearer YOUR_SERVICE_ROLE_KEY
  apikey: YOUR_SERVICE_ROLE_KEY
  Content-Type: application/json

Body:
{
  "email": "user@example.com",
  "password": "securepassword123",
  "email_confirm": true,
  "user_metadata": {
    "full_name": "John Doe"
  }
}
*/

-- Then insert into users table (replace with actual values)
DO $$
DECLARE
  v_auth_user_id uuid;
  v_business_id uuid;
BEGIN
  -- Get the auth user ID (replace email with actual email)
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = 'user@example.com'
  LIMIT 1;

  -- Get the first business ID (or use a specific one)
  SELECT id INTO v_business_id
  FROM public.businesses
  LIMIT 1;

  -- Insert into users table
  INSERT INTO public.users (
    auth_user_id,
    business_id,
    email,
    full_name,
    role,
    is_active
  )
  VALUES (
    v_auth_user_id,
    v_business_id,
    'user@example.com',
    'John Doe',
    'member',
    true
  )
  ON CONFLICT (business_id, email) DO NOTHING;
END $$;

