-- DEBUGGING QUERIES FOR CALLS TABLE
-- ===================================
-- Run these queries to debug why calls aren't showing

-- 1. Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'calls';

-- 2. Check existing RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'calls';

-- 3. Check if you have any calls at all
SELECT COUNT(*) as total_calls FROM public.calls;

-- 4. Check calls by business_id (replace with your actual business_id)
SELECT COUNT(*) as calls_for_business 
FROM public.calls 
WHERE business_id = 'YOUR_BUSINESS_ID_HERE';

-- 5. Test the helper function
SELECT public.get_user_business_id() as current_user_business_id;

-- 6. Check if helper function exists and works
SELECT 
  business_id,
  COUNT(*) as call_count
FROM public.calls
WHERE business_id = public.get_user_business_id()
GROUP BY business_id;

-- 7. Temporarily disable RLS to test (only for debugging!)
-- ALTER TABLE public.calls DISABLE ROW LEVEL SECURITY;

-- 8. Re-enable RLS after testing
-- ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- 9. Check what business_id is stored in sessionStorage
-- (Run this in browser console:)
-- console.log(sessionStorage.getItem("business_id"));

