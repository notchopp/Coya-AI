-- ALTERNATIVE: IF YOU WANT CALLS TO REFERENCE USERS BY AUTH_USER_ID
-- ===================================================================
-- This version links calls to users via auth_user_id instead of users.id

-- Step 1: Add auth_user_id column to calls table
ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- Step 2: Add foreign key to auth.users (if you want to link to auth)
-- Note: This requires access to auth.users schema
-- ALTER TABLE public.calls
-- ADD CONSTRAINT calls_auth_user_id_fkey 
-- FOREIGN KEY (auth_user_id) 
-- REFERENCES auth.users(id) 
-- ON DELETE SET NULL;

-- Step 3: Or create a reference via users table
-- Link calls.auth_user_id to users.auth_user_id indirectly
-- This is handled by your application logic

-- Step 4: Add index
CREATE INDEX IF NOT EXISTS idx_calls_auth_user_id ON public.calls(auth_user_id);

-- Step 5: Update existing calls (optional)
-- Links calls to users based on business_id
/*
UPDATE public.calls c
SET auth_user_id = (
  SELECT u.auth_user_id 
  FROM public.users u 
  WHERE u.business_id = c.business_id 
  AND u.role IN ('owner', 'admin')
  LIMIT 1
)
WHERE c.auth_user_id IS NULL;
*/

-- Step 6: Update RLS policy to filter by auth_user_id
/*
DROP POLICY IF EXISTS "Users can view own business calls" ON public.calls;
CREATE POLICY "Users can view own business calls"
ON public.calls FOR SELECT
USING (
  business_id = public.get_user_business_id()
  AND (auth_user_id = auth.uid() OR auth_user_id IS NULL)
);
*/

