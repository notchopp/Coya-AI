-- RLS Policies for realtime.messages to allow business members to receive broadcasts
-- These policies control who can receive messages from the business:CALLS:* channels

-- Allow authenticated users to subscribe to their business's call channels
CREATE POLICY "Users can receive their business call broadcasts"
ON realtime.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.calls c
    WHERE c.business_id::text = (regexp_split_to_array(channel, ':'))[3]
    AND c.business_id IN (
      SELECT business_id FROM public.user_businesses 
      WHERE user_id = (select auth.uid())
      -- OR adjust based on your auth structure:
      -- SELECT business_id FROM public.users WHERE auth_user_id = (select auth.uid())
    )
  )
  OR
  -- Allow service role to see all broadcasts (for admin purposes)
  (auth.jwt() ->> 'role') = 'service_role'
);

-- Optional: Allow users to send broadcasts (if needed for client-to-client communication)
-- CREATE POLICY "Users can send broadcasts to their business channels"
-- ON realtime.messages FOR INSERT
-- WITH CHECK (
--   channel LIKE 'business:CALLS:%'
--   AND EXISTS (
--     SELECT 1 FROM public.user_businesses
--     WHERE user_id = auth.uid()
--     AND business_id::text = (regexp_split_to_array(channel, ':'))[3]
--   )
-- );

