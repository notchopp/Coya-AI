-- Add owner role support to users table
-- This migration ensures the role column supports 'owner', 'admin', and 'user' roles

-- Update role check constraint if it exists, or add it if it doesn't
DO $$ 
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_role_check'
    ) THEN
        ALTER TABLE public.users DROP CONSTRAINT users_role_check;
    END IF;
    
    -- Add new constraint allowing owner, admin, and user roles
    ALTER TABLE public.users 
    ADD CONSTRAINT users_role_check 
    CHECK (role IN ('owner', 'admin', 'user'));
EXCEPTION
    WHEN others THEN
        -- If constraint doesn't exist or other error, try to add it
        BEGIN
            ALTER TABLE public.users 
            ADD CONSTRAINT users_role_check 
            CHECK (role IN ('owner', 'admin', 'user'));
        EXCEPTION
            WHEN duplicate_object THEN
                -- Constraint already exists, do nothing
                NULL;
        END;
END $$;

-- Add index for owner role lookups
CREATE INDEX IF NOT EXISTS idx_users_role 
  ON public.users USING btree (role) 
  WHERE role = 'owner';

-- Add column to track if owner has completed onboarding (one-time flag)
ALTER TABLE public.users 
  ADD COLUMN IF NOT EXISTS owner_onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add index for owner onboarding status
CREATE INDEX IF NOT EXISTS idx_users_owner_onboarding 
  ON public.users USING btree (owner_onboarding_completed) 
  WHERE role = 'owner' AND owner_onboarding_completed = false;



