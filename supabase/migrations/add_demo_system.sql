-- Demo Sessions Table
CREATE TABLE IF NOT EXISTS public.demo_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text UNIQUE NOT NULL,
  email text,
  phone text,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true,
  converted boolean DEFAULT false,
  converted_at timestamp with time zone,
  demo_business_id uuid,
  demo_phone_number text,
  CONSTRAINT demo_sessions_demo_business_id_fkey 
    FOREIGN KEY (demo_business_id) 
    REFERENCES businesses(id) ON DELETE CASCADE
);

-- Add demo flags to businesses
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS is_demo boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS demo_session_id uuid,
ADD COLUMN IF NOT EXISTS demo_phone_number text;

-- Add foreign key for demo_session_id
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'businesses_demo_session_id_fkey'
  ) THEN
    ALTER TABLE public.businesses
    ADD CONSTRAINT businesses_demo_session_id_fkey 
      FOREIGN KEY (demo_session_id) 
      REFERENCES demo_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_demo_sessions_token 
  ON public.demo_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_demo_sessions_active 
  ON public.demo_sessions(is_active, expires_at);
CREATE INDEX IF NOT EXISTS idx_businesses_demo 
  ON public.businesses(is_demo, demo_session_id);
CREATE INDEX IF NOT EXISTS idx_businesses_demo_phone 
  ON public.businesses(demo_phone_number) 
  WHERE demo_phone_number IS NOT NULL;

-- Function to check demo availability
CREATE OR REPLACE FUNCTION check_demo_availability()
RETURNS TABLE(available boolean, next_available_in integer) AS $$
DECLARE
  active_count integer;
  next_expiry timestamp with time zone;
BEGIN
  SELECT COUNT(*), MIN(expires_at)
  INTO active_count, next_expiry
  FROM demo_sessions
  WHERE is_active = true 
    AND expires_at > now();
  
  IF active_count = 0 THEN
    RETURN QUERY SELECT true, 0;
  ELSE
    RETURN QUERY SELECT false, 
      GREATEST(1, EXTRACT(EPOCH FROM (next_expiry - now()))::integer / 60);
  END IF;
END;
$$ LANGUAGE plpgsql;

