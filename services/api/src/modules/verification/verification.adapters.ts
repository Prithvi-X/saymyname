import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  calculateAgeYears,
  isValidPathwayCode,
  ValidPathwayCode,
} from '@saymyname/validation';
import { ProgrammeFamily } from '@saymyname/contracts';

export const APPROVED_PROGRAMMES: readonly ProgrammeFamily[] = [
  ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
  ProgrammeFamily.ELECTRONIC_SYSTEMS,
  ProgrammeFamily.AERONAUTICS_SPACE,
  ProgrammeFamily.MANAGEMENT_DATA_SCIENCE,
] as const;

export const ALLOWED_NON_GOV_EVIDENCE_TYPES = [
  'student_enrolment_letter',
  'iitm_portal_screenshot',
  'term_fee_receipt',
] as const;

export type AllowedEvidenceType = (typeof ALLOWED_NON_GOV_EVIDENCE_TYPES)[number];

const PROHIBITED_GOV_ID_PATTERN =
  /(aadhaar|aadhar|pan[_\-\s]?card|passport|voter[_\-\s]?id|driving[_\-\s]?licen|gov[_\-\s]?id|government[_\-\s]?id|national[_\-\s]?id|ssn)/i;

export function assertNoProhibitedGovIdReference(value?: string | null): void {
  if (!value) return;
  if (PROHIBITED_GOV_ID_PATTERN.test(value)) {
    throw new BadRequestException(
      'Government ID documents or numbers must not be submitted in Phase 2 until lawful verification governance is approved (D-P2-01).',
    );
  }
}

export function assertProductionAutoVerificationDisabled(): void {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.SYNTHETIC_VERIFICATION_AUTO_APPROVE === 'true'
  ) {
    throw new ForbiddenException(
      'Automatic verification is strictly disabled in production (D-P2-01).',
    );
  }
}

export interface AgeEvaluationInput {
  dateOfBirth: string;
}

export interface AgeEvaluationResult {
  providerCode: string;
  status: 'pending' | 'rejected';
  isAdultAssertionValid: boolean;
  calculatedAge: number;
  reasonCode: string | null;
}

export interface AgeVerificationAdapter {
  readonly providerCode: string;
  evaluateSubmission(input: AgeEvaluationInput): Promise<AgeEvaluationResult>;
}

/**
 * ManualReviewAgeAdapter (D-P2-01 / ADR-017)
 * Boundary adapter performing strict calendar DOB >= 18 validation and routing to internal human review.
 * Note: This is NOT an external third-party age-verification integration; external integration remains future Phase work.
 */
export class ManualReviewAgeAdapter implements AgeVerificationAdapter {
  readonly providerCode = 'manual_review';

  async evaluateSubmission(input: AgeEvaluationInput): Promise<AgeEvaluationResult> {
    assertNoProhibitedGovIdReference(input.dateOfBirth);
    assertProductionAutoVerificationDisabled();

    const age = calculateAgeYears(input.dateOfBirth);
    if (age === null) {
      throw new BadRequestException(
        'Invalid date of birth. Use valid YYYY-MM-DD calendar format (1900 to present).',
      );
    }

    if (age < 18) {
      return {
        providerCode: this.providerCode,
        status: 'rejected',
        isAdultAssertionValid: false,
        calculatedAge: age,
        reasonCode: 'under_minimum_age',
      };
    }

    return {
      providerCode: this.providerCode,
      status: 'pending',
      isAdultAssertionValid: true,
      calculatedAge: age,
      reasonCode: null,
    };
  }
}

export interface StudentEvaluationInput {
  programmeFamily: string;
  pathwayCode: string;
  institutionalReference?: string;
}

export interface StudentEvaluationResult {
  providerCode: string;
  status: 'pending';
  programmeFamily: ProgrammeFamily;
  pathwayCode: ValidPathwayCode;
  reasonCode: string | null;
}

export interface StudentEnrolmentAdapter {
  readonly providerCode: string;
  evaluateSubmission(input: StudentEvaluationInput): Promise<StudentEvaluationResult>;
}

/**
 * ManualReviewStudentEnrolmentAdapter (D-P2-01 / ADR-017)
 * Boundary adapter validating the 4 Phase 1 BS families & academic pathway and creating a pending manual review case.
 * Note: This is NOT a live IITM API/external third-party integration; manual human review unlocks eligibility.
 */
export class ManualReviewStudentEnrolmentAdapter implements StudentEnrolmentAdapter {
  readonly providerCode = 'manual_review';

  async evaluateSubmission(input: StudentEvaluationInput): Promise<StudentEvaluationResult> {
    assertNoProhibitedGovIdReference(input.institutionalReference);
    assertProductionAutoVerificationDisabled();

    const programme = input.programmeFamily as ProgrammeFamily;
    if (!APPROVED_PROGRAMMES.includes(programme)) {
      throw new BadRequestException(
        `Invalid programme track. Phase 1 is strictly restricted to the four approved families: ${APPROVED_PROGRAMMES.join(', ')}`,
      );
    }

    const normalizedPathway = String(input.pathwayCode || '').toLowerCase().trim();
    if (!isValidPathwayCode(normalizedPathway)) {
      throw new BadRequestException(
        'Academic level (pathwayCode) must be one of: foundation, diploma, degree.',
      );
    }

    return {
      providerCode: this.providerCode,
      status: 'pending',
      programmeFamily: programme,
      pathwayCode: normalizedPathway,
      reasonCode: null,
    };
  }
}
