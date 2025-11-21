-- RLS Policies for patients table
-- Allows authenticated users to access patients for their business

-- Enable RLS on patients table
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view patients for their business" ON public.patients;
DROP POLICY IF EXISTS "Users can insert patients for their business" ON public.patients;
DROP POLICY IF EXISTS "Users can update patients for their business" ON public.patients;
DROP POLICY IF EXISTS "Users can delete patients for their business" ON public.patients;
DROP POLICY IF EXISTS "Allow anon inserts" ON public.patients;
DROP POLICY IF EXISTS "Allow anon selects" ON public.patients;

-- Policy: Users can view patients for their business
-- This allows authenticated users to see all patients that belong to their business_id
CREATE POLICY "Users can view patients for their business"
ON public.patients
FOR SELECT
TO authenticated
USING (
  business_id IN (
    SELECT business_id 
    FROM public.users 
    WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Users can insert patients for their business
-- This allows authenticated users to create patients for their business
CREATE POLICY "Users can insert patients for their business"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (
  business_id IN (
    SELECT business_id 
    FROM public.users 
    WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Users can update patients for their business
-- This allows authenticated users to update patients that belong to their business
CREATE POLICY "Users can update patients for their business"
ON public.patients
FOR UPDATE
TO authenticated
USING (
  business_id IN (
    SELECT business_id 
    FROM public.users 
    WHERE auth_user_id = auth.uid()
  )
)
WITH CHECK (
  business_id IN (
    SELECT business_id 
    FROM public.users 
    WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Users can delete patients for their business
-- This allows authenticated users to delete patients that belong to their business
CREATE POLICY "Users can delete patients for their business"
ON public.patients
FOR DELETE
TO authenticated
USING (
  business_id IN (
    SELECT business_id 
    FROM public.users 
    WHERE auth_user_id = auth.uid()
  )
);

-- Note: Service role (used by API routes) can bypass RLS
-- If you need service role to manage patients, you can add:
-- CREATE POLICY "Service role can manage patients"
-- ON public.patients
-- FOR ALL
-- TO service_role
-- USING (true)
-- WITH CHECK (true);

