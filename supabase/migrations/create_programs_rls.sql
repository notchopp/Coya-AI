-- Enable RLS on programs table
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view programs for their business
-- This uses auth.uid() to get the current authenticated user's UUID
-- and matches it against users.auth_user_id
CREATE POLICY "Users can view programs for their business"
ON public.programs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.business_id = programs.business_id
    AND users.auth_user_id = (select auth.uid())
  )
);

-- Policy: Admins can insert programs for their business
CREATE POLICY "Admins can insert programs for their business"
ON public.programs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.business_id = programs.business_id
    AND users.auth_user_id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- Policy: Admins can update programs for their business
CREATE POLICY "Admins can update programs for their business"
ON public.programs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.business_id = programs.business_id
    AND users.auth_user_id = (select auth.uid())
    AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.business_id = programs.business_id
    AND users.auth_user_id = (select auth.uid())
    AND users.role = 'admin'
  )
);

-- Policy: Admins can delete programs for their business
CREATE POLICY "Admins can delete programs for their business"
ON public.programs
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.business_id = programs.business_id
    AND users.auth_user_id = (select auth.uid())
    AND users.role = 'admin'
  )
);

