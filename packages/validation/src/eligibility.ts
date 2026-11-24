/**
 * SayMyName Eligibility Invariants (Documents 01, 04, 06 & D-P2-01..D-P2-03)
 * Strict 18+ and approved 4 IIT Madras non-campus BS programmes only.
 */

export const ELIGIBLE_PROGRAMMES = {
  BS_DSA: 'BS in Data Science and Applications',
  BS_ES: 'BS in Electronic Systems',
  BS_AST: 'BS in Aeronautics and Space Technology',
  BS_MDS: 'BS in Management and Data Science',
} as const;

export type EligibleProgrammeCode = keyof typeof ELIGIBLE_PROGRAMMES;

export const RECOGNISED_PATHWAYS = ['FOUNDATION', 'DIPLOMA', 'DEGREE'] as const;
export type RecognisedPathway = (typeof RECOGNISED_PATHWAYS)[number];

export const PATHWAY_CODES = ['foundation', 'diploma', 'degree'] as const;
export type ValidPathwayCode = (typeof PATHWAY_CODES)[number];

/**
 * Centrally maintained strict allowlist of approved IIT Madras non-campus BS study domains (D-P2-03).
 * General campus/faculty domains (e.g., @iitm.ac.in, @smail.iitm.ac.in) are intentionally excluded.
 * Domain matching is an initial eligibility screen only and never grants student verification.
 */
export const APPROVED_IITM_BS_EMAIL_DOMAINS = [
  'study.iitm.ac.in',
  'ds.study.iitm.ac.in',
  'es.study.iitm.ac.in',
] as const;

export function normalizeInstitutionalEmail(email: string): string {
  return String(email || '').toLowerCase().trim();
}

export function isApprovedIitmBsEmail(
  email: string,
  extraAllowedDomains: readonly string[] = [],
): boolean {
  if (typeof email !== 'string') return false;
  const normalized = normalizeInstitutionalEmail(email);
  if (normalized.length < 5 || normalized.length > 254 || /[\s\x00-\x1F\x7F]/.test(normalized)) {
    return false;
  }

  const parts = normalized.split('@');
  if (parts.length !== 2) return false;
  const [localPart, domain] = parts;

  if (!localPart || localPart.length > 64 || localPart.includes('..')) {
    return false;
  }
  if (!/^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?$/.test(localPart)) {
    return false;
  }
  if (!domain) return false;

  const allowedSet = new Set<string>([
    ...APPROVED_IITM_BS_EMAIL_DOMAINS,
    ...extraAllowedDomains
      .map((d) => String(d || '').toLowerCase().trim())
      .filter((d) => d.length > 0 && d.endsWith('study.iitm.ac.in')),
  ]);

  return allowedSet.has(domain);
}

/**
 * Computes completed calendar age in years without Math.abs bugs on future dates.
 * Returns null when input is invalid, non-existent calendar date, pre-1900, or in the future.
 */
export function calculateAgeYears(
  dateOfBirth: Date | string,
  referenceDate: Date = new Date(),
): number | null {
  let year: number;
  let month: number;
  let day: number;

  if (typeof dateOfBirth === 'string') {
    const trimmed = dateOfBirth.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (
      isNaN(check.getTime()) ||
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return null;
    }
  } else {
    if (!(dateOfBirth instanceof Date) || isNaN(dateOfBirth.getTime())) return null;
    year = dateOfBirth.getUTCFullYear();
    month = dateOfBirth.getUTCMonth() + 1;
    day = dateOfBirth.getUTCDate();
  }

  if (year < 1900) return null;

  const refYear = referenceDate.getUTCFullYear();
  const refMonth = referenceDate.getUTCMonth() + 1;
  const refDay = referenceDate.getUTCDate();

  if (
    year > refYear ||
    (year === refYear && (month > refMonth || (month === refMonth && day > refDay)))
  ) {
    return null;
  }

  let age = refYear - year;
  if (refMonth < month || (refMonth === month && refDay < day)) {
    age--;
  }
  return age >= 0 && age <= 125 ? age : null;
}

export function isAdult(dateOfBirth: Date | string, referenceDate: Date = new Date()): boolean {
  const age = calculateAgeYears(dateOfBirth, referenceDate);
  return age !== null && age >= 18;
}

export function isEligibleProgramme(code: string): code is EligibleProgrammeCode {
  return Object.prototype.hasOwnProperty.call(ELIGIBLE_PROGRAMMES, code);
}

export function isRecognisedPathway(pathway: string): pathway is RecognisedPathway {
  return RECOGNISED_PATHWAYS.includes(pathway as RecognisedPathway);
}

export function isValidPathwayCode(code: string): code is ValidPathwayCode {
  return PATHWAY_CODES.includes(String(code || '').toLowerCase().trim() as ValidPathwayCode);
}

export function isPrivateIdentifierLike(value: string): boolean {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  return (
    /^\d{2}[a-zA-Z]\d+$/i.test(trimmed) ||
    trimmed.includes('@') ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) ||
    /^\d+$/.test(trimmed)
  );
}
