-- Add patient context columns to patients table
-- This enables patient recognition and context-aware conversations

ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS last_intent text,
ADD COLUMN IF NOT EXISTS last_call_date timestamp with time zone;

-- Create index for fast phone lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_patients_phone_business 
ON public.patients(phone, business_id);

-- Create index for business lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_patients_business_id 
ON public.patients(business_id);

-- Add comment
COMMENT ON COLUMN public.patients.last_intent IS 'Last intent from call (what they asked about if no booking)';
COMMENT ON COLUMN public.patients.last_call_date IS 'Timestamp of last call from this patient';



