-- FIXED RLS POLICIES FOR USERS TABLE (NO RECURSION)
-- ===================================================
-- This fixes the infinite recursion error by using SECURITY DEFINER functions
-- to bypass RLS when checking business membership

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own record" ON public.users;
DROP POLICY IF EXISTS "Users can view business members" ON public.users;
DROP POLICY IF EXISTS "Allow login queries" ON public.users;
DROP POLICY IF EXISTS "Users can view own and business members" ON public.users;

-- Helper function to get user's business_id (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS uuid AS $$
  SELECT business_id FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Policy 1: Users can view their own record (by auth_user_id)
-- This allows login to work - no recursion because it doesn't query users table
CREATE POLICY "Users can view own record"
ON public.users FOR SELECT
USING (auth_user_id = auth.uid());

-- Policy 2: Users can view other users in their business
-- Uses SECURITY DEFINER function to avoid recursion
CREATE POLICY "Users can view business members"
ON public.users FOR SELECT
USING (
  business_id = public.get_user_business_id()
);

-- Helper function to check if user is active
CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS boolean AS $$
  SELECT is_active FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

