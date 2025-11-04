-- UPDATED RLS POLICIES FOR CALLS TABLE
-- =====================================
-- Users should only see calls from their own business
-- This ensures data isolation per business

-- Enable RLS on calls table
ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own business calls" ON public.calls;
DROP POLICY IF EXISTS "Users can view calls" ON public.calls;
DROP POLICY IF EXISTS "Users can insert own business calls" ON public.calls;
DROP POLICY IF EXISTS "Users can update own business calls" ON public.calls;

-- Policy: Users can view calls from their own business
-- Uses the helper function to avoid recursion
CREATE POLICY "Users can view own business calls"
ON public.calls FOR SELECT
USING (
  business_id = public.get_user_business_id()
);

-- Policy: Users can insert calls for their business
CREATE POLICY "Users can insert own business calls"
ON public.calls FOR INSERT
WITH CHECK (
  business_id = public.get_user_business_id()
);

-- Policy: Users can update calls for their business
CREATE POLICY "Users can update own business calls"
ON public.calls FOR UPDATE
USING (
  business_id = public.get_user_business_id()
)
WITH CHECK (
  business_id = public.get_user_business_id()
);

-- Policy: Users can delete calls for their business (optional)
CREATE POLICY "Users can delete own business calls"
ON public.calls FOR DELETE
USING (
  business_id = public.get_user_business_id()
);

-- Verify policies exist
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'calls';

