-- RLS Policies for call_turns table

-- Enable RLS on call_turns table
ALTER TABLE public.call_turns ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see call_turns for calls from their business
-- This links call_turns to calls table via call_id, and checks business_id through calls
CREATE POLICY "Users can view call_turns for their business calls"
ON public.call_turns
FOR SELECT
USING (
  business_id IN (
    SELECT business_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.calls
    WHERE calls.call_id = call_turns.call_id
    AND calls.business_id = call_turns.business_id
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
--   AND EXISTS (
--     SELECT 1
--     FROM public.calls
--     WHERE calls.call_id = call_turns.call_id
--     AND calls.business_id = call_turns.business_id
--   )
-- );

-- Note: Indexes already exist in schema (call_id, business_id, created_at)

