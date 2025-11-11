-- Add patient_hash and sensitive_content_types columns to calls
ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS patient_hash text;

ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS sensitive_content_types text[] DEFAULT ARRAY[]::text[];

UPDATE public.calls
SET sensitive_content_types = ARRAY[]::text[]
WHERE sensitive_content_types IS NULL;

-- Training tables for anonymized call storage
CREATE TABLE IF NOT EXISTS public.calls_training (
  call_id text PRIMARY KEY,
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  patient_hash text,
  status text,
  to_number text,
  phone text,
  email text,
  patient_name text,
  transcript text,
  last_summary text,
  last_intent text,
  last_confidence numeric(6,3),
  route text,
  success boolean,
  escalate boolean,
  upsell boolean,
  duration_sec integer,
  success_evaluation integer,
  schedule jsonb,
  context jsonb,
  sensitive_content_types text[] DEFAULT ARRAY[]::text[],
  started_at_year_month text,
  ended_at_year_month text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.call_turns_training (
  call_id text PRIMARY KEY REFERENCES public.calls_training(call_id) ON DELETE CASCADE,
  transcript_json jsonb,
  total_turns integer,
  to_number text,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calls_training_business_id ON public.calls_training USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_calls_training_updated_at ON public.calls_training USING btree (updated_at DESC);

-- Enable RLS on training tables
ALTER TABLE public.calls_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_turns_training ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Users can view training calls" ON public.calls_training;
DROP POLICY IF EXISTS "Users can insert training calls" ON public.calls_training;
DROP POLICY IF EXISTS "Users can view training call turns" ON public.call_turns_training;
DROP POLICY IF EXISTS "Users can insert training call turns" ON public.call_turns_training;

-- Policies mirror calls/call_turns but operate on anonymized data
CREATE POLICY "Users can view training calls"
ON public.calls_training FOR SELECT
USING (
  business_id IN (SELECT * FROM public.user_business_ids())
  OR (auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Users can insert training calls"
ON public.calls_training FOR INSERT
WITH CHECK (
  business_id IN (SELECT * FROM public.user_business_ids())
  OR (auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Users can view training call turns"
ON public.call_turns_training FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.calls_training ct
    WHERE ct.call_id = call_turns_training.call_id
    AND (ct.business_id IN (SELECT * FROM public.user_business_ids())
      OR (auth.jwt() ->> 'role') = 'service_role')
  )
);

CREATE POLICY "Users can insert training call turns"
ON public.call_turns_training FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.calls_training ct
    WHERE ct.call_id = call_turns_training.call_id
    AND (ct.business_id IN (SELECT * FROM public.user_business_ids())
      OR (auth.jwt() ->> 'role') = 'service_role')
  )
);
