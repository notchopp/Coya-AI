-- SIMPLIFIED RLS POLICIES FOR USERS TABLE
-- =======================================
-- This version ensures login works by allowing authenticated users
-- to query their own record and business members

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own record" ON public.users;
DROP POLICY IF EXISTS "Users can view business members" ON public.users;
DROP POLICY IF EXISTS "Allow login queries" ON public.users;

-- Single comprehensive policy: Users can view their own record and business members
-- This works because after signInWithPassword, auth.uid() returns the user ID
CREATE POLICY "Users can view own and business members"
ON public.users FOR SELECT
USING (
  -- Allow if this is the user's own record
  auth_user_id = auth.uid()
  OR
  -- Allow if user is querying members of their own business
  business_id IN (
    SELECT business_id FROM public.users
    WHERE auth_user_id = auth.uid()
  )
);

-- Helper function to get current user's business_id
CREATE OR REPLACE FUNCTION public.get_user_business_id()
RETURNS uuid AS $$
  SELECT business_id FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function to check if user is active
CREATE OR REPLACE FUNCTION public.is_user_active()
RETURNS boolean AS $$
  SELECT is_active FROM public.users
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

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

