-- Calendar Connections Table for Google Calendar OAuth
-- Stores OAuth tokens per business/program for calendar integration

CREATE TABLE IF NOT EXISTS public.calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  program_id UUID NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  calendar_id TEXT NOT NULL, -- Google Calendar ID (usually primary or custom calendar ID)
  access_token TEXT NOT NULL, -- Encrypted OAuth access token
  refresh_token TEXT NOT NULL, -- Encrypted OAuth refresh token
  token_expires_at TIMESTAMPTZ NOT NULL, -- When access token expires
  scope TEXT NOT NULL, -- OAuth scopes granted
  email TEXT NOT NULL, -- Google account email
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT calendar_connections_pkey PRIMARY KEY (id),
  CONSTRAINT calendar_connections_unique UNIQUE (business_id, program_id, calendar_id)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_calendar_connections_business_id ON public.calendar_connections USING btree (business_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_program_id ON public.calendar_connections USING btree (program_id);
CREATE INDEX IF NOT EXISTS idx_calendar_connections_email ON public.calendar_connections USING btree (email);

-- Enable RLS
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view calendar connections for their business" ON public.calendar_connections;
DROP POLICY IF EXISTS "Admins can manage calendar connections for their business" ON public.calendar_connections;

CREATE POLICY "Users can view calendar connections for their business"
ON public.calendar_connections FOR SELECT
USING (
  business_id IN (SELECT * FROM public.user_business_ids())
  OR (auth.jwt() ->> 'role') = 'service_role'
);

CREATE POLICY "Admins can manage calendar connections for their business"
ON public.calendar_connections FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.business_id = calendar_connections.business_id
    AND users.auth_user_id = (select auth.uid())
    AND users.role = 'admin'
  )
  OR (auth.jwt() ->> 'role') = 'service_role'
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.business_id = calendar_connections.business_id
    AND users.auth_user_id = (select auth.uid())
    AND users.role = 'admin'
  )
  OR (auth.jwt() ->> 'role') = 'service_role'
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_calendar_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_calendar_connections_updated_at_trigger ON public.calendar_connections;
CREATE TRIGGER update_calendar_connections_updated_at_trigger
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_connections_updated_at();


