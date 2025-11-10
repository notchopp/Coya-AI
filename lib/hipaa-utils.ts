import { createHash } from "crypto";

// Secret salt for hashing (should be from env in production)
const HASH_SALT = process.env.HIPAA_HASH_SALT || "default-salt-change-in-production";

/**
 * Creates a consistent token for a value (same value = same token)
 * Used for phone, email, names - allows identification without exposing PHI
 */
export function createConsistentToken(value: string | null, type: 'phone' | 'email' | 'name'): string | null {
  if (!value) return null;
  
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  
  const hash = createHash('sha256')
    .update(`${HASH_SALT}-${type}-${normalized}`)
    .digest('hex')
    .substring(0, 8); // 8 char token
  
  // Format tokens for readability while maintaining consistency
  switch (type) {
    case 'phone':
      return `PH-${hash}`;
    case 'email':
      return `EM-${hash}`;
    case 'name':
      return `NM-${hash}`;
    default:
      return hash;
  }
}

/**
 * Anonymizes specific names in transcript (only known names, not common words)
 */
function anonymizeKnownNames(transcript: string, namesToAnonymize: string[]): string {
  if (!transcript || namesToAnonymize.length === 0) return transcript;
  
  let anonymized = transcript;
  const nameCache = new Map<string, string>();
  
  // Anonymize each known name
  for (const name of namesToAnonymize) {
    if (!name || name.trim().length === 0) continue;
    
    const trimmedName = name.trim();
    // Create token for this name
    if (!nameCache.has(trimmedName)) {
      nameCache.set(trimmedName, createConsistentToken(trimmedName, 'name') || '[NAME]');
    }
    const token = nameCache.get(trimmedName) || '[NAME]';
    
    // Replace the name (case-insensitive, whole word only)
    // Handle both full name and individual words
    const nameWords = trimmedName.split(/\s+/);
    
    if (nameWords.length > 1) {
      // Full name - replace as phrase
      const namePattern = new RegExp(`\\b${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      anonymized = anonymized.replace(namePattern, token);
    } else {
      // Single word name - be more careful (whole word only)
      const namePattern = new RegExp(`\\b${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      anonymized = anonymized.replace(namePattern, token);
    }
  }
  
  return anonymized;
}

/**
 * HIPAA-compliant transcript de-identification
 * Removes all 18 HIPAA identifiers while preserving structure for training
 * @param transcript - The transcript text to de-identify
 * @param knownNames - Optional array of known names to anonymize (patient name, business name, etc.)
 */
export function deidentifyTranscript(transcript: string | null, knownNames?: string[]): string | null {
  if (!transcript) return transcript;
  
  let deidentified = transcript;
  
  // 1. Remove phone numbers (HIPAA identifier #4)
  deidentified = deidentified.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
  deidentified = deidentified.replace(/\b\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]');
  deidentified = deidentified.replace(/\b\d{10,}\b/g, '[PHONE]');
  
  // 2. Remove fax numbers (HIPAA identifier #5)
  deidentified = deidentified.replace(/\bfax[:\s]?\d{3}[-.]?\d{3}[-.]?\d{4}\b/gi, '[FAX]');
  
  // 3. Remove email addresses (HIPAA identifier #6)
  deidentified = deidentified.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
  
  // 4. Remove SSN (HIPAA identifier #7)
  deidentified = deidentified.replace(/\b\d{3}-?\d{2}-?\d{4}\b/g, '[SSN]');
  deidentified = deidentified.replace(/\b\d{9}\b/g, (match) => {
    return match.length === 9 ? '[SSN]' : match;
  });
  
  // 5. Remove URLs (HIPAA identifier #14)
  deidentified = deidentified.replace(/https?:\/\/[^\s]+/gi, '[URL]');
  deidentified = deidentified.replace(/\bwww\.[^\s]+/gi, '[URL]');
  
  // 6. Remove IP addresses (HIPAA identifier #15)
  deidentified = deidentified.replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[IP]');
  
  // 7. Remove dates (HIPAA identifier #3)
  deidentified = deidentified.replace(/\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, '[DATE]');
  deidentified = deidentified.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi, '[DATE]');
  deidentified = deidentified.replace(/\b\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}\b/g, '[DATE]');
  
  // 8. Remove ages over 89 (HIPAA identifier #3)
  deidentified = deidentified.replace(/\b(9[0-9]|[1-9]\d{2,})\s*(?:years?\s*old|yrs?\.?|years?)\b/gi, '[AGE]');
  
  // 9. Anonymize known names and business names (HIPAA identifier #1)
  // Only anonymize the specific names provided, not common words
  if (knownNames && knownNames.length > 0) {
    deidentified = anonymizeKnownNames(deidentified, knownNames);
  }
  
  // 10. Remove addresses (HIPAA identifier #2)
  deidentified = deidentified.replace(/\b\d+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Circle|Cir|Way|Place|Pl)\b/gi, '[ADDRESS]');
  
  // 11. Remove ZIP codes
  deidentified = deidentified.replace(/\b\d{5}(?:-\d{4})?\b/g, '[ZIP]');
  
  // 12. Remove medical record numbers (HIPAA identifier #8)
  deidentified = deidentified.replace(/\b(?:MRN|MR|Medical Record)[:\s#]?\s*\d+\b/gi, '[MRN]');
  deidentified = deidentified.replace(/\b(?:Record|Account)[:\s#]?\s*#?\s*\d{4,}\b/gi, '[RECORD]');
  
  // 13. Remove account numbers (HIPAA identifier #10)
  deidentified = deidentified.replace(/\b(?:Account|Acct)[:\s#]?\s*#?\s*\d{4,}\b/gi, '[ACCOUNT]');
  
  // 14. Remove certificate/license numbers (HIPAA identifier #11)
  deidentified = deidentified.replace(/\b(?:License|Cert|Certificate)[:\s#]?\s*#?\s*[A-Z0-9]{4,}\b/gi, '[LICENSE]');
  
  return deidentified;
}

/**
 * HIPAA-compliant phone de-identification with consistent tokenization
 */
export function deidentifyPhone(phone: string | null): string | null {
  if (!phone) return null;
  return createConsistentToken(phone, 'phone');
}

/**
 * HIPAA-compliant email de-identification with consistent tokenization
 */
export function deidentifyEmail(email: string | null): string | null {
  if (!email) return null;
  return createConsistentToken(email, 'email');
}

/**
 * HIPAA-compliant name de-identification with consistent tokenization
 */
export function deidentifyName(name: string | null): string | null {
  if (!name) return null;
  return createConsistentToken(name, 'name');
}

