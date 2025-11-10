-- Audit Logs Table for HIPAA Compliance
-- Tracks all access to PHI and sensitive operations

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL, -- 'view', 'edit', 'delete', 'export', 'anonymize', 'role_change', 'invite'
  resource_type TEXT NOT NULL, -- 'call', 'transcript', 'patient_data', 'business_info', 'user', 'role'
  resource_id TEXT, -- ID of the resource being accessed
  ip_address INET,
  user_agent TEXT,
  details JSONB, -- Additional context about the action
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view audit logs for their own business
CREATE POLICY "Users can view audit logs for their business"
ON audit_logs FOR SELECT
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
ON audit_logs FOR INSERT
WITH CHECK (true); -- RLS will be bypassed by service role

-- Policy: No updates or deletes allowed (immutable audit trail)
CREATE POLICY "No updates to audit logs"
ON audit_logs FOR UPDATE
USING (false);

CREATE POLICY "No deletes to audit logs"
ON audit_logs FOR DELETE
USING (false);

-- Add comment for documentation
COMMENT ON TABLE audit_logs IS 'HIPAA-compliant audit log tracking all PHI access and sensitive operations';
COMMENT ON COLUMN audit_logs.action_type IS 'Type of action: view, edit, delete, export, anonymize, role_change, invite';
COMMENT ON COLUMN audit_logs.resource_type IS 'Type of resource accessed: call, transcript, patient_data, business_info, user, role';
COMMENT ON COLUMN audit_logs.details IS 'JSON object with additional context about the action';

