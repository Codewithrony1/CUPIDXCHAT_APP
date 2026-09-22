/**
 * Centralized policy versions, operator legal statements, and compliance constants for CupidXChat.
 * Updating versions here allows the system to identify users on older versions
 * and require re-acceptance when material policy updates occur.
 */

// Operator / Legal Identity
export const OPERATOR_NAME = 'Lexino Technologies';
export const OPERATOR_LEGAL_STATEMENT = 'Lexino Technologies operates CupidxChat.';
export const OPERATOR_ADDRESS_PLACEHOLDER = '[Operator Business Address To Be Configured by Lexino Technologies]';

// Official Contact Channels (Configurable via Environment Variables)
export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@cupidxchat.in';
export const PRIVACY_CONTACT_EMAIL = process.env.PRIVACY_CONTACT_EMAIL || 'privacy@cupidxchat.in';
export const PAYMENT_SUPPORT_EMAIL = process.env.PAYMENT_SUPPORT_EMAIL || 'billing@cupidxchat.in';
export const ABUSE_REPORT_EMAIL = process.env.ABUSE_REPORT_EMAIL || 'safety@cupidxchat.in';

// Eligibility
export const MINIMUM_LEGAL_AGE = 18;

// Policy Versions
export const CURRENT_TERMS_VERSION = '2026-09-19';
export const CURRENT_PRIVACY_VERSION = '2026-09-19';
export const CURRENT_REFUND_VERSION = '2026-09-19';

// Effective Dates
export const TERMS_EFFECTIVE_DATE = 'September 19, 2026';
export const PRIVACY_EFFECTIVE_DATE = 'September 19, 2026';
export const REFUND_EFFECTIVE_DATE = 'September 19, 2026';

// 48-Hour Re-Registration Restriction (Product Security / Anti-Abuse)
export const DELETION_LOCK_TTL_HOURS = 48;
export const DELETION_LOCK_TTL_MS = DELETION_LOCK_TTL_HOURS * 60 * 60 * 1000;

// Data Retention Guidelines
export const DATA_RETENTION_POLICIES = {
  ephemeralChats: 'Zero retention. Messages are destroyed immediately upon chat session termination or skipping.',
  accountProfile: 'Retained until the user requests permanent account deletion via Settings.',
  consentRecords: 'Retained as authoritative legal audit proof of user agreement and versioning.',
  technicalSecurityLogs: 'Technical telemetry (e.g. rate limit counters) expires automatically via sliding time windows.',
  statutoryFinancialRecords: 'Payment transaction metadata retained for statutory tax/accounting reconciliation (7 years).',
  deletionCooldownTombstone: 'Temporary HMAC-SHA256 deletion lock expires automatically after 48 hours.',
};
