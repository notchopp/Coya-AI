-- Test SQL for Flowchart: Simulate Live Calls at Different Stages
-- Replace 'YOUR_BUSINESS_ID' with your actual business_id from sessionStorage

-- ============================================
-- SCENARIO 1: Brand New Call (Just Started)
-- ============================================
INSERT INTO public.calls (
  business_id,
  call_id,
  status,
  phone,
  patient_name,
  started_at,
  ended_at,
  total_turns
)
VALUES (
  'YOUR_BUSINESS_ID'::uuid,  -- Replace with your business_id
  'test-flowchart-new-' || extract(epoch from now())::text,
  'active',
  '+1234567890',
  'Test Patient New',
  now(),
  NULL,
  0
);

-- ============================================
-- SCENARIO 2: Call in Greeting Phase
-- ============================================
INSERT INTO public.calls (
  business_id,
  call_id,
  status,
  phone,
  patient_name,
  started_at,
  ended_at,
  total_turns
)
VALUES (
  'YOUR_BUSINESS_ID'::uuid,
  'test-flowchart-greeting-' || extract(epoch from now())::text,
  'active',
  '+1234567891',
  'Test Patient Greeting',
  now() - interval '30 seconds',
  NULL,
  1
);

-- ============================================
-- SCENARIO 3: Call in Intent Detection Phase
-- ============================================
INSERT INTO public.calls (
  business_id,
  call_id,
  status,
  phone,
  patient_name,
  started_at,
  ended_at,
  total_turns,
  last_intent
)
VALUES (
  'YOUR_BUSINESS_ID'::uuid,
  'test-flowchart-intent-' || extract(epoch from now())::text,
  'active',
  '+1234567892',
  'Test Patient Intent',
  now() - interval '1 minute',
  NULL,
  3,
  'information_request'
);

-- ============================================
-- SCENARIO 4: Call Being Handled
-- ============================================
INSERT INTO public.calls (
  business_id,
  call_id,
  status,
  phone,
  patient_name,
  started_at,
  ended_at,
  total_turns,
  last_intent,
  last_summary
)
VALUES (
  'YOUR_BUSINESS_ID'::uuid,
  'test-flowchart-handling-' || extract(epoch from now())::text,
  'active',
  '+1234567893',
  'Test Patient Handling',
  now() - interval '2 minutes',
  NULL,
  5,
  'booking',
  'Patient is asking about available appointment times'
);

-- ============================================
-- SCENARIO 5: Call with Booking (Almost Done)
-- ============================================
INSERT INTO public.calls (
  business_id,
  call_id,
  status,
  phone,
  patient_name,
  started_at,
  ended_at,
  total_turns,
  last_intent,
  last_summary,
  schedule,
  success
)
VALUES (
  'YOUR_BUSINESS_ID'::uuid,
  'test-flowchart-booking-' || extract(epoch from now())::text,
  'active',
  '+1234567894',
  'Test Patient Booking',
  now() - interval '3 minutes',
  NULL,
  8,
  'booking',
  'Appointment scheduled successfully',
  '{"date": "2025-01-15", "time": "10:00 AM", "appointment_type": "Consultation"}'::jsonb,
  true
);

-- ============================================
-- SCENARIO 6: Escalated Call
-- ============================================
INSERT INTO public.calls (
  business_id,
  call_id,
  status,
  phone,
  patient_name,
  started_at,
  ended_at,
  total_turns,
  last_intent,
  last_summary,
  escalate
)
VALUES (
  'YOUR_BUSINESS_ID'::uuid,
  'test-flowchart-escalate-' || extract(epoch from now())::text,
  'active',
  '+1234567895',
  'Test Patient Escalated',
  now() - interval '4 minutes',
  NULL,
  6,
  'complaint',
  'Patient has urgent issue requiring human attention',
  true
);

-- ============================================
-- CLEANUP: Remove Test Calls
-- ============================================
-- DELETE FROM public.calls 
-- WHERE call_id LIKE 'test-flowchart-%';

-- ============================================
-- QUICK TEST: Insert one active call
-- ============================================
INSERT INTO public.calls (
  business_id,
  call_id,
  status,
  phone,
  patient_name,
  started_at,
  ended_at,
  total_turns,
  last_intent
)
VALUES (
  'YOUR_BUSINESS_ID'::uuid,
  'test-flowchart-' || extract(epoch from now())::text,
  'active',
  '+1234567890',
  'Flowchart Test Patient',
  now(),
  NULL,
  2,
  'booking'
)
RETURNING id, call_id, patient_name;
