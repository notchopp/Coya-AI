-- RLS Policies for users table
-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own user record
CREATE POLICY "Users can view own record"
ON public.users FOR SELECT
USING (auth_user_id = auth.uid());

-- Policy: Users can view other users in their business
CREATE POLICY "Users can view business members"
ON public.users FOR SELECT
USING (
  business_id IN (
    SELECT business_id FROM public.users
    WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Service role can do everything (for admin operations)
-- This is handled by service_role key, no policy needed

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

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

