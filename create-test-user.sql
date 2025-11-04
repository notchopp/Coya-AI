-- EASIEST WAY: Create a test user via Supabase Dashboard
-- 
-- 1. Go to: https://supabase.com/dashboard/project/pewjkqekmengoxncwooj/auth/users
-- 2. Click "Add User" or "Create User"
-- 3. Fill in:
--    - Email: test@example.com (or your email)
--    - Password: (choose a secure password)
--    - Auto Confirm User: ✅ CHECKED
-- 4. Click "Create User"
-- 5. Copy the User ID (UUID) that appears
-- 6. Get your business_id: Run this query:
--    SELECT id, name FROM public.businesses LIMIT 1;
--
-- 7. Then run the INSERT below with the actual values:

-- Replace YOUR_AUTH_USER_ID and YOUR_BUSINESS_ID with actual UUIDs
INSERT INTO public.users (
  auth_user_id,
  business_id,
  email,
  full_name,
  role,
  is_active
)
VALUES (
  'PASTE_AUTH_USER_ID_HERE'::uuid,  -- From Step 5 above
  'PASTE_BUSINESS_ID_HERE'::uuid,    -- From Step 6 above  
  'test@example.com',                -- Same email as Step 3
  'Test User',                        -- Any name
  'member',                           -- or 'owner' for admin
  true
);

-- Verify it worked:
SELECT 
  u.id,
  u.email,
  u.full_name,
  u.role,
  b.name as business_name
FROM public.users u
JOIN public.businesses b ON u.business_id = b.id
WHERE u.email = 'test@example.com';

