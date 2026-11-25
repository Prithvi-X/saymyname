import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchAuthorizationService } from '../safety/match-authorization.service';
import {
  AgeVerificationAdapter,
  StudentEnrolmentAdapter,
  ManualReviewAgeAdapter,
  ManualReviewStudentEnrolmentAdapter,
  ALLOWED_NON_GOV_EVIDENCE_TYPES,
  assertNoProhibitedGovIdReference,
  assertProductionAutoVerificationDisabled,
} from './verification.adapters';
import {
  SubmitAgeVerificationDto,
  SubmitStudentVerificationDto,
  PresignEvidenceUploadDto,
  ReviewerDecisionDto,
  ReviewerQueueQueryDto,
} from './dto/verification.dto';

@Injectable()
export class VerificationService {
  private readonly ageAdapter: AgeVerificationAdapter = new ManualReviewAgeAdapter();
  private readonly studentAdapter: StudentEnrolmentAdapter =
    new ManualReviewStudentEnrolmentAdapter();
  private readonly matchAuth: MatchAuthorizationService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() matchAuthService?: MatchAuthorizationService,
  ) {
    this.matchAuth = matchAuthService ?? new MatchAuthorizationService(this.prisma);
  }

  private createR2Client(): { client: S3Client; bucket: string } | null {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET_NAME;
    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      return null;
    }
    return {
      bucket,
      client: new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      }),
    };
  }

  private throwVerificationPersistenceError(step: string, err: unknown): never {
    if (
      err instanceof ForbiddenException ||
      err instanceof BadRequestException ||
      err instanceof NotFoundException ||
      err instanceof ServiceUnavailableException
    ) {
      throw err;
    }
    const prismaCode =
      err && typeof err === 'object' && 'code' in err && typeof (err as any).code === 'string'
        ? (err as any).code
        : undefined;
    const errName =
      err && typeof err === 'object' && 'name' in err && typeof (err as any).name === 'string'
        ? (err as any).name
        : 'Error';
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[VerificationService] ${step} transaction failed (${prismaCode || errName}): ${errMsg}`,
    );
    throw new ServiceUnavailableException(
      `Unable to save ${step} (${prismaCode || errName}).`,
    );
  }

  /**
   * Step 3: Age Verification Submission (D-P2-01)
   * Self-declared DOB never grants ageStatus = 'approved'; valid 18+ assertions move to pending review.
   * Under-18 submissions are strictly rejected with 403 and persisted as rejected.
   */
  async submitAgeVerification(accountId: string, dto: SubmitAgeVerificationDto) {
    assertProductionAutoVerificationDisabled();
    const evaluation = await this.ageAdapter.evaluateSubmission({
      dateOfBirth: dto.dateOfBirth,
    });
    const dobMatch = dto.dateOfBirth?.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const parsedDob = dobMatch
      ? new Date(Date.UTC(Number(dobMatch[1]), Number(dobMatch[2]) - 1, Number(dobMatch[3])))
      : null;

    if (evaluation.status === 'rejected') {
      await this.prisma.$transaction(async (tx) => {
        await tx.accountEligibility.upsert({
          where: { accountId },
          create: {
            accountId,
            ageStatus: 'rejected',
            studentStatus: 'not_started',
            dateOfBirth: parsedDob,
            discoveryEligible: false,
            verifiedBy: null,
            verifiedAt: null,
          },
          update: {
            ageStatus: 'rejected',
            dateOfBirth: parsedDob,
            discoveryEligible: false,
            verifiedBy: null,
            verifiedAt: null,
          },
        });
        await tx.account.update({
          where: { id: accountId },
          data: { accountStatus: 'pending_verification' },
        });
        await this.matchAuth.invalidateActiveMatchesForAccount(tx, accountId, {
          reasonCode: 'verification_revoked',
          actorId: accountId,
          metadata: { checkType: 'age', decision: 'rejected' },
        });
        await tx.verificationCase.create({
          data: {
            accountId,
            checkType: 'age',
            providerCode: evaluation.providerCode,
            status: 'rejected',
            reasonCode: evaluation.reasonCode,
            decidedAt: new Date(),
            reviewedAt: new Date(),
            rejectionReason: 'Submitted age does not meet the strict 18+ minimum requirement.',
          },
        });
        await tx.auditEvent.create({
          data: {
            actorId: accountId,
            action: 'verification.age_rejected_under18',
            resourceType: 'verification_case',
            metadata: { checkType: 'age', reasonCode: evaluation.reasonCode },
          },
        });
      }).catch(() => null);

      throw new ForbiddenException(
        `Under-18 access rejected. You are currently ${evaluation.calculatedAge} years old. SayMyName is strictly for verified adults (18+) per Document 01.`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const eligibility = await tx.accountEligibility.upsert({
        where: { accountId },
        create: {
          accountId,
          ageStatus: 'pending',
          studentStatus: 'not_started',
          dateOfBirth: parsedDob,
          discoveryEligible: false,
          verifiedBy: null,
          verifiedAt: null,
        },
        update: {
          ageStatus: 'pending',
          dateOfBirth: parsedDob,
          discoveryEligible: false,
          ageVerifiedAt: null,
          verifiedAt: null,
          verifiedBy: null,
        },
        include: { account: { select: { id: true, email: true, accountStatus: true } } },
      });

      await tx.account.update({
        where: { id: accountId },
        data: { accountStatus: 'pending_verification' },
      });

      await this.matchAuth.invalidateActiveMatchesForAccount(tx, accountId, {
        reasonCode: 'verification_revoked',
        actorId: accountId,
        metadata: { checkType: 'age', decision: 'pending' },
      });

      const vCase = await tx.verificationCase.create({
        data: {
          accountId,
          checkType: 'age',
          providerCode: evaluation.providerCode,
          status: 'pending',
        },
      });

      await tx.auditEvent.create({
        data: {
          actorId: accountId,
          action: 'verification.age_submitted',
          resourceType: 'verification_case',
          resourceId: vCase.id,
          metadata: { checkType: 'age', providerCode: evaluation.providerCode },
        },
      });

      return { eligibility, vCase };
    }).catch((err) => this.throwVerificationPersistenceError('age verification check', err));

    return {
      message:
        'Age eligibility assertion submitted for verification review. Self-declared age does not unlock discovery until approved.',
      isAdult: true,
      calculatedAge: evaluation.calculatedAge,
      ageStatus: 'pending',
      verificationPendingReview: true,
      caseId: result.vCase.id,
      eligibility: result.eligibility,
    };
  }

  /**
   * Step 4: Student Enrolment Verification Submission (D-P2-01)
   * Requires completed non-rejected age submission first, enforces 4 BS families + pathwayCode,
   * prohibits government ID docs, and leaves studentStatus in pending review until reviewer/provider confirmation.
   */
  async submitStudentEnrolmentVerification(
    accountId: string,
    dto: SubmitStudentVerificationDto,
  ) {
    assertProductionAutoVerificationDisabled();
    assertNoProhibitedGovIdReference(dto.evidenceType);
    assertNoProhibitedGovIdReference(dto.evidenceObjectKey);
    assertNoProhibitedGovIdReference(dto.studentRollNo);

    const evaluation = await this.studentAdapter.evaluateSubmission({
      programmeFamily: dto.programmeFamily,
      pathwayCode: dto.pathwayCode,
      institutionalReference: dto.studentRollNo,
    });

    const current = await this.prisma.accountEligibility
      .findUnique({ where: { accountId } })
      .catch(() => null);

    if (current) {
      if (current.ageStatus === 'rejected') {
        throw new ForbiddenException(
          'Under-18 accounts are permanently ineligible for Phase 1 student verification.',
        );
      }
      if (current.ageStatus === 'not_started') {
        throw new ForbiddenException(
          'Complete 18+ age verification before submitting IIT Madras BS student enrolment.',
        );
      }
    }

    if (dto.evidenceObjectKey) {
      const expectedPrefix = `verification-evidence/${accountId}/`;
      if (!dto.evidenceObjectKey.startsWith(expectedPrefix)) {
        throw new BadRequestException('Invalid verification evidence key ownership.');
      }
      if (
        !dto.evidenceType ||
        !(ALLOWED_NON_GOV_EVIDENCE_TYPES as readonly string[]).includes(dto.evidenceType)
      ) {
        throw new BadRequestException(
          `Allowed evidenceType values: ${ALLOWED_NON_GOV_EVIDENCE_TYPES.join(', ')}`,
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const eligibility = await tx.accountEligibility.upsert({
        where: { accountId },
        create: {
          accountId,
          ageStatus: current?.ageStatus || 'pending',
          studentStatus: 'pending',
          programmeFamily: evaluation.programmeFamily,
          pathwayCode: evaluation.pathwayCode,
          discoveryEligible: false,
          verifiedBy: null,
          verifiedAt: null,
          reviewNotes: `pathway:${evaluation.pathwayCode}`,
        },
        update: {
          programmeFamily: evaluation.programmeFamily,
          pathwayCode: evaluation.pathwayCode,
          studentStatus: 'pending',
          discoveryEligible: false,
          studentVerifiedAt: null,
          verifiedAt: null,
          verifiedBy: null,
          reviewNotes: `pathway:${evaluation.pathwayCode}`,
        },
        include: { account: { select: { id: true, email: true, accountStatus: true } } },
      });

      await tx.account.update({
        where: { id: accountId },
        data: { accountStatus: 'pending_verification' },
      });

      await this.matchAuth.invalidateActiveMatchesForAccount(tx, accountId, {
        reasonCode: 'verification_revoked',
        actorId: accountId,
        metadata: { checkType: 'age', decision: 'pending' },
      });

      const vCase = await tx.verificationCase.create({
        data: {
          accountId,
          checkType: 'student_enrolment',
          providerCode: evaluation.providerCode,
          status: 'pending',
        },
      });

      if (dto.evidenceObjectKey && dto.evidenceType) {
        const retentionUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await tx.verificationEvidenceRef.create({
          data: {
            caseId: vCase.id,
            evidenceType: dto.evidenceType,
            s3Key: dto.evidenceObjectKey,
            mimeType: dto.evidenceMimeType || 'application/pdf',
            fileSizeBytes: dto.evidenceSizeBytes || 0,
            sha256: dto.evidenceSha256 || null,
            retentionUntil,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          actorId: accountId,
          action: 'verification.student_submitted',
          resourceType: 'verification_case',
          resourceId: vCase.id,
          metadata: {
            checkType: 'student_enrolment',
            programmeFamily: evaluation.programmeFamily,
            pathwayCode: evaluation.pathwayCode,
            hasEvidence: Boolean(dto.evidenceObjectKey),
          },
        },
      });

      return { eligibility, vCase };
    }).catch((err) => this.throwVerificationPersistenceError('student enrolment check', err));

    return {
      message:
        'Student enrolment case submitted and awaiting verification review. Institutional email domain alone does not grant verification.',
      studentStatus: 'pending',
      discoveryEligible: false,
      verificationPendingReview: true,
      caseId: result.vCase.id,
      eligibility: result.eligibility,
    };
  }

  /**
   * Presigned Private R2 Upload URL for Non-Gov-ID Institutional Enrolment Evidence
   */
  async presignEvidenceUpload(accountId: string, dto: PresignEvidenceUploadDto) {
    assertNoProhibitedGovIdReference(dto.evidenceType);

    if (!(ALLOWED_NON_GOV_EVIDENCE_TYPES as readonly string[]).includes(dto.evidenceType)) {
      throw new BadRequestException(
        `Invalid evidenceType. Phase 2 permits only non-government-ID institutional evidence: ${ALLOWED_NON_GOV_EVIDENCE_TYPES.join(', ')}`,
      );
    }

    const s3Key = `verification-evidence/${accountId}/${crypto.randomUUID()}`;
    const r2 = this.createR2Client();

    if (!r2) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException(
          'Private verification evidence storage is not configured.',
        );
      }
      return {
        uploadUrl: null,
        adapterMode: 'local_stub_non_prod',
        s3Key,
        evidenceType: dto.evidenceType,
        expiresInSeconds: 300,
      };
    }

    const command = new PutObjectCommand({
      Bucket: r2.bucket,
      Key: s3Key,
      ContentType: dto.mimeType,
      ContentLength: dto.fileSizeBytes,
    });

    const uploadUrl = await getSignedUrl(r2.client, command, { expiresIn: 300 });
    return {
      uploadUrl,
      adapterMode: 'r2_presigned_put',
      s3Key,
      evidenceType: dto.evidenceType,
      expiresInSeconds: 300,
    };
  }

  private maskEmailForReviewer(email: string): { maskedEmail: string; domain: string } {
    const [localPart = '', domain = ''] = email.split('@');
    const visible = localPart.slice(0, Math.min(2, localPart.length));
    return {
      maskedEmail: `${visible}***@${domain}`,
      domain,
    };
  }

  /**
   * Authorised Human Reviewer Queue (D-P2-01)
   * Explicitly operates in manual_review_only mode (no external third-party verification integration).
   * Returns only open verification cases with redacted institutional metadata (never raw student roll or s3Key).
   */
  async getPendingQueue(reviewerPrincipalId: string, query: ReviewerQueueQueryDto = {}) {
    const statusFilter =
      query.status === 'pending'
        ? ['pending']
        : query.status === 'needs_information'
          ? ['needs_information']
          : ['pending', 'needs_information'];

    const cases = await this.prisma.verificationCase.findMany({
      where: {
        status: { in: statusFilter },
        ...(query.checkType ? { checkType: query.checkType } : {}),
      },
      orderBy: { submittedAt: 'asc' },
      take: 100,
      include: {
        account: {
          select: {
            id: true,
            email: true,
            accountStatus: true,
            eligibility: {
              select: {
                ageStatus: true,
                studentStatus: true,
                programmeFamily: true,
                pathwayCode: true,
                discoveryEligible: true,
              },
            },
          },
        },
        evidence: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            evidenceType: true,
            mimeType: true,
            fileSizeBytes: true,
            uploadedAt: true,
            retentionUntil: true,
          },
        },
      },
    });

    await this.prisma.auditEvent.create({
      data: {
        actorId: null,
        action: 'verification.queue_viewed',
        resourceType: 'verification_queue',
        resourceId: null,
        metadata: {
          reviewerPrincipalId,
          statusFilter,
          checkType: query.checkType || 'all',
          returnedCount: cases.length,
        },
      },
    });

    return {
      integrationMode: 'manual_review_only_no_external_provider',
      totalReturned: cases.length,
      cases: cases.map((c) => {
        const emailMeta = this.maskEmailForReviewer(c.account.email);
        return {
          id: c.id,
          accountId: c.accountId,
          checkType: c.checkType,
          providerCode: c.providerCode,
          status: c.status,
          reasonCode: c.reasonCode,
          submittedAt: c.submittedAt.toISOString(),
          maskedEmail: emailMeta.maskedEmail,
          emailDomain: emailMeta.domain,
          accountStatus: c.account.accountStatus,
          eligibility: c.account.eligibility
            ? {
                ageStatus: c.account.eligibility.ageStatus,
                studentStatus: c.account.eligibility.studentStatus,
                programmeFamily: c.account.eligibility.programmeFamily,
                pathwayCode: c.account.eligibility.pathwayCode,
                discoveryEligible: c.account.eligibility.discoveryEligible,
              }
            : null,
          evidence: c.evidence.map((ev) => ({
            id: ev.id,
            evidenceType: ev.evidenceType,
            mimeType: ev.mimeType,
            fileSizeBytes: ev.fileSizeBytes,
            uploadedAt: ev.uploadedAt.toISOString(),
            retentionUntil: ev.retentionUntil ? ev.retentionUntil.toISOString() : null,
          })),
        };
      }),
    };
  }

  /**
   * Short-lived authorised reviewer fetch URL (never exposed to public/member DTOs)
   */
  async getReviewerEvidenceReadUrl(evidenceId: string, reviewerPrincipalId = 'authorised_reviewer') {
    const ref = await this.prisma.verificationEvidenceRef.findUnique({
      where: { id: evidenceId },
    });
    if (!ref || ref.deletedAt || (ref.retentionUntil && ref.retentionUntil < new Date())) {
      throw new NotFoundException('Verification evidence not found or expired.');
    }
    const r2 = this.createR2Client();
    if (!r2) {
      throw new ServiceUnavailableException('Private evidence storage is not configured.');
    }
    const url = await getSignedUrl(
      r2.client,
      new GetObjectCommand({ Bucket: r2.bucket, Key: ref.s3Key }),
      { expiresIn: 120 },
    );

    await this.prisma.auditEvent.create({
      data: {
        actorId: null,
        action: 'verification.evidence_url_issued',
        resourceType: 'verification_evidence',
        resourceId: ref.id,
        metadata: {
          reviewerPrincipalId,
          caseId: ref.caseId,
          expiresInSeconds: 120,
        },
      },
    });

    return {
      evidenceId: ref.id,
      signedUrl: url,
      expiresInSeconds: 120,
      mimeType: ref.mimeType,
      adapterMode: 'r2_presigned_get',
    };
  }

  /**
   * Authenticated member view of own verification cases (sanitized; never leaks object keys)
   */
  async getMyCases(accountId: string) {
    const cases = await this.prisma.verificationCase.findMany({
      where: { accountId },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        checkType: true,
        providerCode: true,
        status: true,
        reasonCode: true,
        rejectionReason: true,
        submittedAt: true,
        decidedAt: true,
        _count: { select: { evidence: true } },
      },
    });

    return cases.map((c) => ({
      id: c.id,
      checkType: c.checkType,
      providerCode: c.providerCode,
      status: c.status,
      reasonCode: c.reasonCode,
      rejectionReason: c.rejectionReason,
      submittedAt: c.submittedAt.toISOString(),
      decidedAt: c.decidedAt ? c.decidedAt.toISOString() : null,
      evidenceCount: c._count.evidence,
    }));
  }

  /**
   * Authorised Reviewer / Provider Decision Transition (D-P2-01)
   */
  async decideCase(reviewerPrincipalId: string, caseId: string, dto: ReviewerDecisionDto) {
    return this.prisma.$transaction(async (tx) => {
      const vCase = await tx.verificationCase.findUnique({
        where: { id: caseId },
        include: { account: { include: { eligibility: true } } },
      });
      if (!vCase) {
        throw new NotFoundException('Verification case not found.');
      }

      const now = new Date();
      const updatedCase = await tx.verificationCase.update({
        where: { id: caseId },
        data: {
          status: dto.decision,
          decidedAt: now,
          reviewedAt: now,
          reviewerId: reviewerPrincipalId,
          reviewerPrincipalId,
          reasonCode: dto.reasonCode || dto.decision,
          rejectionReason: dto.decision === 'approved' ? null : (dto.rejectionReason || null),
        },
      });

      const currentElig = vCase.account.eligibility;
      const newAgeStatus =
        vCase.checkType === 'age' ? dto.decision : currentElig?.ageStatus || 'not_started';
      const newStudentStatus =
        vCase.checkType === 'student_enrolment'
          ? dto.decision
          : currentElig?.studentStatus || 'not_started';

      const canDiscover =
        newAgeStatus === 'approved' &&
        newStudentStatus === 'approved' &&
        vCase.account.accountStatus !== 'suspended' &&
        !vCase.account.deletedAt;

      const updatedElig = await tx.accountEligibility.upsert({
        where: { accountId: vCase.accountId },
        create: {
          accountId: vCase.accountId,
          ageStatus: newAgeStatus,
          studentStatus: newStudentStatus,
          discoveryEligible: canDiscover,
          ageVerifiedAt: vCase.checkType === 'age' && dto.decision === 'approved' ? now : null,
          studentVerifiedAt:
            vCase.checkType === 'student_enrolment' && dto.decision === 'approved' ? now : null,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
          verifiedAt: canDiscover ? now : null,
          verifiedBy: canDiscover ? reviewerPrincipalId : null,
        },
        update: {
          ageStatus: newAgeStatus,
          studentStatus: newStudentStatus,
          discoveryEligible: canDiscover,
          ageVerifiedAt:
            vCase.checkType === 'age'
              ? dto.decision === 'approved'
                ? now
                : null
              : undefined,
          studentVerifiedAt:
            vCase.checkType === 'student_enrolment'
              ? dto.decision === 'approved'
                ? now
                : null
              : undefined,
          validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
          verifiedAt: canDiscover ? now : null,
          verifiedBy: canDiscover ? reviewerPrincipalId : null,
        },
      });

      const updatedAccount = await tx.account.update({
        where: { id: vCase.accountId },
        data: {
          accountStatus:
            vCase.account.accountStatus === 'suspended' ||
            vCase.account.accountStatus === 'disabled'
              ? vCase.account.accountStatus
              : canDiscover
                ? 'active'
                : 'pending_verification',
        },
        select: { id: true, accountStatus: true },
      });

      if (!canDiscover) {
        await this.matchAuth.invalidateActiveMatchesForAccount(tx, vCase.accountId, {
          reasonCode: 'verification_revoked',
          actorId: vCase.accountId,
          metadata: {
            checkType: vCase.checkType,
            decision: dto.decision,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          actorId: vCase.accountId,
          action: 'verification.case_decided',
          resourceType: 'verification_case',
          resourceId: caseId,
          metadata: {
            checkType: vCase.checkType,
            decision: dto.decision,
            reviewerPrincipalId,
            discoveryEligible: canDiscover,
          },
        },
      });

      return {
        case: updatedCase,
        eligibility: updatedElig,
        accountStatus: updatedAccount.accountStatus,
        discoveryEligible: canDiscover,
      };
    });
  }
}
