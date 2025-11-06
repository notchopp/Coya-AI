-- RLS Policies for call_turns table

-- Enable RLS on call_turns table
ALTER TABLE public.call_turns ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see call_turns for calls from their business
CREATE POLICY "Users can view call_turns for their business calls"
ON public.call_turns
FOR SELECT
USING (
  business_id IN (
    SELECT business_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Service role can insert/update call_turns (for Vapi/n8n)
CREATE POLICY "Service role can manage call_turns"
ON public.call_turns
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Optional: Allow authenticated users to insert their own call_turns
-- (if you want users to be able to create turns manually)
-- CREATE POLICY "Users can insert call_turns for their business calls"
-- ON public.call_turns
-- FOR INSERT
-- WITH CHECK (
--   business_id IN (
--     SELECT business_id
--     FROM public.users
--     WHERE auth_user_id = auth.uid()
--   )
-- );

-- Create index for faster queries on call_id (already exists in schema, but keeping for reference)
-- CREATE INDEX IF NOT EXISTS idx_call_turns_call_id ON public.call_turns(call_id);
-- CREATE INDEX IF NOT EXISTS idx_call_turns_business_id ON public.call_turns(business_id);
-- CREATE INDEX IF NOT EXISTS idx_call_turns_created_at ON public.call_turns(created_at DESC);

