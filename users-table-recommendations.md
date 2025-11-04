-- RECOMMENDATIONS FOR USERS TABLE
-- =================================

-- 1. RLS POLICIES: ✅ YES - ABSOLUTELY REQUIRED
--    Multi-tenant apps MUST have RLS to prevent data leakage
--    Users should only see users in their own business
--    Run the policies in users-rls-policies.sql

-- 2. REALTIME: ❌ NO - Usually not needed
--    User data rarely changes in real-time
--    Only enable if you have admin features that need live user updates
--    Most apps don't need this for users table

-- RECOMMENDED SETUP:
-- ==================

-- 1. Enable RLS (run users-rls-policies.sql)
-- 2. Skip Realtime for users table (focus on calls table)
-- 3. Use RLS to filter by business_id automatically

-- IF YOU NEED REALTIME (admin user management):
-- Only enable if you have a feature where admins manage users
-- and you want to see changes in real-time across sessions

-- To enable Realtime (only if needed):
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

