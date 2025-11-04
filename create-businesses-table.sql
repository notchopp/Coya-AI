-- Create businesses table
-- This table stores business information for each client

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  vertical text NOT NULL,
  services text[] NULL,
  hours jsonb NULL,
  address text NULL,
  staff jsonb NULL,
  faqs jsonb NULL,
  promos jsonb NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  owner_id uuid NULL,
  CONSTRAINT businesses_pkey PRIMARY KEY (id)
) TABLESPACE pg_default;

-- Create index on owner_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON public.businesses(owner_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_businesses_created_at ON public.businesses(created_at DESC);

-- Add comment to table
COMMENT ON TABLE public.businesses IS 'Stores business information for each client, including name, vertical, services, hours, address, staff, FAQs, and promotions';

