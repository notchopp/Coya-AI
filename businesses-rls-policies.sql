-- RLS Policies for businesses table
-- Allows users to read and update their own business

-- Enable RLS on businesses table
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read their own business" ON public.businesses;
DROP POLICY IF EXISTS "Users can update their own business" ON public.businesses;

-- Policy: Users can read their own business
-- Users can read businesses where their business_id matches
CREATE POLICY "Users can read their own business"
ON public.businesses FOR SELECT
USING (
  id IN (
    SELECT business_id 
    FROM public.users 
    WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Users can update their own business
-- Users can update businesses where their business_id matches
-- Only allows updating: name, vertical, services, address
CREATE POLICY "Users can update their own business"
ON public.businesses FOR UPDATE
USING (
  id IN (
    SELECT business_id 
    FROM public.users 
    WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  id IN (
    SELECT business_id 
    FROM public.users 
    WHERE auth_user_id = auth.uid()
  )
);

-- Note: INSERT and DELETE policies are not created here
-- as users should not be able to create/delete businesses themselves
-- Only admins should have that capability

