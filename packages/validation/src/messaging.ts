/**
 * SayMyName Messaging & Safety Invariants (Document 04, Sections 6 & 11)
 */

export const REPORT_REASONS = [
  'IMPERSONATION',
  'HARASSMENT',
  'UNWANTED_SEXUAL_CONTENT',
  'THREATS',
  'SCAMS',
  'LOCATION_STALKING',
  'UNDERAGE_CONCERN',
  'NON_CONSENSUAL_MEDIA',
  'OTHER',
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

export function validateTextMessage(content: string): { valid: boolean; error?: string } {
  const trimmed = content ? content.trim() : '';
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty.' };
  }
  if (trimmed.length > 2000) {
    return { valid: false, error: 'Message cannot exceed 2000 characters.' };
  }
  return { valid: true };
}

export function isValidReportReason(reason: string): reason is ReportReason {
  return REPORT_REASONS.includes(reason as ReportReason);
}
