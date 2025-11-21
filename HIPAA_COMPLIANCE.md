# HIPAA Compliance Documentation

## Overview

This document outlines the HIPAA compliance measures implemented in the Receptionist Dashboard system. This system is designed to handle Protected Health Information (PHI) for healthcare providers including dental offices and therapy clinics.

## Compliance Status

### ✅ Implemented Controls

#### 1. Technical Safeguards

**Encryption:**
- ✅ All data encrypted in transit (HTTPS/TLS)
- ✅ All data encrypted at rest (Supabase managed)
- ✅ API keys stored securely in environment variables
- ✅ HIPAA hash salt for consistent tokenization

**Access Controls:**
- ✅ Role-based access control (Admin vs User)
- ✅ Row Level Security (RLS) policies in Supabase
- ✅ Multi-tenant data isolation
- ✅ Authentication required for all access

**Audit Logging:**
- ✅ Comprehensive audit log table (`audit_logs`)
- ✅ Tracks all PHI access (view, edit, delete, export)
- ✅ Tracks role changes and user management
- ✅ Tracks data anonymization events
- ✅ Immutable audit trail (no updates/deletes allowed)

**De-identification:**
- ✅ Automatic removal of all 18 HIPAA identifiers
- ✅ Consistent tokenization for patient tracking
- ✅ Smart anonymization (preserves readability while removing PHI)
- ✅ Dual storage (full data for business, anonymized for training)
- ✅ Automatic anonymization after 90-day retention period

**Sensitive Content Handling:**
- ✅ Detection of sensitive content (suicidal ideation, abuse, etc.)
- ✅ Immediate anonymization of sensitive content
- ✅ Separate handling for business view vs training data

#### 2. Administrative Safeguards

**User Management:**
- ✅ Role-based permissions
- ✅ User invitation with role assignment (admin only)
- ✅ Audit logging of all user management actions

**Data Retention:**
- ✅ 90-day retention policy
- ✅ Automatic anonymization after retention period
- ✅ Configurable retention period via `CALL_RETENTION_DAYS`

**Policies:**
- ✅ This documentation
- ✅ Data handling procedures
- ✅ Access control policies

#### 3. Physical Safeguards

**Infrastructure:**
- ✅ Hosted on Supabase (HIPAA-compliant infrastructure)
- ✅ Supabase undergoes annual SOC 2 Type 2 and HIPAA audits
- ✅ Data stored in secure, compliant data centers

## Required Actions for Full Compliance

### 🔴 Critical (Must Complete Before Onboarding Healthcare Clients)

1. **Business Associate Agreement (BAA) with Supabase**
   - [ ] Enable HIPAA add-on in Supabase organization settings
   - [ ] Sign BAA with Supabase
   - [ ] Verify HIPAA compliance mode is active
   - **Status:** Manual action required in Supabase dashboard

### 🟡 High Priority (Should Complete Soon)

2. **Audit Log Review Process**
   - [ ] Set up regular audit log reviews (monthly recommended)
   - [ ] Document review procedures
   - [ ] Assign responsibility for audit log monitoring
   - **Status:** Audit logging implemented, review process needed

3. **Breach Notification Procedures**
   - [ ] Document breach detection procedures
   - [ ] Create incident response plan
   - [ ] Define notification timelines (HIPAA requires within 60 days)
   - [ ] Create breach notification templates
   - **Status:** Documentation needed

4. **Employee Training**
   - [ ] HIPAA training for all team members
   - [ ] Document training completion
   - [ ] Annual refresher training
   - **Status:** Manual process needed

### 🟢 Medium Priority (Best Practices)

5. **Risk Assessment**
   - [ ] Conduct initial risk assessment
   - [ ] Document identified risks and mitigations
   - [ ] Schedule annual risk assessments
   - **Status:** Documentation needed

6. **Backup and Recovery Testing**
   - [ ] Document backup procedures
   - [ ] Test data recovery process
   - [ ] Schedule regular recovery drills
   - [ ] Document business continuity plan
   - **Status:** Documentation and testing needed

7. **Security Incident Response**
   - [ ] Create security incident response plan
   - [ ] Define escalation procedures
   - [ ] Define communication procedures
   - **Status:** Documentation needed

## Environment Variables Required

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# HIPAA Compliance
HIPAA_HASH_SALT=your_secure_random_salt_min_32_chars
CALL_RETENTION_DAYS=90
CRON_SECRET=your_secure_cron_secret
```

## Data Flow and PHI Handling

### Call Data Flow

1. **Incoming Call (Vapi Webhook)**
   - Call data received via webhook
   - PHI extracted (phone, email, name, transcript)
   - Patient hash created for consistent identification
   - Sensitive content detected and flagged

2. **Storage**
   - Full data stored in `calls` table (for business use)
   - Anonymized data stored in `calls_training` table (for ML/training)
   - All PHI fields tokenized in training data

3. **Access**
   - Business users can view full data (with BAA)
   - Training data is fully anonymized
   - All access logged in `audit_logs` table

4. **Retention**
   - Data kept for 90 days in full form
   - After 90 days, automatically anonymized
   - Anonymized data can be kept longer for training

### Anonymization Process

**What Gets Anonymized:**
- Patient names → `NM-{hash}`
- Phone numbers → `PH-{hash}`
- Email addresses → `EM-{hash}`
- Business names → `[BUSINESS_NAME]`
- Dates → `[DATE]`
- Addresses → `[ADDRESS]`
- SSN → `[SSN]`
- Medical record numbers → `[MRN]`
- Ages over 89 → `[AGE]`

**What Stays Readable:**
- Conversation flow and structure
- Common words and phrases
- Service types and intents
- Call outcomes and metrics

## Audit Logging

### What Gets Logged

1. **PHI Access**
   - Viewing calls
   - Viewing transcripts
   - Viewing patient data
   - Exporting data

2. **Data Modifications**
   - Editing business info
   - Editing hours/staff
   - Editing content (FAQs, promos)
   - Anonymizing data

3. **User Management**
   - User invitations
   - Role changes
   - User access grants/revocations

4. **System Events**
   - Login/logout
   - Failed access attempts
   - Anonymization triggers

### Audit Log Schema

```sql
audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID,
  business_id UUID,
  action_type TEXT, -- view, edit, delete, export, anonymize, role_change, invite
  resource_type TEXT, -- call, transcript, patient_data, business_info, user, role
  resource_id TEXT,
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ
)
```

### Querying Audit Logs

```sql
-- View all PHI access for a business
SELECT * FROM audit_logs 
WHERE business_id = 'your-business-id' 
  AND resource_type IN ('call', 'transcript', 'patient_data')
ORDER BY created_at DESC;

-- View all role changes
SELECT * FROM audit_logs 
WHERE action_type = 'role_change'
ORDER BY created_at DESC;

-- View all anonymization events
SELECT * FROM audit_logs 
WHERE action_type = 'anonymize'
ORDER BY created_at DESC;
```

## Access Control

### Role Permissions

**Admin Role:**
- ✅ View all call data and transcripts
- ✅ Edit business information
- ✅ Edit hours and staff
- ✅ Edit content (FAQs, promos)
- ✅ Invite users and assign roles
- ✅ Access AI Insights
- ✅ View audit logs

**User Role:**
- ✅ View call data and transcripts (their business only)
- ❌ Cannot edit business information
- ❌ Cannot edit hours/staff/content
- ✅ Can invite users (but only assign "user" role)
- ❌ Cannot access AI Insights
- ✅ Can view audit logs (their business only)
- ✅ Can personalize their profile

### Data Isolation

- All data is isolated by `business_id`
- Row Level Security (RLS) enforces business-level access
- Users can only access data for their assigned business
- Audit logs track all cross-business access attempts

## Incident Response

### Breach Detection

1. **Automated Monitoring**
   - Review audit logs regularly
   - Monitor for unusual access patterns
   - Alert on failed access attempts

2. **Manual Review**
   - Monthly audit log review
   - Quarterly security assessment
   - Annual comprehensive review

### Breach Notification

If a breach is detected:

1. **Immediate Actions (Within 24 hours)**
   - Contain the breach
   - Assess the scope
   - Document the incident

2. **Notification (Within 60 days)**
   - Notify affected individuals
   - Notify HHS (if 500+ individuals affected)
   - Notify media (if 500+ individuals affected)

3. **Documentation**
   - Document all actions taken
   - Update incident log
   - Review and update procedures

## Compliance Checklist

### Pre-Launch Checklist

- [ ] BAA signed with Supabase
- [ ] HIPAA add-on enabled in Supabase
- [ ] All environment variables set
- [ ] Audit logging tested
- [ ] Access controls tested
- [ ] Anonymization tested
- [ ] Data retention tested
- [ ] Documentation reviewed

### Ongoing Compliance

- [ ] Monthly audit log review
- [ ] Quarterly security assessment
- [ ] Annual risk assessment
- [ ] Annual employee training
- [ ] Annual BAA review
- [ ] Backup and recovery testing
- [ ] Incident response plan review

## Contact Information

For HIPAA compliance questions or to report a security incident:

- **Security Team:** [Your contact information]
- **Supabase Support:** support@supabase.com
- **HHS Breach Portal:** https://ocrportal.hhs.gov/ocr/breach/wizard

## References

- [HIPAA Safe Harbor De-identification](https://www.hhs.gov/hipaa/for-professionals/privacy/special-topics/de-identification/index.html)
- [Supabase HIPAA Compliance](https://supabase.com/docs/guides/security/hipaa-compliance)
- [Supabase Security](https://supabase.com/security)

## Version History

- **v1.0** (2024) - Initial HIPAA compliance implementation
  - Audit logging system
  - Role-based access control
  - De-identification system
  - Documentation

---

**Last Updated:** [Current Date]
**Next Review:** [Date + 1 year]








