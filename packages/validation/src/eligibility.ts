/**
 * SayMyName Eligibility Invariants (Documents 01, 04, 06)
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

export function isAdult(dateOfBirth: Date | string, referenceDate: Date = new Date()): boolean {
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  if (isNaN(dob.getTime())) return false;

  const ageDifMs = referenceDate.getTime() - dob.getTime();
  const ageDate = new Date(ageDifMs);
  const calculatedAge = Math.abs(ageDate.getUTCFullYear() - 1970);

  return calculatedAge >= 18;
}

export function isEligibleProgramme(code: string): code is EligibleProgrammeCode {
  return Object.prototype.hasOwnProperty.call(ELIGIBLE_PROGRAMMES, code);
}

export function isRecognisedPathway(pathway: string): pathway is RecognisedPathway {
  return RECOGNISED_PATHWAYS.includes(pathway as RecognisedPathway);
}
