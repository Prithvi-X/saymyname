import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { CryptoService } from '../src/modules/identity/security/crypto.service';
import { IdentityService } from '../src/modules/identity/identity.service';
import { VerificationService } from '../src/modules/verification/verification.service';
import { ProgrammeFamily } from '@saymyname/contracts';
import { isApprovedIitmBsEmail, isAdult } from '@saymyname/validation';

describe('Identity, Verification & Security Domain Tests (Phase 2)', () => {
  const cryptoService = new CryptoService();

  function createMockPrisma(overrides: any = {}) {
    const state = {
      account: {
        id: 'mock-id',
        email: 'student@study.iitm.ac.in',
        passwordHash: cryptoService.hashPassword('ValidPassword123!'),
        emailVerifiedAt: new Date(),
        accountStatus: 'pending_verification',
        deletedAt: null,
        displayName: null,
      },
      eligibility: {
        accountId: 'mock-id',
        ageStatus: 'pending',
        studentStatus: 'not_started',
        programmeFamily: null as string | null,
        pathwayCode: null as string | null,
        discoveryEligible: false,
      },
      otpChallenge: null as any,
      cases: [] as any[],
      ...overrides,
    };

    const txClient: any = {
      account: {
        findUnique: async () => ({ ...state.account, eligibility: state.eligibility }),
        create: async (args: any) => ({ ...state.account, ...args.data, eligibility: state.eligibility }),
        update: async (args: any) => {
          Object.assign(state.account, args.data);
          return { ...state.account, eligibility: state.eligibility };
        },
      },
      accountEligibility: {
        findUnique: async () => state.eligibility,
        create: async (args: any) => {
          Object.assign(state.eligibility, args.data);
          return state.eligibility;
        },
        upsert: async (args: any) => {
          Object.assign(state.eligibility, args.update || args.create);
          return state.eligibility;
        },
        update: async (args: any) => {
          Object.assign(state.eligibility, args.data);
          return state.eligibility;
        },
      },
      verificationCase: {
        create: async (args: any) => {
          const rec = { id: `case-${state.cases.length + 1}`, submittedAt: new Date(), ...args.data };
          state.cases.push(rec);
          return rec;
        },
        findMany: async ({ where }: any = {}) => {
          const statuses: string[] | undefined = where?.status?.in;
          return state.cases
            .filter((c: any) => (!statuses || statuses.includes(c.status)) && (!where?.checkType || c.checkType === where.checkType))
            .map((c: any) => ({
              ...c,
              account: { ...state.account, eligibility: state.eligibility },
              evidence: (state.evidences || []).filter((e: any) => e.caseId === c.id && !e.deletedAt),
            }));
        },
        findUnique: async ({ where }: any) => {
          const found = state.cases.find((c: any) => c.id === where.id);
          return found ? { ...found, account: { ...state.account, eligibility: state.eligibility } } : null;
        },
        update: async ({ where, data }: any) => {
          const found = state.cases.find((c: any) => c.id === where.id);
          if (found) Object.assign(found, data);
          return found;
        },
      },
      verificationEvidenceRef: {
        create: async (args: any) => {
          const ev = { id: `ev-${(state.evidences || []).length + 1}`, uploadedAt: new Date(), deletedAt: null, ...args.data };
          if (!state.evidences) state.evidences = [];
          state.evidences.push(ev);
          return ev;
        },
        findUnique: async ({ where }: any) => (state.evidences || []).find((e: any) => e.id === where.id) || null,
      },
      otpChallenge: {
        findFirst: async () => state.otpChallenge,
        updateMany: async () => ({ count: 1 }),
        create: async (args: any) => {
          state.otpChallenge = { id: 'otp-1', ...args.data };
          return state.otpChallenge;
        },
        update: async (args: any) => {
          if (state.otpChallenge) Object.assign(state.otpChallenge, args.data);
          return state.otpChallenge;
        },
      },
      auditEvent: {
        create: async () => ({}),
      },
      appSession: {
        create: async () => ({}),
        findUnique: async () => null,
        update: async () => ({}),
        updateMany: async () => ({ count: 0 }),
      },
    };

    const mockPrisma: any = {
      ...txClient,
      state,
      $transaction: async (cb: any) => cb(txClient),
    };
    return mockPrisma;
  }

  test('Rule 1 (D-P2-03): Central BS email allowlist rejects campus/faculty and spoofed domains', () => {
    const prisma = createMockPrisma();
    const verificationService = new VerificationService(prisma);
    const identityService = new IdentityService(prisma, cryptoService, verificationService);

    // Approved BS study domains
    assert.strictEqual(identityService.validateIitmEmail('21f1000123@study.iitm.ac.in'), true);
    assert.strictEqual(identityService.validateIitmEmail('student@ds.study.iitm.ac.in'), true);
    assert.strictEqual(identityService.validateIitmEmail('student@es.study.iitm.ac.in'), true);

    // Campus, faculty, spoofed suffixes, malformed emails -> REJECTED
    assert.strictEqual(identityService.validateIitmEmail('faculty@iitm.ac.in'), false);
    assert.strictEqual(identityService.validateIitmEmail('btech@smail.iitm.ac.in'), false);
    assert.strictEqual(identityService.validateIitmEmail('fake@evilstudy.iitm.ac.in'), false);
    assert.strictEqual(identityService.validateIitmEmail('fake@sub.ds.study.iitm.ac.in'), false);
    assert.strictEqual(identityService.validateIitmEmail('stranger@gmail.com'), false);
    assert.strictEqual(isApprovedIitmBsEmail('user@study.iitm.ac.in@gmail.com'), false);
  });

  test('Rule 2: Under-18 & future DOB checks strictly reject', async () => {
    assert.strictEqual(isAdult('2050-01-01'), false);
    assert.strictEqual(isAdult('2004-02-31'), false);

    const prisma = createMockPrisma();
    const verificationService = new VerificationService(prisma);
    const identityService = new IdentityService(prisma, cryptoService, verificationService);

    const today = new Date();
    const underageDob = `${today.getUTCFullYear() - 17}-01-01`;

    await assert.rejects(
      async () => identityService.checkAge('mock-id', { dateOfBirth: underageDob }),
      (err: any) =>
        err.status === 403 && err.message.includes('SayMyName is strictly for verified adults (18+)'),
    );
  });

  test('Rule 3 (D-P2-01): 18+ DOB stays pending review and never auto-approves', async () => {
    const prisma = createMockPrisma({
      eligibility: {
        accountId: 'mock-id',
        ageStatus: 'not_started',
        studentStatus: 'not_started',
        programmeFamily: null,
        pathwayCode: null,
        discoveryEligible: false,
      },
    });
    const verificationService = new VerificationService(prisma);
    const identityService = new IdentityService(prisma, cryptoService, verificationService);

    const adultDob = `${new Date().getUTCFullYear() - 21}-05-15`;
    const result = await identityService.checkAge('mock-id', { dateOfBirth: adultDob });

    assert.strictEqual(result.calculatedAge >= 18, true);
    assert.strictEqual(result.ageStatus, 'pending');
    assert.strictEqual(result.verificationPendingReview, true);
    assert.strictEqual(result.eligibility.ageStatus, 'pending');
    assert.strictEqual(result.eligibility.discoveryEligible, false);
  });

  test('Rule 4 (D-P2-01): Student check enforces 4 BS families, blocks minors & gov IDs, and awaits review', async () => {
    const prisma = createMockPrisma();
    const verificationService = new VerificationService(prisma);
    const identityService = new IdentityService(prisma, cryptoService, verificationService);

    const validProgrammes = [
      ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
      ProgrammeFamily.ELECTRONIC_SYSTEMS,
      ProgrammeFamily.AERONAUTICS_SPACE,
      ProgrammeFamily.MANAGEMENT_DATA_SCIENCE,
    ];

    for (const prog of validProgrammes) {
      const res = await identityService.verifyStudent('mock-id', {
        programmeFamily: prog,
        pathwayCode: 'diploma',
      });
      assert.strictEqual(res.studentStatus, 'pending');
      assert.strictEqual(res.discoveryEligible, false);
      assert.strictEqual(res.verificationPendingReview, true);
    }

    // Rejects invalid programme
    await assert.rejects(
      async () =>
        identityService.verifyStudent('mock-id', {
          programmeFamily: 'btech_computer_science',
          pathwayCode: 'degree',
        }),
      (err: any) => err.status === 400 && err.message.includes('Invalid programme track'),
    );

    // Rejects gov ID collection
    await assert.rejects(
      async () =>
        identityService.verifyStudent('mock-id', {
          programmeFamily: ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
          pathwayCode: 'foundation',
          evidenceType: 'aadhaar_card',
        }),
      (err: any) => err.status === 400 && err.message.includes('Government ID documents'),
    );

    // Blocks rejected minor from submitting student verification
    const minorPrisma = createMockPrisma({
      eligibility: {
        accountId: 'mock-id',
        ageStatus: 'rejected',
        studentStatus: 'not_started',
        discoveryEligible: false,
      },
    });
    const minorService = new VerificationService(minorPrisma);
    await assert.rejects(
      async () =>
        minorService.submitStudentEnrolmentVerification('mock-id', {
          programmeFamily: ProgrammeFamily.ELECTRONIC_SYSTEMS,
          pathwayCode: 'foundation',
        }),
      (err: any) => err.status === 403 && err.message.includes('Under-18 accounts'),
    );
  });

  test('Rule 5 (D-P2-00, D-P2-02): Static OTP 123456 fails; password login & Reviewer approval work cleanly', async () => {
    const email = 'student@study.iitm.ac.in';
    const wrongChallengeHash = cryptoService.hashChallengeCode('654321', email, 'email_verification');
    const prisma = createMockPrisma({
      otpChallenge: {
        id: 'otp-1',
        email,
        purpose: 'email_verification',
        codeHash: wrongChallengeHash,
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 60000),
        consumedAt: null,
        lastSentAt: new Date(),
      },
    });
    const verificationService = new VerificationService(prisma);
    const identityService = new IdentityService(prisma, cryptoService, verificationService);

    // Unconditional '123456' bypass must fail
    await assert.rejects(
      async () => identityService.verifyOtp({ email, otp: '123456' }),
      (err: any) => err.status === 401,
    );

    // Real challenge code verifies cleanly
    const verified = await identityService.verifyOtp({ email, otp: '654321' });
    assert.strictEqual(verified.account.emailVerified, true);

    // Password login rejects wrong password and succeeds on valid password
    await assert.rejects(
      async () => identityService.login({ email, password: 'WrongPassword99!' }),
      (err: any) => err.status === 401,
    );
    const loggedIn = await identityService.login({ email, password: 'ValidPassword123!' });
    assert.ok(loggedIn.accessToken);
    assert.strictEqual(loggedIn.account.email, email);

    // Authorised reviewer approves age + student cases -> unlocks discoveryEligible
    await identityService.checkAge('mock-id', {
      dateOfBirth: `${new Date().getUTCFullYear() - 20}-01-01`,
    });
    await identityService.verifyStudent('mock-id', {
      programmeFamily: ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
      pathwayCode: 'degree',
    });
    const ageCase = prisma.state.cases.find((c: any) => c.checkType === 'age');
    const studentCase = prisma.state.cases.find((c: any) => c.checkType === 'student_enrolment');
    const partialDecision = await verificationService.decideCase('reviewer_1', ageCase.id, {
      decision: 'approved',
    });
    assert.strictEqual(partialDecision.discoveryEligible, false);

    const finalDecision = await verificationService.decideCase('reviewer_1', studentCase.id, {
      decision: 'approved',
    });
    assert.strictEqual(finalDecision.discoveryEligible, true);
    assert.strictEqual(finalDecision.accountStatus, 'active');
  });

  test('Rule 6: JWT signing & length-safe signature verification reject tampering cleanly', () => {
    const token = cryptoService.generateJwt({
      sub: 'user-uuid-1234',
      email: 'student@study.iitm.ac.in',
      discoveryEligible: true,
    }, 3600);

    const decoded = cryptoService.verifyJwt(token);
    assert.strictEqual(decoded.sub, 'user-uuid-1234');
    assert.strictEqual(decoded.email, 'student@study.iitm.ac.in');
    assert.strictEqual(decoded.discoveryEligible, true);

    const tampered = token.slice(0, -5) + 'AAAAA';
    assert.throws(() => cryptoService.verifyJwt(tampered));

    // Shorter tampered signature must raise UnauthorizedException (not RangeError)
    const truncatedSig = token.slice(0, -10);
    assert.throws(
      () => cryptoService.verifyJwt(truncatedSig),
      (err: any) => err.status === 401,
    );
  });

  test('Rule 7 (D-P2-01): Manual review queue redacts email/s3Key, labels non-external mode & rejects expired evidence', async () => {
    const prisma = createMockPrisma({
      evidences: [
        {
          id: 'ev-expired-1',
          caseId: 'case-1',
          evidenceType: 'iitm_portal_screenshot',
          s3Key: 'verification-evidence/mock-id/secret-key.png',
          mimeType: 'image/png',
          fileSizeBytes: 12000,
          uploadedAt: new Date(),
          retentionUntil: new Date(Date.now() - 60_000),
          deletedAt: null,
        },
        {
          id: 'ev-active-1',
          caseId: 'case-2',
          evidenceType: 'term_fee_receipt',
          s3Key: 'verification-evidence/mock-id/secret-key-2.pdf',
          mimeType: 'application/pdf',
          fileSizeBytes: 42000,
          uploadedAt: new Date(),
          retentionUntil: new Date(Date.now() + 86_400_000),
          deletedAt: null,
        },
      ],
      cases: [
        {
          id: 'case-1',
          accountId: 'mock-id',
          checkType: 'age',
          providerCode: 'manual_review',
          status: 'pending',
          reasonCode: null,
          submittedAt: new Date(),
        },
        {
          id: 'case-2',
          accountId: 'mock-id',
          checkType: 'student_enrolment',
          providerCode: 'manual_review',
          status: 'pending',
          reasonCode: null,
          submittedAt: new Date(),
        },
      ],
    });
    const verificationService = new VerificationService(prisma);

    const queue = await verificationService.getPendingQueue('qa_reviewer', { status: 'all_open' });
    assert.strictEqual(queue.integrationMode, 'manual_review_only_no_external_provider');
    assert.strictEqual(queue.totalReturned, 2);
    assert.strictEqual(queue.cases[0].maskedEmail, 'st***@study.iitm.ac.in');
    assert.strictEqual(JSON.stringify(queue).includes('secret-key-2.pdf'), false);
    assert.strictEqual(JSON.stringify(queue).includes('student@study.iitm.ac.in'), false);

    // Expired evidence must raise NotFoundException
    await assert.rejects(
      async () => verificationService.getReviewerEvidenceReadUrl('ev-expired-1', 'qa_reviewer'),
      (err: any) => err.status === 404,
    );
  });

  test('returns 503 ServiceUnavailableException on login when the database is unreachable', async () => {
    const cryptoService = new CryptoService();
    const brokenPrisma = {
      account: {
        findUnique: async () => {
          throw new Error('ECONNREFUSED localhost:5433');
        },
      },
    };
    const identityService = new IdentityService(
      brokenPrisma as any,
      cryptoService,
      new VerificationService(brokenPrisma as any),
    );

    await assert.rejects(
      async () =>
        identityService.login({
          email: 'learner@study.iitm.ac.in',
          password: 'ValidPassword123!',
        }),
      (err: any) => err.status === 503,
    );
  });
});
