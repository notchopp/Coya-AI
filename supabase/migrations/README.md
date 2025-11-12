# Supabase Migrations

## Running Migrations

### Create Audit Logs Table

To set up the audit logging system for HIPAA compliance, run the migration:

```sql
-- Run this in Supabase SQL Editor or via CLI
\i supabase/migrations/create_audit_logs.sql
```

Or via Supabase CLI:
```bash
supabase db push
```

## Migration Files

### `create_audit_logs.sql`
Creates the `audit_logs` table for HIPAA-compliant audit logging.

**Features:**
- Tracks all PHI access (view, edit, delete, export)
- Tracks role changes and user management
- Tracks data anonymization events
- Immutable audit trail (no updates/deletes allowed)
- Row Level Security (RLS) policies
- Indexed for efficient querying

**Required for:**
- HIPAA compliance
- Security auditing
- Compliance reporting


