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

export const MAX_TEXT_MESSAGE_LENGTH = 1000;
export const VOICE_NOTE_MAX_DURATION_SEC = 60;
export const VOICE_NOTE_DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export const ALLOWED_VOICE_NOTE_MIMES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/aac',
] as const;

export function validateTextMessage(
  content: string,
  maxLength: number = MAX_TEXT_MESSAGE_LENGTH,
): { valid: boolean; error?: string } {
  const trimmed = content ? content.trim() : '';
  if (trimmed.length === 0) {
    return { valid: false, error: 'Message cannot be empty.' };
  }
  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `Message cannot exceed ${maxLength} characters.`,
    };
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
