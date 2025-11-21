-- Add onboarding fields to businesses table
-- This migration adds fields needed for the onboarding flow

ALTER TABLE public.businesses 
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS logo_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS locations_count INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Add index for active businesses
CREATE INDEX IF NOT EXISTS idx_businesses_is_active 
  ON public.businesses USING btree (is_active) 
  WHERE is_active = true;

-- Add index for onboarding status
CREATE INDEX IF NOT EXISTS idx_businesses_onboarding_step 
  ON public.businesses USING btree (onboarding_step);






