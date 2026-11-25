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

export function formatRelativeDayLabel(
  isoString: string,
  referenceDate: Date = new Date(),
): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return 'Recently';
  }

  const refDay = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );
  const itemDay = Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  );
  const dayDiff = Math.floor((refDay - itemDay) / (24 * 60 * 60 * 1000));

  if (dayDiff <= 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  if (dayDiff < 7) return `${dayDiff} days ago`;

  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}
