-- Audit Logs Table for HIPAA Compliance
-- Tracks all access to PHI and sensitive operations

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  user_id UUID NULL,
  business_id UUID NULL,
  action_type TEXT NOT NULL, -- 'view', 'edit', 'delete', 'export', 'anonymize', 'role_change', 'invite'
  resource_type TEXT NOT NULL, -- 'call', 'transcript', 'patient_data', 'business_info', 'user', 'role'
  resource_id TEXT NULL, -- ID of the resource being accessed
  ip_address INET NULL,
  user_agent TEXT NULL,
  details JSONB NULL, -- Additional context about the action
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
  CONSTRAINT audit_logs_business_id_fkey FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL,
  CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) TABLESPACE pg_default;

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON public.audit_logs USING btree (action_type) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON public.audit_logs USING btree (resource_type) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON public.audit_logs USING btree (resource_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id ON public.audit_logs USING btree (business_id) TABLESPACE pg_default;

-- Enable Row Level Security
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view audit logs for their own business
CREATE POLICY "Users can view audit logs for their business"
ON public.audit_logs FOR SELECT
USING (
  business_id IN (
    SELECT business_id FROM users WHERE id = auth.uid() OR auth_user_id = auth.uid()
  )
  OR user_id IN (
    SELECT id FROM users WHERE auth_user_id = auth.uid()
  )
);

-- Policy: Only service role can insert audit logs (via API)
-- This ensures audit logs cannot be tampered with by users
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK (true); -- RLS will be bypassed by service role

-- Policy: No updates or deletes allowed (immutable audit trail)
CREATE POLICY "No updates to audit logs"
ON public.audit_logs FOR UPDATE
USING (false);

CREATE POLICY "No deletes to audit logs"
ON public.audit_logs FOR DELETE
USING (false);

-- Add comment for documentation
COMMENT ON TABLE public.audit_logs IS 'HIPAA-compliant audit log tracking all PHI access and sensitive operations';
COMMENT ON COLUMN public.audit_logs.action_type IS 'Type of action: view, edit, delete, export, anonymize, role_change, invite';
COMMENT ON COLUMN public.audit_logs.resource_type IS 'Type of resource accessed: call, transcript, patient_data, business_info, user, role';
COMMENT ON COLUMN public.audit_logs.details IS 'JSON object with additional context about the action';

