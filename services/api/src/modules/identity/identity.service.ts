import { Injectable, BadRequestException, ConflictException, UnauthorizedException, ForbiddenException, ServiceUnavailableException, HttpException, HttpStatus, Optional } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from './security/crypto.service';
import { VerificationService } from '../verification/verification.service';
import {
  AccountInvalidationReason,
  MatchAuthorizationService,
} from '../safety/match-authorization.service';
import { RealtimeEventBusService } from '../realtime/realtime-event-bus.service';
import {
  RegisterDto,
  LoginDto,
  VerifyOtpDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AgeCheckDto,
  VerifyStudentDto,
  RefreshTokenDto,
  DeleteAccountDto,
} from './dto/identity.dto';
import { AccountLifecycleState } from '@saymyname/contracts';
import {
  isApprovedIitmBsEmail,
  isPrivateIdentifierLike,
  normalizeInstitutionalEmail,
} from '@saymyname/validation';

const DUMMY_PASSWORD_HASH =
  'pbkdf2$100000$00000000000000000000000000000000$' + '0'.repeat(128);
const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const RESET_EXPIRY_MS = 30 * 60 * 1000;

@Injectable()
export class IdentityService {
  private readonly matchAuth: MatchAuthorizationService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly verificationService: VerificationService,
    @Optional() matchAuthService?: MatchAuthorizationService,
    @Optional() private readonly realtimeBus?: RealtimeEventBusService,
  ) {
    this.matchAuth = matchAuthService ?? new MatchAuthorizationService(this.prisma);
  }

  /**
   * Central institutional BS email allowlist check (D-P2-03).
   * Rejects campus/faculty @iitm.ac.in domains and lookalike suffixes.
   * Passing domain validation never grants student enrolment verification.
   */
  validateIitmEmail(email: string): boolean {
    const extraDomains = (process.env.APPROVED_IITM_BS_EXTRA_DOMAINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return isApprovedIitmBsEmail(email, extraDomains);
  }

  private isNonProdDevExposureEnabled(): boolean {
    if (process.env.NODE_ENV === 'production') return false;
    return process.env.NODE_ENV === 'test' || process.env.EXPOSE_DEV_OTP === 'true';
  }

  private generateVerificationCode(): string {
    if (
      process.env.NODE_ENV === 'test' &&
      process.env.TEST_FIXED_OTP &&
      /^\d{6}$/.test(process.env.TEST_FIXED_OTP)
    ) {
      return process.env.TEST_FIXED_OTP;
    }
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Maps server-side account + eligibility + profile state into canonical AccountLifecycleState
   */
  computeLifecycleState(
    account: { accountStatus: string; emailVerifiedAt?: Date | null; deletedAt?: Date | null } | null,
    eligibility: {
      ageStatus?: string | null;
      studentStatus?: string | null;
      discoveryEligible?: boolean | null;
      dateOfBirth?: Date | string | null;
    } | null,
    profile: { isPublished?: boolean | null; profileStatus?: string | null; publishedAt?: Date | string | null } | null,
  ): AccountLifecycleState {
    if (!account || account.deletedAt) return AccountLifecycleState.UNAUTHENTICATED;
    if (account.accountStatus === 'suspended') return AccountLifecycleState.SUSPENDED;
    if (!account.emailVerifiedAt || account.accountStatus === 'registered') {
      return AccountLifecycleState.EMAIL_PENDING;
    }

    const ageStatus = eligibility?.ageStatus || 'not_started';
    const studentStatus = eligibility?.studentStatus || 'not_started';

    if (ageStatus === 'rejected' || studentStatus === 'rejected') {
      return AccountLifecycleState.VERIFICATION_REJECTED;
    }
    if (ageStatus === 'needs_information' || studentStatus === 'needs_information') {
      return AccountLifecycleState.VERIFICATION_NEEDS_INFORMATION;
    }
    if (ageStatus === 'not_started') {
      return AccountLifecycleState.AGE_VERIFICATION;
    }
    if (
      ageStatus === 'approved' &&
      eligibility &&
      'dateOfBirth' in eligibility &&
      eligibility.dateOfBirth === null
    ) {
      return AccountLifecycleState.AGE_VERIFICATION;
    }
    if (studentStatus === 'not_started') {
      return AccountLifecycleState.STUDENT_VERIFICATION;
    }

    if (
      !eligibility?.discoveryEligible ||
      ageStatus !== 'approved' ||
      studentStatus !== 'approved' ||
      account.accountStatus !== 'active'
    ) {
      return AccountLifecycleState.VERIFICATION_PENDING;
    }

    const profileLive = Boolean(profile?.isPublished) || profile?.profileStatus === 'live';
    const profileCompletedPaused =
      profile?.profileStatus === 'paused' && Boolean(profile?.publishedAt);
    if (!profile || (!profileLive && !profileCompletedPaused)) {
      return AccountLifecycleState.PROFILE_INCOMPLETE;
    }

    return AccountLifecycleState.ACTIVE_MEMBER;
  }

  /**
   * 1. Register account with approved BS email + hashed password and persistent hashed OTP challenge
   */
  async register(dto: RegisterDto) {
    if (!this.validateIitmEmail(dto.email)) {
      throw new BadRequestException(
        'Phase 1 is restricted to verified IIT Madras non-campus BS students with an approved study.iitm.ac.in address. Campus/faculty @iitm.ac.in domains are not eligible.',
      );
    }

    const email = normalizeInstitutionalEmail(dto.email);
    const sanitizedDisplayName =
      dto.displayName &&
      dto.displayName.trim().length > 0 &&
      !isPrivateIdentifierLike(dto.displayName)
        ? dto.displayName.trim().slice(0, 50)
        : null;

    const existing = await this.prisma.account
      .findUnique({ where: { email } })
      .catch(() => null);

    if (existing && (existing.emailVerifiedAt || existing.accountStatus === 'active')) {
      throw new ConflictException(
        'An account already exists with this institutional email. Please sign in or use Forgot Password.',
      );
    }

    // Enforce 60-second resend cooldown against persistent OtpChallenge
    const latestChallenge = await this.prisma.otpChallenge
      .findFirst({
        where: { email, purpose: 'email_verification' },
        orderBy: { createdAt: 'desc' },
      })
      .catch(() => null);

    if (latestChallenge && Date.now() - latestChallenge.lastSentAt.getTime() < OTP_COOLDOWN_MS) {
      const waitSec = Math.ceil(
        (OTP_COOLDOWN_MS - (Date.now() - latestChallenge.lastSentAt.getTime())) / 1000,
      );
      throw new HttpException(
        `Please wait ${waitSec} seconds before requesting another verification code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateVerificationCode();
    const codeHash = this.crypto.hashChallengeCode(otp, email, 'email_verification');
    const passwordHash = await this.crypto.hashPasswordAsync(dto.password);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

    await this.prisma.$transaction(async (tx) => {
      const account = existing
        ? await tx.account.update({
            where: { id: existing.id },
            data: {
              passwordHash,
              displayName: sanitizedDisplayName ?? existing.displayName,
              accountStatus: 'registered',
            },
          })
        : await tx.account.create({
            data: {
              authSubject: `iitm_${this.crypto.sha256(email).substring(0, 16)}`,
              email,
              passwordHash,
              emailVerifiedAt: null,
              accountStatus: 'registered',
              displayName: sanitizedDisplayName,
              eligibility: {
                create: {
                  ageStatus: 'not_started',
                  studentStatus: 'not_started',
                  discoveryEligible: false,
                },
              },
            },
          });

      await tx.otpChallenge.updateMany({
        where: { email, purpose: 'email_verification', consumedAt: null },
        data: { consumedAt: now },
      });

      await tx.otpChallenge.create({
        data: {
          accountId: account.id,
          email,
          purpose: 'email_verification',
          codeHash,
          attempts: 0,
          maxAttempts: 5,
          expiresAt,
          lastSentAt: now,
        },
      });
    });

    await this.dispatchEmail(
      email,
      `${otp} is your SayMyName verification code`,
      this.renderDocument10OtpEmail(otp),
    );

    return {
      message: 'Verification code dispatched to your institutional email address.',
      email,
      cooldownSeconds: 60,
      ...(this.isNonProdDevExposureEnabled() ? { devOtp: otp } : {}),
    };
  }

  /**
   * 1b. Resend email verification OTP (60s cooldown enforced cleanly)
   */
  async resendOtp(rawEmail: string) {
    if (!this.validateIitmEmail(rawEmail)) {
      throw new BadRequestException(
        'Please enter an approved IIT Madras non-campus BS institutional email.',
      );
    }
    const email = normalizeInstitutionalEmail(rawEmail);

    const account = await this.prisma.account
      .findUnique({ where: { email } })
      .catch(() => null);

    if (!account || account.emailVerifiedAt) {
      // Do not enumerate whether another account is already verified
      return {
        message:
          'If an unverified eligible account exists for this address, a fresh verification code has been dispatched.',
        cooldownSeconds: 60,
      };
    }

    const latestChallenge = await this.prisma.otpChallenge
      .findFirst({
        where: { email, purpose: 'email_verification' },
        orderBy: { createdAt: 'desc' },
      })
      .catch(() => null);

    if (latestChallenge && Date.now() - latestChallenge.lastSentAt.getTime() < OTP_COOLDOWN_MS) {
      const waitSec = Math.ceil(
        (OTP_COOLDOWN_MS - (Date.now() - latestChallenge.lastSentAt.getTime())) / 1000,
      );
      throw new HttpException(
        `Please wait ${waitSec} seconds before requesting another verification code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateVerificationCode();
    const codeHash = this.crypto.hashChallengeCode(otp, email, 'email_verification');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

    await this.prisma.$transaction(async (tx) => {
      await tx.otpChallenge.updateMany({
        where: { email, purpose: 'email_verification', consumedAt: null },
        data: { consumedAt: now },
      });
      await tx.otpChallenge.create({
        data: {
          accountId: account.id,
          email,
          purpose: 'email_verification',
          codeHash,
          attempts: 0,
          maxAttempts: 5,
          expiresAt,
          lastSentAt: now,
        },
      });
    });

    await this.dispatchEmail(
      email,
      `${otp} is your SayMyName verification code`,
      this.renderDocument10OtpEmail(otp),
    );

    return {
      message: 'A new verification code has been dispatched to your institutional email.',
      email,
      cooldownSeconds: 60,
      ...(this.isNonProdDevExposureEnabled() ? { devOtp: otp } : {}),
    };
  }

  /**
   * 2. Verify Email OTP against persistent hashed OtpChallenge (D-P2-00, D-P2-02)
   * Zero hardcoded '123456' fallback. Attempt-capped, expiring, single-use.
   */
  async verifyOtp(dto: VerifyOtpDto) {
    const email = normalizeInstitutionalEmail(dto.email);
    const now = new Date();

    const challenge = await this.prisma.otpChallenge
      .findFirst({
        where: {
          email,
          purpose: 'email_verification',
          consumedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      })
      .catch(() => null);

    if (!challenge || challenge.expiresAt <= now) {
      throw new UnauthorizedException(
        'Invalid or expired verification code. Please request a new code.',
      );
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      throw new HttpException(
        'Too many incorrect verification attempts. Please request a fresh code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const codeOk = this.crypto.verifyChallengeCode(
      dto.otp.trim(),
      email,
      challenge.codeHash,
      'email_verification',
    );

    if (!codeOk) {
      const nextAttempts = challenge.attempts + 1;
      await this.prisma.otpChallenge
        .update({
          where: { id: challenge.id },
          data: {
            attempts: nextAttempts,
            ...(nextAttempts >= challenge.maxAttempts ? { consumedAt: now } : {}),
          },
        })
        .catch(() => null);

      if (nextAttempts >= challenge.maxAttempts) {
        throw new HttpException(
          'Maximum verification attempts reached. Please request a new code.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException('Invalid or expired verification code.');
    }

    const account = await this.prisma.$transaction(async (tx) => {
      await tx.otpChallenge.update({
        where: { id: challenge.id },
        data: { consumedAt: now },
      });

      const found = await tx.account.findUnique({
        where: { email },
        include: { eligibility: true, profile: true },
      });

      if (!found) {
        throw new UnauthorizedException('Account registration record not found.');
      }

      const updated = await tx.account.update({
        where: { id: found.id },
        data: {
          emailVerifiedAt: found.emailVerifiedAt || now,
          accountStatus:
            found.accountStatus === 'registered'
              ? 'pending_verification'
              : found.accountStatus,
        },
        include: { eligibility: true, profile: true },
      });

      if (!updated.eligibility) {
        await tx.accountEligibility.create({
          data: {
            accountId: updated.id,
            ageStatus: 'not_started',
            studentStatus: 'not_started',
            discoveryEligible: false,
          },
        });
      }

      return updated;
    });

    const isDiscoveryEligible =
      Boolean(account.eligibility?.discoveryEligible) && account.accountStatus === 'active';
    const session = await this.createSession(account.id, account.email, isDiscoveryEligible);
    const lifecycleState = this.computeLifecycleState(
      account,
      account.eligibility,
      account.profile,
    );

    return {
      message: 'Institutional email verified successfully.',
      account: {
        id: account.id,
        email: account.email,
        accountStatus: account.accountStatus,
        emailVerified: true,
        eligibility: account.eligibility,
      },
      lifecycleState,
      ...session,
    };
  }

  /**
   * 2b. Password Login (D-P2-02: Password login + Email OTP verification only; no passwordless OTP login)
   */
  async login(dto: LoginDto) {
    const email = normalizeInstitutionalEmail(dto.email);
    let account: any;
    try {
      account = await this.prisma.account.findUnique({
        where: { email },
        include: { eligibility: true, profile: true },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Authentication service is temporarily unavailable. Check database connectivity and try again.',
      );
    }

    // Run PBKDF2 timing-equal check off the event loop even when missing/passwordless to normalize timing
    const hashToCheck = account?.passwordHash || DUMMY_PASSWORD_HASH;
    const passwordMatches = await this.crypto.verifyPasswordAsync(dto.password, hashToCheck);

    if (!account || !account.passwordHash || !passwordMatches) {
      throw new UnauthorizedException(
        'Email or password did not match. If your account was created before password sign-in was added, use Forgot Password below to set one.',
      );
    }

    if (account.deletedAt || account.accountStatus === 'suspended') {
      throw new ForbiddenException('This account is suspended or closed.');
    }

    if (!account.emailVerifiedAt || account.accountStatus === 'registered') {
      throw new ForbiddenException({
        message: 'Verify your institutional email with your OTP code before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    const isDiscoveryEligible =
      Boolean(account.eligibility?.discoveryEligible) &&
      account.eligibility?.ageStatus === 'approved' &&
      account.eligibility?.studentStatus === 'approved' &&
      account.accountStatus === 'active';

    const session = await this.createSession(account.id, account.email, isDiscoveryEligible);
    const lifecycleState = this.computeLifecycleState(
      account,
      account.eligibility,
      account.profile,
    );
    const rawName = account.profile?.displayName || account.displayName;
    const sanitizedName = !rawName || isPrivateIdentifierLike(rawName) ? null : rawName;

    return {
      message: 'Signed in successfully.',
      account: {
        id: account.id,
        email: account.email,
        displayName: sanitizedName,
        accountStatus: account.accountStatus,
        emailVerified: true,
        hasPassword: true,
        eligibility: account.eligibility,
      },
      profile: account.profile
        ? {
            id: account.profile.id,
            displayName: sanitizedName || account.profile.displayName,
            profileStatus: account.profile.profileStatus,
            isPublished: account.profile.isPublished,
            isPaused: account.profile.isPaused,
          }
        : null,
      lifecycleState,
      ...session,
    };
  }

  /**
   * 2c. Forgot Password (non-enumerating, hashed single-use token, 30-min expiry)
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    if (!this.validateIitmEmail(dto.email)) {
      throw new BadRequestException(
        'Please enter a valid IIT Madras non-campus BS study email.',
      );
    }

    const email = normalizeInstitutionalEmail(dto.email);
    const account = await this.prisma.account
      .findUnique({ where: { email } })
      .catch(() => null);

    let devResetToken: string | undefined;

    if (account && !account.deletedAt && account.accountStatus !== 'suspended') {
      const recent = await this.prisma.passwordResetToken
        .findFirst({
          where: { accountId: account.id },
          orderBy: { createdAt: 'desc' },
        })
        .catch(() => null);

      if (!recent || Date.now() - recent.createdAt.getTime() >= OTP_COOLDOWN_MS) {
        const rawToken = this.crypto.generateOpaqueToken();
        const tokenHash = this.crypto.sha256(rawToken);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + RESET_EXPIRY_MS);

        await this.prisma.$transaction(async (tx) => {
          await tx.passwordResetToken.updateMany({
            where: { accountId: account.id, consumedAt: null },
            data: { consumedAt: now },
          });
          await tx.passwordResetToken.create({
            data: {
              accountId: account.id,
              tokenHash,
              expiresAt,
            },
          });
        });

        const baseWebUrl = (process.env.WEB_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
        const resetLink = `${baseWebUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

        await this.dispatchEmail(
          email,
          'Reset your SayMyName password',
          this.renderDocument10ResetEmail(resetLink),
        );

        if (this.isNonProdDevExposureEnabled()) {
          devResetToken = rawToken;
        }
      }
    }

    return {
      message:
        'If an account exists for this institutional address, a password reset link has been sent.',
      ...(devResetToken ? { devResetToken } : {}),
    };
  }

  /**
   * 2d. Reset Password & Revoke All Existing Sessions (D-P2-02)
   */
  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.crypto.sha256(dto.token.trim());
    const now = new Date();

    const record = await this.prisma.passwordResetToken
      .findUnique({
        where: { tokenHash },
        include: { account: true },
      })
      .catch(() => null);

    if (!record || record.consumedAt || record.expiresAt <= now) {
      throw new UnauthorizedException('Invalid or expired password reset token.');
    }

    const newHash = await this.crypto.hashPasswordAsync(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { consumedAt: now },
      });

      await tx.account.update({
        where: { id: record.accountId },
        data: {
          passwordHash: newHash,
          emailVerifiedAt: record.account.emailVerifiedAt || now,
          accountStatus:
            record.account.accountStatus === 'registered'
              ? 'pending_verification'
              : record.account.accountStatus,
        },
      });

      // Security invariant: revoke all active sessions upon credential reset
      await tx.appSession.updateMany({
        where: { accountId: record.accountId, revokedAt: null },
        data: { revokedAt: now },
      });

      await tx.auditEvent.create({
        data: {
          actorId: record.accountId,
          action: 'identity.password_reset_completed',
          resourceType: 'account',
          resourceId: record.accountId,
        },
      });
    });

    return {
      message:
        'Password updated successfully. All prior sessions have been signed out; please sign in with your new password.',
    };
  }

  /**
   * 3. Age Verification Gate (delegates strictly to VerificationService — no auto-approval)
   */
  async checkAge(accountId: string, dto: AgeCheckDto) {
    return this.verificationService.submitAgeVerification(accountId, {
      dateOfBirth: dto.dateOfBirth,
    });
  }

  /**
   * 4. Student Programme Verification (delegates strictly to VerificationService — no auto-approval)
   */
  async verifyStudent(accountId: string, dto: VerifyStudentDto) {
    return this.verificationService.submitStudentEnrolmentVerification(accountId, dto);
  }

  /**
   * 5. Refresh Session with Reuse/Replay Family Revocation
   */
  async refreshToken(dto: RefreshTokenDto) {
    const hash = this.crypto.sha256(dto.refreshToken);
    const session = await this.prisma.appSession
      .findUnique({
        where: { refreshTokenHash: hash },
        include: { account: { include: { eligibility: true } } },
      })
      .catch(() => null);

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (session.revokedAt) {
      // Refresh token replay detected: revoke the entire token family immediately
      if (session.tokenFamilyId) {
        await this.prisma.appSession
          .updateMany({
            where: { tokenFamilyId: session.tokenFamilyId, revokedAt: null },
            data: { revokedAt: new Date() },
          })
          .catch(() => null);
      }
      await this.prisma.auditEvent
        .create({
          data: {
            actorId: session.accountId,
            action: 'identity.refresh_token_reuse_detected',
            resourceType: 'app_session',
            resourceId: session.id,
          },
        })
        .catch(() => null);
      throw new UnauthorizedException('Session invalidated due to token reuse detection.');
    }

    if (session.account.deletedAt || session.account.accountStatus === 'suspended') {
      throw new ForbiddenException('Account suspended or closed.');
    }

    const discoveryEligible =
      Boolean(session.account?.eligibility?.discoveryEligible) &&
      session.account?.eligibility?.ageStatus === 'approved' &&
      session.account?.eligibility?.studentStatus === 'approved' &&
      session.account.accountStatus === 'active';

    const familyId = session.tokenFamilyId || crypto.randomUUID();
    const now = new Date();
    const accessToken = this.crypto.generateJwt(
      {
        sub: session.accountId,
        email: session.account.email,
        discoveryEligible,
      },
      900,
    );

    const newRawRefreshToken = this.crypto.generateOpaqueToken();
    const newHash = this.crypto.sha256(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.appSession.update({
        where: { id: session.id },
        data: { revokedAt: now, lastSeenAt: now },
      });
      await tx.appSession.create({
        data: {
          accountId: session.accountId,
          refreshTokenHash: newHash,
          tokenFamilyId: familyId,
          rotatedFromSessionId: session.id,
          lastSeenAt: now,
          expiresAt,
        },
      });
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }

  /**
   * 6. Logout / Revoke Current Session
   */
  async logout(refreshToken: string) {
    if (!refreshToken) return { message: 'Logged out successfully.' };
    const hash = this.crypto.sha256(refreshToken);
    await this.prisma.appSession
      .update({
        where: { refreshTokenHash: hash },
        data: { revokedAt: new Date() },
      })
      .catch(() => null);

    return { message: 'Logged out successfully.' };
  }

  /**
   * 6b. Revoke Other Sessions (D-P2-02)
   */
  async revokeOtherSessions(accountId: string, currentRefreshToken?: string) {
    const now = new Date();
    const currentHash = currentRefreshToken ? this.crypto.sha256(currentRefreshToken) : null;

    const result = await this.prisma.appSession
      .updateMany({
        where: {
          accountId,
          revokedAt: null,
          ...(currentHash ? { refreshTokenHash: { not: currentHash } } : {}),
        },
        data: { revokedAt: now },
      })
      .catch(() => ({ count: 0 }));

    return {
      message: 'Other active sessions have been signed out.',
      revokedCount: result.count,
    };
  }

  /**
   * Transitions an account to suspended, disabled, or soft-deleted cleanly while
   * revoking active sessions, pausing discovery visibility, disabling eligibility, and
   * invalidating active matches and downstream messaging/calling/Together permissions.
   */
  async suspendOrRestrictAccount(
    accountId: string,
    params: {
      status: 'suspended' | 'disabled' | 'deleted';
      actorId?: string;
    },
  ) {
    const now = new Date();
    const reasonCode: AccountInvalidationReason =
      params.status === 'deleted'
        ? 'account_deleted'
        : params.status === 'disabled'
          ? 'account_disabled'
          : 'account_suspended';

    return this.prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { id: accountId },
        data: {
          accountStatus: params.status === 'deleted' ? 'disabled' : params.status,
          ...(params.status === 'deleted' ? { deletedAt: now } : {}),
        },
      });

      await tx.appSession
        .updateMany({
          where: { accountId, revokedAt: null },
          data: { revokedAt: now },
        })
        .catch(() => null);

      await tx.accountEligibility
        .updateMany({
          where: { accountId },
          data: { discoveryEligible: false },
        })
        .catch(() => null);

      await tx.profile
        .updateMany({
          where: { accountId, isPaused: false },
          data: { isPaused: true, profileStatus: 'paused' },
        })
        .catch(() => null);

      const { invalidatedCount, closedConversations } =
        await this.matchAuth.invalidateActiveMatchesForAccount(
          tx,
          accountId,
          {
            reasonCode,
            actorId: params.actorId || accountId,
          },
        );

      await tx.auditEvent
        .create({
          data: {
            actorId: accountId,
            action: `identity.${reasonCode}`,
            resourceType: 'account',
            resourceId: accountId,
            metadata: { invalidatedMatches: invalidatedCount },
          },
        })
        .catch(() => null);

      return {
        accountId,
        reasonCode,
        invalidatedMatches: invalidatedCount,
        closedConversations,
      };
    }).then((result) => {
      for (const conv of result.closedConversations || []) {
        this.realtimeBus?.publishMatchEnded({
          matchId: conv.matchId,
          conversationId: conv.conversationId,
          participantAccountIds: conv.participantAccountIds,
          reason: 'connection_unavailable',
        });
      }
      this.realtimeBus?.publishAccountRevoked(accountId);
      return {
        accountId: result.accountId,
        reasonCode: result.reasonCode,
        invalidatedMatches: result.invalidatedMatches,
      };
    });
  }

  /**
   * 6b. Step-up self-service account deletion (Doc 04 §6 / D-P35-03 / ADR-025).
   * Immediately revokes sessions, matches, calls, discovery visibility, and schedules 30-day hard purge.
   */
  async deleteAccount(accountId: string, dto: DeleteAccountDto) {
    const account = await this.prisma.account
      .findUnique({
        where: { id: accountId },
        select: {
          id: true,
          passwordHash: true,
          accountStatus: true,
          deletedAt: true,
        },
      })
      .catch(() => null);

    if (!account || account.deletedAt) {
      throw new UnauthorizedException('Account is already deleted or unavailable.');
    }

    if ((dto.confirmPhrase || '').trim().toUpperCase() !== 'DELETE MY ACCOUNT') {
      throw new BadRequestException('Type "DELETE MY ACCOUNT" to confirm account deletion.');
    }

    if (account.passwordHash) {
      if (!dto.password || dto.password.length === 0) {
        throw new BadRequestException('Current password confirmation is required to delete your account.');
      }
      const passwordMatches = await this.crypto.verifyPasswordAsync(
        dto.password,
        account.passwordHash,
      );
      if (!passwordMatches) {
        throw new UnauthorizedException('Current password did not match.');
      }
    }

    const revoked = await this.suspendOrRestrictAccount(accountId, {
      status: 'deleted',
      actorId: accountId,
    });
    const now = new Date();
    const scheduledPurgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return {
      deleted: true,
      accountId: revoked.accountId,
      deletedAt: now.toISOString(),
      scheduledPurgeAt: scheduledPurgeAt.toISOString(),
      graceDays: 30,
      message:
        'Your account is closed, all active matches and sessions have ended, and personal data is scheduled for permanent purge after the 30-day safety window.',
    };
  }

  /**
   * 7. Get Authenticated User Context (Server Authoritative Lifecycle & Sanitized Name)
   */
  async getMe(accountId: string) {
    const account = await this.prisma.account
      .findUnique({
        where: { id: accountId },
        include: {
          eligibility: true,
          profile: {
            select: {
              id: true,
              displayName: true,
              profileStatus: true,
              isPublished: true,
              isPaused: true,
              publishedAt: true,
            },
          },
        },
      })
      .catch(() => null);

    if (!account || account.deletedAt) {
      throw new UnauthorizedException('Account not found or session invalid.');
    }

    const rawName = account.profile?.displayName || account.displayName;
    const sanitizedName = !rawName || isPrivateIdentifierLike(rawName) ? null : rawName;
    const lifecycleState = this.computeLifecycleState(
      account,
      account.eligibility,
      account.profile,
    );

    return {
      id: account.id,
      email: account.email,
      displayName: sanitizedName,
      accountStatus: account.accountStatus,
      emailVerified: Boolean(account.emailVerifiedAt),
      hasPassword: Boolean(account.passwordHash),
      lifecycleState,
      eligibility: account.eligibility,
      profile: account.profile,
    };
  }

  private async createSession(accountId: string, email: string, discoveryEligible: boolean) {
    const accessToken = this.crypto.generateJwt(
      {
        sub: accountId,
        email,
        discoveryEligible,
      },
      900,
    );

    const rawRefreshToken = this.crypto.generateOpaqueToken();
    const refreshTokenHash = this.crypto.sha256(rawRefreshToken);
    const tokenFamilyId = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.appSession
      .create({
        data: {
          accountId,
          refreshTokenHash,
          tokenFamilyId,
          lastSeenAt: now,
          expiresAt,
        },
      })
      .catch(() => null);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
    };
  }

  /**
   * Dispatches Resend email cleanly; fails loudly if configured email delivery fails.
   */
  private async dispatchEmail(toEmail: string, subject: string, html: string): Promise<void> {
    if (!process.env.RESEND_API_KEY || process.env.SKIP_EMAIL_DISPATCH === 'true') {
      return;
    }

    const fromAddress = process.env.EMAIL_FROM || 'SayMyName <auth@saymyname.in>';
    let res: Response;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [toEmail],
          subject,
          html,
        }),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Institutional email delivery service is temporarily unavailable. Please try again shortly.',
      );
    }

    if (!res.ok) {
      throw new ServiceUnavailableException(
        'Could not dispatch email to your institutional inbox. Please try again in a moment.',
      );
    }
  }

  private renderDocument10OtpEmail(otpCode: string): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #0B0B0D; border: 1px solid #23232A; border-radius: 10px; color: #F1ECE4;">
        <p style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #9C968B; margin: 0 0 8px 0;">SAYMYNAME · INSTITUTIONAL VERIFICATION</p>
        <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 12px 0; color: #F1ECE4;">Verify Your Email Address</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #C6C0B4; margin: 0 0 24px 0;">
          Enter this one-time verification code to confirm ownership of your IIT Madras BS study inbox. This code expires in 10 minutes and can be used once.
        </p>
        <div style="background: #141418; border: 1px solid #2A2A35; border-radius: 8px; padding: 18px; text-align: center; margin-bottom: 24px;">
          <span style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 0.24em; color: #A696E0;">${otpCode}</span>
        </div>
        <p style="font-size: 12px; line-height: 1.5; color: #8A8479; margin: 0;">
          Email ownership is an initial step only and does not unlock dating features before age (18+) and student enrolment verification complete. Independent platform — not affiliated with IIT Madras.
        </p>
      </div>
    `;
  }

  private renderDocument10ResetEmail(resetLink: string): string {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #0B0B0D; border: 1px solid #23232A; border-radius: 10px; color: #F1ECE4;">
        <p style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #9C968B; margin: 0 0 8px 0;">SAYMYNAME · ACCOUNT RECOVERY</p>
        <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 12px 0; color: #F1ECE4;">Reset Your Password</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #C6C0B4; margin: 0 0 24px 0;">
          A password reset was requested for your SayMyName account. Completing this reset will sign out all other active sessions. This link expires in 30 minutes.
        </p>
        <div style="margin-bottom: 24px;">
          <a href="${resetLink}" style="display: inline-block; background: #8E7CC3; color: #0B0B0D; font-weight: 600; font-size: 14px; padding: 12px 22px; border-radius: 6px; text-decoration: none;">Set New Password</a>
        </div>
        <p style="font-size: 12px; line-height: 1.5; color: #8A8479; margin: 0;">
          If you did not request a password reset, you can safely ignore this message.
        </p>
      </div>
    `;
  }
}
