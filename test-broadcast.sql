-- Test insert to verify broadcasts are working
-- Replace 'your-business-id-here' with an actual business_id from your businesses table

INSERT INTO public.calls (
  business_id,
  call_id,
  status,
  phone,
  patient_name,
  last_intent,
  last_summary,
  success
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000'::uuid,  -- Replace with actual UUID
  'test-broadcast-' || extract(epoch from now())::text,
  'active',
  '+1234567890',
  'Test Broadcast Patient',
  'schedule_appointment',
  'Patient called to schedule an appointment. Broadcast test successful.',
  true
);

-- After running this, check your dashboard - the call should appear instantly!
-- The broadcast will be sent to channel: business:CALLS:your-business-id-here

