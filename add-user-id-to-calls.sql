-- ADD USER_ID FOREIGN KEY TO CALLS TABLE
-- =======================================
-- This creates a relationship between calls and users table
-- Similar to how calls.business_id references businesses.id

-- Step 1: Add user_id column to calls table (if it doesn't exist)
ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS user_id uuid;

-- Step 2: Add foreign key constraint
-- This ensures calls.user_id references users.id
ALTER TABLE public.calls
ADD CONSTRAINT calls_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.users(id) 
ON DELETE SET NULL;

-- Step 3: Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_calls_user_id ON public.calls(user_id);

-- Step 4: Optional - Update existing calls to link to users
-- This links calls to users based on business_id (if you want)
-- Uncomment and modify if needed:
/*
UPDATE public.calls c
SET user_id = (
  SELECT u.id 
  FROM public.users u 
  WHERE u.business_id = c.business_id 
  AND u.role = 'owner'  -- or 'admin' or first user
  LIMIT 1
)
WHERE c.user_id IS NULL;
*/

-- Step 5: Make user_id NOT NULL (optional, only if you want to require it)
-- Uncomment if you want to require user_id for all new calls:
-- ALTER TABLE public.calls ALTER COLUMN user_id SET NOT NULL;

-- Step 6: Update RLS policy to include user filtering (optional)
-- If you want users to only see calls they created:
/*
DROP POLICY IF EXISTS "Users can view own business calls" ON public.calls;
CREATE POLICY "Users can view own business calls"
ON public.calls FOR SELECT
USING (
  business_id = public.get_user_business_id()
  AND (user_id = auth.uid() OR user_id IS NULL)  -- Optional: only own calls
);
*/

-- Verify the foreign key was created:
SELECT 
  tc.constraint_name, 
  tc.table_name, 
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'calls'
  AND kcu.column_name = 'user_id';

