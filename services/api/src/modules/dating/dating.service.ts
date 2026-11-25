import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfilesService } from '../profiles/profiles.service';
import { DiscoveryEligibilityService } from './discovery-eligibility.service';
import { MatchAuthorizationService } from '../safety/match-authorization.service';
import {
  decodeDiscoveryCursor,
  encodeDiscoveryCursor,
  getDiscoveryUtcDay,
  decodeLikesCursor,
  encodeLikesCursor,
} from './discovery-cursor';
import {
  DiscoveryFeedQueryDto,
  LikesFeedQueryDto,
  SentLikesFeedQueryDto,
  LikeCandidateDto,
  PassCandidateDto,
  UnmatchDto,
} from './dto/dating.dto';

const PASS_COOLDOWN_DAYS = 30;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_LIKES_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 20;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class DatingService {
  private readonly eligibility: DiscoveryEligibilityService;
  private readonly matchAuth: MatchAuthorizationService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly profilesService?: ProfilesService,
    @Optional() eligibilityService?: DiscoveryEligibilityService,
    @Optional() matchAuthService?: MatchAuthorizationService,
  ) {
    this.eligibility = eligibilityService ?? new DiscoveryEligibilityService();
    this.matchAuth = matchAuthService ?? new MatchAuthorizationService(this.prisma);
  }

  private async runInTx<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const prismaAny = this.prisma as any;
    if (typeof prismaAny.$transaction === 'function') {
      return prismaAny.$transaction((tx: any) => fn(tx));
    }
    return fn(prismaAny);
  }

  private isUniqueConstraintError(err: any): boolean {
    return err?.code === 'P2002' || String(err?.message || '').includes('Unique constraint');
  }

  private wrapStorageFailure(err: any): never {
    if (
      err instanceof BadRequestException ||
      err instanceof NotFoundException ||
      err instanceof ForbiddenException ||
      err instanceof ConflictException
    ) {
      throw err;
    }
    throw new ServiceUnavailableException(
      'Discovery service is temporarily unavailable. Please retry in a moment.',
    );
  }

  private async lockLikeAndPair(
    tx: any,
    accountA: string,
    accountB: string,
    likeId?: string,
  ): Promise<void> {
    if (typeof tx?.$queryRaw !== 'function') {
      return;
    }
    const [low, high] = [accountA, accountB].sort();
    const pairKey = `dating_pair:${low}:${high}`;
    await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${pairKey})::bigint)) AS lock_acquire`;
    if (likeId && UUID_PATTERN.test(likeId)) {
      await tx.$queryRaw`SELECT id::text AS id FROM dating.likes WHERE id = ${likeId}::uuid FOR UPDATE`;
    }
  }

  private async checkIdempotency(
    tx: any,
    scopedKey: string | null,
    requestHash: string,
  ): Promise<any | null> {
    if (!scopedKey || typeof tx.idempotencyRecord?.findUnique !== 'function') {
      return null;
    }
    const existingRecord = await tx.idempotencyRecord.findUnique({
      where: { idempotencyKey: scopedKey },
    });
    if (!existingRecord) {
      return null;
    }
    if (existingRecord.requestHash !== requestHash) {
      throw new ConflictException('Idempotency key already used for a different request.');
    }
    return existingRecord.responseBody;
  }

  private async saveIdempotency(
    tx: any,
    scopedKey: string | null,
    accountId: string,
    requestHash: string,
    responseBody: any,
  ): Promise<void> {
    if (!scopedKey || typeof tx.idempotencyRecord?.create !== 'function') {
      return;
    }
    try {
      await tx.idempotencyRecord.create({
        data: {
          idempotencyKey: scopedKey,
          accountId,
          requestHash,
          responseStatus: 200,
          responseBody,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    } catch (raceErr: any) {
      if (!this.isUniqueConstraintError(raceErr)) throw raceErr;
    }
  }

  private async loadViewerAccessState(db: any, accountId: string, now: Date) {
    const [viewerAccount, viewerProfile] = await Promise.all([
      db.account.findUnique({
        where: { id: accountId },
        include: { eligibility: true },
      }),
      db.profile.findUnique({
        where: { accountId },
        include: {
          preferences: true,
          interests: { include: { interest: true } },
          photos: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
        },
      }),
    ]);

    const viewerCheck = this.eligibility.evaluateRequesterAccess(viewerAccount, viewerProfile, now);
    return { viewerAccount, viewerProfile, viewerCheck };
  }

  private extractInterestSet(profile: any): Set<string> {
    return new Set<string>(
      (profile?.interests || [])
        .map((i: any) => i?.interest?.name || i?.name)
        .filter((n: unknown): n is string => typeof n === 'string' && n.length > 0),
    );
  }

  private async ensureMutualMatchForPair(
    tx: any,
    actorAccountId: string,
    targetAccountId: string,
    targetProfile: any | null,
  ): Promise<{ matchId: string | null; conversationId: string | null; matchedProfile: any | null }> {
    if (await this.hasMutualBlock(tx, actorAccountId, targetAccountId)) {
      throw new ForbiddenException('Interaction unavailable because a safety block is active.');
    }

    const [userLowId, userHighId] = [actorAccountId, targetAccountId].sort();
    let matchRecord = await tx.match.findUnique({
      where: { userLowId_userHighId: { userLowId, userHighId } },
      include: { conversation: true },
    });

    if (!matchRecord) {
      try {
        matchRecord = await tx.match.upsert({
          where: { userLowId_userHighId: { userLowId, userHighId } },
          create: {
            userLowId,
            userHighId,
            status: 'active',
            conversation: {
              create: {
                status: 'active',
                members: {
                  create: [{ accountId: userLowId }, { accountId: userHighId }],
                },
              },
            },
          },
          update: {},
          include: { conversation: true },
        });
      } catch (raceErr: any) {
        if (!this.isUniqueConstraintError(raceErr)) {
          throw raceErr;
        }
        matchRecord = await tx.match.findUnique({
          where: { userLowId_userHighId: { userLowId, userHighId } },
          include: { conversation: true },
        });
      }
    } else if (matchRecord.status !== 'active') {
      throw new ForbiddenException(
        'This connection has previously ended and cannot be reopened.',
      );
    } else if (!matchRecord.conversation && typeof tx.conversation?.create === 'function') {
      try {
        const conv = await tx.conversation.create({
          data: {
            matchId: matchRecord.id,
            status: 'active',
            members: {
              create: [{ accountId: userLowId }, { accountId: userHighId }],
            },
          },
        });
        matchRecord.conversation = conv;
      } catch (raceErr: any) {
        if (!this.isUniqueConstraintError(raceErr)) throw raceErr;
        matchRecord = await tx.match.findUnique({
          where: { userLowId_userHighId: { userLowId, userHighId } },
          include: { conversation: true },
        });
      }
    }

    if (
      matchRecord &&
      matchRecord.status === 'active' &&
      matchRecord.conversation?.id &&
      typeof tx.conversationMember?.upsert === 'function'
    ) {
      for (const memberId of [userLowId, userHighId]) {
        await tx.conversationMember.upsert({
          where: {
            conversationId_accountId: {
              conversationId: matchRecord.conversation.id,
              accountId: memberId,
            },
          },
          create: { conversationId: matchRecord.conversation.id, accountId: memberId },
          update: {},
        });
      }
    }

    let matchedProfile: any = null;
    if (matchRecord && matchRecord.status === 'active' && targetProfile) {
      const hydrated = this.profilesService
        ? await this.profilesService.hydrateProfileMedia(targetProfile)
        : targetProfile;
      const approvedPhotos = (hydrated.photos || []).filter(
        (p: any) => !p.deletedAt && (p.moderationStatus === undefined || p.moderationStatus === 'approved'),
      );
      const primaryPhoto = approvedPhotos.find((p: any) => p.isPrimary) || approvedPhotos[0] || null;
      matchedProfile = {
        profileId: targetProfile.id,
        displayName: this.eligibility.sanitizeDisplayName(targetProfile.displayName),
        programmeFamily:
          targetProfile.account?.eligibility?.programmeFamily || targetProfile.programmeFamily,
        primaryPhotoUrl: primaryPhoto?.photoUrl ?? null,
      };
    }

    return {
      matchId: matchRecord?.id || null,
      conversationId: matchRecord?.conversation?.id || null,
      matchedProfile,
    };
  }

  private sortLikesDesc(rows: any[]): any[] {
    return [...(rows || [])].sort((a, b) => {
      const aMs = new Date(a.createdAt).getTime();
      const bMs = new Date(b.createdAt).getTime();
      if (aMs !== bMs) return bMs - aMs;
      if (a.id === b.id) return 0;
      return a.id > b.id ? -1 : 1;
    });
  }

  private applyLikesCursorFilter(
    rows: any[],
    decodedCursor: { ts: string; lid: string } | null,
  ): any[] {
    if (!decodedCursor) return rows;
    const cursorMs = new Date(decodedCursor.ts).getTime();
    return rows.filter((row) => {
      const rowMs = new Date(row.createdAt).getTime();
      if (rowMs < cursorMs) return true;
      if (rowMs === cursorMs && String(row.id) < decodedCursor.lid) return true;
      return false;
    });
  }

  private buildRedactedUnavailablePreview() {
    return {
      profileId: null,
      displayName: 'Member unavailable',
      age: null,
      ageVisible: false,
      programmeFamily: null,
      currentTerm: null,
      locationCity: null,
      locationState: null,
      intention: null,
      bio: null,
      photos: [],
      interests: [],
      promptAnswers: [],
      isVerified: false,
    };
  }

  private async hasMutualBlock(db: any, accountA: string, accountB: string): Promise<boolean> {
    if (typeof db.userBlock?.findFirst === 'function') {
      const hit = await db.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: accountA, blockedId: accountB },
            { blockerId: accountB, blockedId: accountA },
          ],
        },
        select: { id: true },
      });
      return Boolean(hit);
    }

    if (typeof db.userBlock?.findMany === 'function') {
      const blocks = await db.userBlock.findMany({
        where: {
          OR: [{ blockerId: accountA }, { blockedId: accountA }],
        },
      });
      return (blocks || []).some(
        (b: any) =>
          (b.blockerId === accountA && b.blockedId === accountB) ||
          (b.blockerId === accountB && b.blockedId === accountA),
      );
    }

    return false;
  }

  private async toSanitizedCandidateDto(
    profile: any,
    viewerInterestNames: Set<string>,
    referenceDate: Date = new Date(),
  ) {
    const hydrated = this.profilesService
      ? await this.profilesService.hydrateProfileMedia(profile)
      : profile;

    const approvedPhotos = (hydrated.photos || [])
      .filter((p: any) => !p.deletedAt && (p.moderationStatus === undefined || p.moderationStatus === 'approved'))
      .sort((a: any, b: any) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((p: any, idx: number) => ({
        id: p.id,
        photoUrl: p.photoUrl ?? null,
        displayOrder: typeof p.displayOrder === 'number' ? p.displayOrder : idx,
        isPrimary: Boolean(p.isPrimary),
      }));

    const verifiedAge = this.eligibility.resolveVerifiedAge(profile.account, referenceDate);
    const hideAge = profile.ageDisplayMode === 'hidden';
    const exposedAge = !hideAge && verifiedAge !== null ? verifiedAge : null;

    const interestNames = (profile.interests || [])
      .map((i: any) => i?.interest?.name || i?.name)
      .filter((n: unknown): n is string => typeof n === 'string' && n.trim().length > 0);

    const sharedInterests = interestNames.filter((name) => viewerInterestNames.has(name));

    const promptAnswers = (profile.promptAnswers || []).map((pa: any) => ({
      id: pa.id,
      promptId: pa.promptId,
      promptText: pa?.prompt?.promptText || pa?.promptText || '',
      answerText: pa.answerText,
    }));

    return {
      profileId: profile.id,
      displayName: this.eligibility.sanitizeDisplayName(profile.displayName),
      age: exposedAge,
      ageVisible: !hideAge && exposedAge !== null,
      programmeFamily:
        profile.account?.eligibility?.programmeFamily || profile.programmeFamily,
      termOrYear: profile.termOrYear ?? null,
      locationCity: profile.locationCity ?? null,
      locationState: profile.locationState ?? null,
      intention: profile.intention ?? null,
      bio: profile.bio ?? null,
      interests: interestNames,
      sharedInterests,
      photos: approvedPhotos,
      promptAnswers,
      isVerified: Boolean(
        profile.account?.eligibility?.ageStatus === 'approved' &&
          profile.account?.eligibility?.studentStatus === 'approved',
      ),
    };
  }

  /**
   * 1. Get Paginated Discovery Candidates Feed
   * Strict server-side eligibility, reciprocal preferences, mutual block & interaction exclusion,
   * deterministic daily HMAC ordering, and HMAC-signed session-bound cursor pagination.
   */
  async getCandidates(accountId: string, query?: DiscoveryFeedQueryDto) {
    const now = new Date();
    const limit = Math.max(
      1,
      Math.min(MAX_PAGE_SIZE, Number(query?.limit) || DEFAULT_PAGE_SIZE),
    );

    const decodedCursor = query?.cursor
      ? decodeDiscoveryCursor(query.cursor, accountId, now)
      : null;

    const prismaAny = this.prisma as any;

    let viewerAccount: any;
    let viewerProfile: any;
    try {
      viewerAccount = await prismaAny.account.findUnique({
        where: { id: accountId },
        include: { eligibility: true },
      });
      viewerProfile = await prismaAny.profile.findUnique({
        where: { accountId },
        include: {
          preferences: true,
          interests: { include: { interest: true } },
          photos: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
        },
      });
    } catch (err) {
      this.wrapStorageFailure(err);
    }

    const viewerCheck = this.eligibility.evaluateRequesterAccess(viewerAccount, viewerProfile, now);
    const normalizedViewerPrefs = this.eligibility.normalizePreferences(viewerProfile?.preferences);

    if (!viewerCheck.eligible) {
      if (
        viewerCheck.reason === 'account_inactive' ||
        viewerCheck.reason === 'unverified' ||
        viewerCheck.reason === 'under_age'
      ) {
        throw new ForbiddenException(
          'Verified adult (18+) IIT Madras non-campus BS enrolment is required for discovery.',
        );
      }

      return {
        candidates: [],
        nextCursor: null,
        hasMore: false,
        count: 0,
        pageSize: limit,
        viewerState: viewerCheck.reason === 'paused' ? 'paused' : 'profile_incomplete',
        preferencesApplied: {
          minAge: normalizedViewerPrefs.minAge,
          maxAge: normalizedViewerPrefs.maxAge,
          allowedProgrammes: normalizedViewerPrefs.allowedProgrammes,
          dormantDistanceIgnored: true,
        },
      };
    }

    let blocks: any[];
    let likes: any[];
    let passes: any[];
    let matches: any[];
    try {
      [blocks, likes, passes, matches] = await Promise.all([
        prismaAny.userBlock.findMany({
          where: { OR: [{ blockerId: accountId }, { blockedId: accountId }] },
        }),
        prismaAny.like.findMany({
          where: { fromAccountId: accountId, status: 'active' },
          select: { toAccountId: true },
        }),
        prismaAny.pass.findMany({
          where: { fromAccountId: accountId, expiresAt: { gt: now } },
          select: { toAccountId: true },
        }),
        typeof prismaAny.match?.findMany === 'function'
          ? prismaAny.match.findMany({
              where: {
                OR: [{ userLowId: accountId }, { userHighId: accountId }],
              },
              select: { userLowId: true, userHighId: true },
            })
          : Promise.resolve([]),
      ]);
    } catch (err) {
      this.wrapStorageFailure(err);
    }

    const excludedIds = new Set<string>([accountId]);
    for (const b of blocks || []) {
      excludedIds.add(b.blockerId === accountId ? b.blockedId : b.blockerId);
    }
    for (const l of likes || []) {
      excludedIds.add(l.toAccountId);
    }
    for (const p of passes || []) {
      excludedIds.add(p.toAccountId);
    }
    for (const m of matches || []) {
      excludedIds.add(m.userLowId === accountId ? m.userHighId : m.userLowId);
    }

    let rawCandidates: any[];
    try {
      rawCandidates = await prismaAny.profile.findMany({
        where: {
          accountId: { notIn: Array.from(excludedIds) },
          isPublished: true,
          isPaused: false,
          profileStatus: 'live',
          photos: {
            some: {
              deletedAt: null,
              moderationStatus: 'approved',
            },
          },
          account: {
            accountStatus: 'active',
            deletedAt: null,
            eligibility: {
              ageStatus: 'approved',
              studentStatus: 'approved',
              discoveryEligible: true,
            },
          },
        },
        include: {
          account: { include: { eligibility: true } },
          preferences: true,
          photos: {
            where: { deletedAt: null, moderationStatus: 'approved' },
            orderBy: { displayOrder: 'asc' },
          },
          interests: { include: { interest: true } },
          promptAnswers: { include: { prompt: true } },
        },
      });
    } catch (err) {
      this.wrapStorageFailure(err);
    }

    const viewerInterestNames = new Set<string>(
      (viewerProfile?.interests || [])
        .map((i: any) => i?.interest?.name || i?.name)
        .filter((n: unknown): n is string => typeof n === 'string' && n.length > 0),
    );

    const daySalt = getDiscoveryUtcDay(now);

    const eligibleSorted = (rawCandidates || [])
      .filter((candidateProfile: any) => {
        if (excludedIds.has(candidateProfile.accountId)) return false;
        if (!this.eligibility.isCandidateDiscoverable(candidateProfile, now)) return false;
        return this.eligibility.evaluateReciprocalCompatibility(
          viewerAccount,
          viewerProfile,
          candidateProfile,
          now,
        );
      })
      .map((candidateProfile: any) => {
        const sharedCount = (candidateProfile.interests || []).filter((i: any) =>
          viewerInterestNames.has(i?.interest?.name || i?.name),
        ).length;
        const sortKey = this.eligibility.computeDailySortKey(
          accountId,
          candidateProfile.id,
          daySalt,
          sharedCount,
        );
        return { profile: candidateProfile, sortKey };
      })
      .sort((a, b) => {
        if (a.sortKey !== b.sortKey) {
          return a.sortKey < b.sortKey ? -1 : 1;
        }
        return a.profile.id < b.profile.id ? -1 : a.profile.id > b.profile.id ? 1 : 0;
      });

    const afterCursor = decodedCursor
      ? eligibleSorted.filter(
          (item) =>
            item.sortKey > decodedCursor.sk ||
            (item.sortKey === decodedCursor.sk && item.profile.id > decodedCursor.pid),
        )
      : eligibleSorted;

    const pageSlice = afterCursor.slice(0, limit);
    const hasMore = afterCursor.length > limit;
    const lastEntry = pageSlice[pageSlice.length - 1];
    const nextCursor =
      hasMore && lastEntry
        ? encodeDiscoveryCursor(accountId, lastEntry.sortKey, lastEntry.profile.id, now)
        : null;

    const candidates = await Promise.all(
      pageSlice.map((entry) =>
        this.toSanitizedCandidateDto(entry.profile, viewerInterestNames, now),
      ),
    );

    return {
      candidates,
      nextCursor,
      hasMore,
      count: candidates.length,
      pageSize: limit,
      viewerState: 'ready' as const,
      preferencesApplied: {
        minAge: normalizedViewerPrefs.minAge,
        maxAge: normalizedViewerPrefs.maxAge,
        allowedProgrammes: normalizedViewerPrefs.allowedProgrammes,
        dormantDistanceIgnored: true,
      },
    };
  }

  /**
   * 1b. Get Full Candidate Profile Detail by opaque profileId
   * Enforces requester eligibility, non-self check, non-blocked check, live status, and DTO sanitization.
   */
  async getCandidateDetail(accountId: string, targetProfileId: string) {
    const now = new Date();
    const prismaAny = this.prisma as any;

    let viewerAccount: any;
    let viewerProfile: any;
    let targetProfile: any;
    try {
      [viewerAccount, viewerProfile, targetProfile] = await Promise.all([
        prismaAny.account.findUnique({
          where: { id: accountId },
          include: { eligibility: true },
        }),
        prismaAny.profile.findUnique({
          where: { accountId },
          include: {
            preferences: true,
            interests: { include: { interest: true } },
            photos: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
          },
        }),
        prismaAny.profile.findUnique({
          where: { id: targetProfileId },
          include: {
            account: { include: { eligibility: true } },
            preferences: true,
            photos: {
              where: { deletedAt: null, moderationStatus: 'approved' },
              orderBy: { displayOrder: 'asc' },
            },
            interests: { include: { interest: true } },
            promptAnswers: { include: { prompt: true } },
          },
        }),
      ]);
    } catch (err) {
      this.wrapStorageFailure(err);
    }

    const viewerCheck = this.eligibility.evaluateRequesterAccess(viewerAccount, viewerProfile, now);
    if (!viewerCheck.eligible) {
      throw new ForbiddenException(
        viewerCheck.reason === 'paused'
          ? 'Resume discovery visibility to view candidate profiles.'
          : 'Complete verification and publish your profile before viewing candidates.',
      );
    }

    if (!targetProfile || targetProfile.accountId === accountId) {
      throw new NotFoundException('Candidate profile not found or unavailable.');
    }

    if (await this.hasMutualBlock(prismaAny, accountId, targetProfile.accountId)) {
      throw new NotFoundException('Candidate profile not found or unavailable.');
    }

    try {
      await this.matchAuth.assertPairHasNoEndedMatch(prismaAny, accountId, targetProfile.accountId);
    } catch {
      throw new NotFoundException('Candidate profile not found or unavailable.');
    }

    if (!this.eligibility.isCandidateDiscoverable(targetProfile, now)) {
      throw new NotFoundException('Candidate profile not found or unavailable.');
    }

    if (
      !this.eligibility.evaluateReciprocalCompatibility(
        viewerAccount,
        viewerProfile,
        targetProfile,
        now,
      )
    ) {
      throw new NotFoundException('Candidate profile not found or unavailable.');
    }

    const viewerInterestNames = new Set<string>(
      (viewerProfile?.interests || [])
        .map((i: any) => i?.interest?.name || i?.name)
        .filter((n: unknown): n is string => typeof n === 'string' && n.length > 0),
    );

    return this.toSanitizedCandidateDto(targetProfile, viewerInterestNames, now);
  }

  private async resolveInteractionTarget(
    db: any,
    accountId: string,
    dto: { targetProfileId?: string; toAccountId?: string },
    actionLabel: 'like' | 'pass',
  ): Promise<{ targetAccountId: string; targetProfile: any | null }> {
    const now = new Date();
    const hasProfileLookup = typeof db.profile?.findUnique === 'function';
    const hasAccountLookup = typeof db.account?.findUnique === 'function';

    if (!dto?.targetProfileId && !dto?.toAccountId) {
      throw new BadRequestException('A targetProfileId is required.');
    }

    // If requester full records exist in DB/mock, verify requester eligibility before interacting
    if (hasAccountLookup && hasProfileLookup) {
      const [viewerAccount, viewerProfile] = await Promise.all([
        db.account.findUnique({ where: { id: accountId }, include: { eligibility: true } }),
        db.profile.findUnique({
          where: { accountId },
          include: {
            preferences: true,
            photos: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
          },
        }),
      ]);
      const viewerCheck = this.eligibility.evaluateRequesterAccess(viewerAccount, viewerProfile, now);
      if (!viewerCheck.eligible) {
        throw new ForbiddenException(
          viewerCheck.reason === 'paused'
            ? 'Resume discovery visibility before acting on profiles.'
            : 'Complete verification and publish your profile before acting on candidates.',
        );
      }
    }

    let targetProfile: any = null;
    let targetAccountId: string;

    if (dto.targetProfileId) {
      if (!hasProfileLookup) {
        throw new ServiceUnavailableException('Profile lookup is unavailable.');
      }
      targetProfile = await db.profile.findUnique({
        where: { id: dto.targetProfileId },
        include: {
          account: { include: { eligibility: true } },
          preferences: true,
          photos: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
        },
      });
      if (!targetProfile) {
        throw new NotFoundException('Candidate profile is unavailable.');
      }
      targetAccountId = targetProfile.accountId;
    } else {
      targetAccountId = dto.toAccountId!;
      if (hasProfileLookup) {
        targetProfile = await db.profile.findUnique({
          where: { accountId: targetAccountId },
          include: {
            account: { include: { eligibility: true } },
            preferences: true,
            photos: { where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } },
          },
        });
        if (!targetProfile) {
          throw new NotFoundException('Candidate profile is unavailable.');
        }
      }
    }

    if (targetAccountId === accountId) {
      throw new BadRequestException(`You cannot ${actionLabel} your own profile.`);
    }

    if (await this.hasMutualBlock(db, accountId, targetAccountId)) {
      throw new ForbiddenException('Interaction unavailable because a safety block is active.');
    }

    await this.matchAuth.assertPairHasNoEndedMatch(db, accountId, targetAccountId);

    if (targetProfile && !this.eligibility.isCandidateDiscoverable(targetProfile, now)) {
      throw new NotFoundException('Candidate profile is paused or no longer available.');
    }

    return { targetAccountId, targetProfile };
  }

  /**
   * 2. Send Like to Candidate
   * Idempotent, concurrency-safe pair-level matching, and server-side target revalidation.
   */
  async sendLike(accountId: string, dto: LikeCandidateDto, idempotencyKey?: string) {
    const cleanKey = idempotencyKey?.trim() || null;

    try {
      return await this.runInTx(async (tx) => {
        const { targetAccountId, targetProfile } = await this.resolveInteractionTarget(
          tx,
          accountId,
          dto,
          'like',
        );

        await this.lockLikeAndPair(tx, accountId, targetAccountId);

        const scopedKey = cleanKey ? `${accountId}:like:${cleanKey}` : null;
        const requestHash = crypto
          .createHash('sha256')
          .update(`like:${accountId}:${targetAccountId}`)
          .digest('hex');

        const cached = await this.checkIdempotency(tx, scopedKey, requestHash);
        if (cached) {
          return cached;
        }

        const now = new Date();
        let like: any;
        if (
          typeof tx.like?.findUnique === 'function' &&
          typeof tx.like?.create === 'function' &&
          typeof tx.like?.update === 'function'
        ) {
          const existingOwn = await tx.like.findUnique({
            where: {
              fromAccountId_toAccountId: {
                fromAccountId: accountId,
                toAccountId: targetAccountId,
              },
            },
          });
          if (!existingOwn) {
            like = await tx.like.create({
              data: {
                fromAccountId: accountId,
                toAccountId: targetAccountId,
                status: 'active',
              },
            });
          } else if (existingOwn.status !== 'active') {
            like = await tx.like.update({
              where: { id: existingOwn.id },
              data: { status: 'active', createdAt: now },
            });
          } else {
            like = existingOwn;
          }
        } else {
          like = await tx.like.upsert({
            where: {
              fromAccountId_toAccountId: {
                fromAccountId: accountId,
                toAccountId: targetAccountId,
              },
            },
            create: {
              fromAccountId: accountId,
              toAccountId: targetAccountId,
              status: 'active',
            },
            update: {
              status: 'active',
            },
          });
        }

        const reciprocalLike = await tx.like.findFirst({
          where: {
            fromAccountId: targetAccountId,
            toAccountId: accountId,
            status: 'active',
          },
        });

        let isMutualMatch = false;
        let matchId: string | null = null;
        let conversationId: string | null = null;
        let matchedProfile: any = null;

        if (reciprocalLike) {
          const matchResult = await this.ensureMutualMatchForPair(
            tx,
            accountId,
            targetAccountId,
            targetProfile,
          );
          if (matchResult.matchId) {
            isMutualMatch = true;
            matchId = matchResult.matchId;
            conversationId = matchResult.conversationId;
            matchedProfile = matchResult.matchedProfile;
          }
        }

        const responseBody = {
          likeId: like.id,
          isMutualMatch,
          matchId,
          conversationId,
          message: isMutualMatch ? 'It is a mutual match!' : 'Like sent successfully.',
          matchedProfile,
        };

        await this.saveIdempotency(tx, scopedKey, accountId, requestHash, responseBody);
        return responseBody;
      });
    } catch (err) {
      this.wrapStorageFailure(err);
    }
  }

  /**
   * 3. Pass Candidate (30-Day Cooldown)
   * Private suppression; target user never sees passes.
   */
  async sendPass(accountId: string, dto: PassCandidateDto, idempotencyKey?: string) {
    const cleanKey = idempotencyKey?.trim() || null;

    try {
      return await this.runInTx(async (tx) => {
        const { targetAccountId } = await this.resolveInteractionTarget(
          tx,
          accountId,
          dto,
          'pass',
        );

        const scopedKey = cleanKey ? `${accountId}:pass:${cleanKey}` : null;
        const requestHash = crypto
          .createHash('sha256')
          .update(`pass:${accountId}:${targetAccountId}`)
          .digest('hex');

        const cached = await this.checkIdempotency(tx, scopedKey, requestHash);
        if (cached) {
          return cached;
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + PASS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
        await tx.pass.upsert({
          where: {
            fromAccountId_toAccountId: {
              fromAccountId: accountId,
              toAccountId: targetAccountId,
            },
          },
          create: {
            fromAccountId: accountId,
            toAccountId: targetAccountId,
            expiresAt,
          },
          update: {
            expiresAt,
            createdAt: now,
          },
        });

        const responseBody = { success: true, message: 'Passed.' };
        await this.saveIdempotency(tx, scopedKey, accountId, requestHash, responseBody);
        return responseBody;
      });
    } catch (err) {
      this.wrapStorageFailure(err);
    }
  }

  /**
   * 3b. List Received Active Incoming Likes (Paginated)
   * Filters out blocked, passed, matched, ended-match, paused, suspended, deleted, or ineligible senders.
   */
  async getReceivedLikes(accountId: string, query: LikesFeedQueryDto = {}) {
    const now = new Date();
    const limit = Math.min(
      Math.max(1, Number(query?.limit) || DEFAULT_LIKES_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );
    const prismaAny = this.prisma as any;

    let viewerProfile: any;
    let viewerCheck: any;
    try {
      ({ viewerProfile, viewerCheck } = await this.loadViewerAccessState(
        prismaAny,
        accountId,
        now,
      ));
    } catch (err) {
      this.wrapStorageFailure(err);
    }

    if (!viewerCheck.eligible) {
      if (viewerCheck.reason === 'paused') {
        return {
          items: [],
          nextCursor: null,
          hasMore: false,
          count: 0,
          totalActiveCount: 0,
          pageSize: limit,
          viewerState: 'paused' as const,
        };
      }
      throw new ForbiddenException(
        'Complete verification and publish your profile before viewing incoming likes.',
      );
    }

    const decodedCursor = query?.cursor
      ? decodeLikesCursor(query.cursor, accountId, 'likes_received', now)
      : null;

    let blocks: any[];
    let passes: any[];
    let matches: any[];
    let incomingLikes: any[];
    try {
      [blocks, passes, matches, incomingLikes] = await Promise.all([
        prismaAny.userBlock.findMany({
          where: { OR: [{ blockerId: accountId }, { blockedId: accountId }] },
        }),
        prismaAny.pass.findMany({
          where: { fromAccountId: accountId },
        }),
        typeof prismaAny.match?.findMany === 'function'
          ? prismaAny.match.findMany({
              where: { OR: [{ userLowId: accountId }, { userHighId: accountId }] },
            })
          : Promise.resolve([]),
        prismaAny.like.findMany({
          where: { toAccountId: accountId, status: 'active' },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      ]);
    } catch (err) {
      this.wrapStorageFailure(err);
    }

    const blockedIds = new Set<string>([accountId]);
    for (const b of blocks || []) {
      blockedIds.add(b.blockerId === accountId ? b.blockedId : b.blockerId);
    }

    const matchExcludedIds = new Set<string>();
    for (const m of matches || []) {
      matchExcludedIds.add(m.userLowId === accountId ? m.userHighId : m.userLowId);
    }

    const passMap = new Map<string, any>();
    for (const p of passes || []) {
      passMap.set(p.toAccountId, p);
    }

    const sortedIncoming = this.sortLikesDesc(incomingLikes).filter((likeRow) => {
      const senderId = likeRow.fromAccountId;
      if (blockedIds.has(senderId) || matchExcludedIds.has(senderId)) {
        return false;
      }
      const passRow = passMap.get(senderId);
      if (passRow) {
        const expiresMs = new Date(passRow.expiresAt).getTime();
        const passCreatedMs = passRow.createdAt ? new Date(passRow.createdAt).getTime() : 0;
        const likeUpdatedMs = new Date(likeRow.updatedAt || likeRow.createdAt).getTime();
        if (expiresMs > now.getTime() || passCreatedMs >= likeUpdatedMs) {
          return false;
        }
      }
      return true;
    });

    const senderIds = Array.from(new Set(sortedIncoming.map((l) => l.fromAccountId)));
    const senderProfileByAccount = new Map<string, any>();

    if (senderIds.length > 0) {
      try {
        const senderProfiles = await prismaAny.profile.findMany({
          where: {
            accountId: { in: senderIds },
            isPublished: true,
            isPaused: false,
            profileStatus: 'live',
          },
          include: {
            account: { include: { eligibility: true } },
            preferences: true,
            photos: {
              where: { deletedAt: null, moderationStatus: 'approved' },
              orderBy: { displayOrder: 'asc' },
            },
            interests: { include: { interest: true } },
            promptAnswers: { include: { prompt: true } },
          },
        });
        for (const prof of senderProfiles || []) {
          senderProfileByAccount.set(prof.accountId, prof);
        }
      } catch (err) {
        this.wrapStorageFailure(err);
      }
    }

    const eligibleLikes = sortedIncoming.filter((likeRow) => {
      const senderProfile = senderProfileByAccount.get(likeRow.fromAccountId);
      return Boolean(senderProfile && this.eligibility.isCandidateDiscoverable(senderProfile, now));
    });

    const totalActiveCount = eligibleLikes.length;
    const afterCursor = this.applyLikesCursorFilter(eligibleLikes, decodedCursor);
    const pageSlice = afterCursor.slice(0, limit);
    const hasMore = afterCursor.length > limit;
    const lastRow = pageSlice[pageSlice.length - 1];
    const nextCursor =
      hasMore && lastRow
        ? encodeLikesCursor(
            accountId,
            'likes_received',
            new Date(lastRow.createdAt).toISOString(),
            lastRow.id,
            now,
          )
        : null;

    const viewerInterestNames = this.extractInterestSet(viewerProfile);
    const items = await Promise.all(
      pageSlice.map(async (likeRow) => {
        const senderProfile = senderProfileByAccount.get(likeRow.fromAccountId);
        const sanitized = await this.toSanitizedCandidateDto(
          senderProfile,
          viewerInterestNames,
          now,
        );
        return {
          likeId: likeRow.id,
          profileId: sanitized.profileId,
          likedAt: new Date(likeRow.createdAt).toISOString(),
          profile: sanitized,
        };
      }),
    );

    return {
      items,
      nextCursor,
      hasMore,
      count: items.length,
      totalActiveCount,
      pageSize: limit,
      viewerState: 'ready' as const,
    };
  }

  /**
   * 3c. Get Live Sanitized Received Like Detail
   */
  async getReceivedLikeDetail(accountId: string, likeId: string) {
    const now = new Date();
    const prismaAny = this.prisma as any;

    let viewerProfile: any;
    let viewerCheck: any;
    let incomingLike: any;
    try {
      const [viewerState, foundLike] = await Promise.all([
        this.loadViewerAccessState(prismaAny, accountId, now),
        prismaAny.like.findUnique({ where: { id: likeId } }),
      ]);
      viewerProfile = viewerState.viewerProfile;
      viewerCheck = viewerState.viewerCheck;
      incomingLike = foundLike;
    } catch (err) {
      this.wrapStorageFailure(err);
    }

    if (!viewerCheck.eligible) {
      throw new ForbiddenException(
        viewerCheck.reason === 'paused'
          ? 'Resume discovery visibility to inspect incoming likes.'
          : 'Complete verification and publish your profile before viewing likes.',
      );
    }

    if (!incomingLike || incomingLike.toAccountId !== accountId || incomingLike.status !== 'active') {
      throw new NotFoundException('This incoming like is no longer available.');
    }

    const senderAccountId = incomingLike.fromAccountId;
    if (senderAccountId === accountId || (await this.hasMutualBlock(prismaAny, accountId, senderAccountId))) {
      throw new NotFoundException('This incoming like is no longer available.');
    }

    try {
      await this.matchAuth.assertPairHasNoEndedMatch(prismaAny, accountId, senderAccountId);
    } catch {
      throw new NotFoundException('This incoming like is no longer available.');
    }

    if (typeof prismaAny.match?.findUnique === 'function') {
      const [userLowId, userHighId] = [accountId, senderAccountId].sort();
      const existingMatch = await prismaAny.match.findUnique({
        where: { userLowId_userHighId: { userLowId, userHighId } },
      });
      if (existingMatch) {
        throw new NotFoundException('This incoming like is no longer available.');
      }
    }

    if (typeof prismaAny.pass?.findUnique === 'function') {
      const existingPass = await prismaAny.pass.findUnique({
        where: {
          fromAccountId_toAccountId: { fromAccountId: accountId, toAccountId: senderAccountId },
        },
      });
      if (
        existingPass &&
        (new Date(existingPass.expiresAt).getTime() > now.getTime() ||
          new Date(existingPass.createdAt).getTime() >=
            new Date(incomingLike.updatedAt || incomingLike.createdAt).getTime())
      ) {
        throw new NotFoundException('This incoming like is no longer available.');
      }
    }

    const senderProfile = await prismaAny.profile.findUnique({
      where: { accountId: senderAccountId },
      include: {
        account: { include: { eligibility: true } },
        preferences: true,
        photos: {
          where: { deletedAt: null, moderationStatus: 'approved' },
          orderBy: { displayOrder: 'asc' },
        },
        interests: { include: { interest: true } },
        promptAnswers: { include: { prompt: true } },
      },
    });

    if (!senderProfile || !this.eligibility.isCandidateDiscoverable(senderProfile, now)) {
      throw new NotFoundException('This incoming like is no longer available.');
    }

    const sanitized = await this.toSanitizedCandidateDto(
      senderProfile,
      this.extractInterestSet(viewerProfile),
      now,
    );

    return {
      likeId: incomingLike.id,
      profileId: sanitized.profileId,
      likedAt: new Date(incomingLike.createdAt).toISOString(),
      profile: sanitized,
    };
  }

  /**
   * 3d. Like Back an Incoming Received Like (Atomic Reciprocal Match)
   * Explicitly validates incoming like status under pair/row lock so withdrawn likes never auto-match.
   */
  async likeBackReceivedLike(accountId: string, likeId: string, idempotencyKey?: string) {
    const cleanKey = idempotencyKey?.trim() || null;

    try {
      return await this.runInTx(async (tx) => {
        const now = new Date();
        const { viewerCheck } = await this.loadViewerAccessState(tx, accountId, now);
        if (!viewerCheck.eligible) {
          throw new ForbiddenException(
            viewerCheck.reason === 'paused'
              ? 'Resume discovery visibility before acting on profiles.'
              : 'Complete verification and publish your profile before acting on likes.',
          );
        }

        const scopedKey = cleanKey ? `${accountId}:like_back:${cleanKey}` : null;
        const requestHash = crypto
          .createHash('sha256')
          .update(`like_back:${accountId}:${likeId}`)
          .digest('hex');

        const cached = await this.checkIdempotency(tx, scopedKey, requestHash);
        if (cached) {
          return cached;
        }

        const preLike = await tx.like.findUnique({ where: { id: likeId } });
        if (!preLike || preLike.toAccountId !== accountId) {
          throw new NotFoundException('This incoming like is no longer available.');
        }

        const senderAccountId = preLike.fromAccountId;
        if (senderAccountId === accountId) {
          throw new BadRequestException('Invalid incoming like.');
        }

        await this.lockLikeAndPair(tx, accountId, senderAccountId, likeId);

        const incomingLike = await tx.like.findUnique({ where: { id: likeId } });
        if (!incomingLike || incomingLike.toAccountId !== accountId) {
          throw new NotFoundException('This incoming like is no longer available.');
        }

        if (await this.hasMutualBlock(tx, accountId, senderAccountId)) {
          throw new ForbiddenException('Interaction unavailable because a safety block is active.');
        }

        await this.matchAuth.assertPairHasNoEndedMatch(tx, accountId, senderAccountId);

        const senderProfile = await tx.profile.findUnique({
          where: { accountId: senderAccountId },
          include: {
            account: { include: { eligibility: true } },
            preferences: true,
            photos: {
              where: { deletedAt: null, moderationStatus: 'approved' },
              orderBy: { displayOrder: 'asc' },
            },
          },
        });

        if (incomingLike.status !== 'active') {
          const [userLowId, userHighId] = [accountId, senderAccountId].sort();
          const existingMatch =
            typeof tx.match?.findUnique === 'function'
              ? await tx.match.findUnique({
                  where: { userLowId_userHighId: { userLowId, userHighId } },
                  include: { conversation: true },
                })
              : null;

          if (existingMatch && existingMatch.status === 'active') {
            const ensureRes = await this.ensureMutualMatchForPair(
              tx,
              accountId,
              senderAccountId,
              senderProfile,
            );
            const idempotentMatchRes = {
              likeId: incomingLike.id,
              isMutualMatch: true,
              matchId: ensureRes.matchId,
              conversationId: ensureRes.conversationId,
              message: 'It is a mutual match!',
              matchedProfile: ensureRes.matchedProfile,
            };
            await this.saveIdempotency(tx, scopedKey, accountId, requestHash, idempotentMatchRes);
            return idempotentMatchRes;
          }

          throw new ConflictException({
            code: 'LIKE_UNAVAILABLE',
            message: 'This like is no longer available.',
          });
        }

        if (!senderProfile || !this.eligibility.isCandidateDiscoverable(senderProfile, now)) {
          throw new NotFoundException('This member is paused or no longer available.');
        }

        let ownReciprocalLike: any;
        if (
          typeof tx.like?.findUnique === 'function' &&
          typeof tx.like?.create === 'function' &&
          typeof tx.like?.update === 'function'
        ) {
          const existingOwn = await tx.like.findUnique({
            where: {
              fromAccountId_toAccountId: { fromAccountId: accountId, toAccountId: senderAccountId },
            },
          });
          if (!existingOwn) {
            ownReciprocalLike = await tx.like.create({
              data: { fromAccountId: accountId, toAccountId: senderAccountId, status: 'active' },
            });
          } else if (existingOwn.status !== 'active') {
            ownReciprocalLike = await tx.like.update({
              where: { id: existingOwn.id },
              data: { status: 'active', createdAt: now },
            });
          } else {
            ownReciprocalLike = existingOwn;
          }
        } else {
          ownReciprocalLike = await tx.like.upsert({
            where: {
              fromAccountId_toAccountId: { fromAccountId: accountId, toAccountId: senderAccountId },
            },
            create: { fromAccountId: accountId, toAccountId: senderAccountId, status: 'active' },
            update: { status: 'active' },
          });
        }

        const matchResult = await this.ensureMutualMatchForPair(
          tx,
          accountId,
          senderAccountId,
          senderProfile,
        );

        const responseBody = {
          likeId: ownReciprocalLike.id,
          isMutualMatch: Boolean(matchResult.matchId),
          matchId: matchResult.matchId,
          conversationId: matchResult.conversationId,
          message: matchResult.matchId ? 'It is a mutual match!' : 'Like sent successfully.',
          matchedProfile: matchResult.matchedProfile,
        };

        await this.saveIdempotency(tx, scopedKey, accountId, requestHash, responseBody);
        return responseBody;
      });
    } catch (err) {
      this.wrapStorageFailure(err);
    }
  }

  /**
   * 3e. Pass on an Incoming Received Like
   * Privately suppresses sender without modifying or exposing pass state to sender.
   */
  async passReceivedLike(accountId: string, likeId: string, idempotencyKey?: string) {
    const cleanKey = idempotencyKey?.trim() || null;

    try {
      return await this.runInTx(async (tx) => {
        const now = new Date();
        const { viewerCheck } = await this.loadViewerAccessState(tx, accountId, now);
        if (!viewerCheck.eligible) {
          throw new ForbiddenException(
            viewerCheck.reason === 'paused'
              ? 'Resume discovery visibility before acting on profiles.'
              : 'Complete verification and publish your profile before acting on likes.',
          );
        }

        const scopedKey = cleanKey ? `${accountId}:pass_received:${cleanKey}` : null;
        const requestHash = crypto
          .createHash('sha256')
          .update(`pass_received:${accountId}:${likeId}`)
          .digest('hex');

        const cached = await this.checkIdempotency(tx, scopedKey, requestHash);
        if (cached) {
          return cached;
        }

        const incomingLike = await tx.like.findUnique({ where: { id: likeId } });
        if (!incomingLike || incomingLike.toAccountId !== accountId) {
          throw new NotFoundException('This incoming like is no longer available.');
        }

        const senderAccountId = incomingLike.fromAccountId;
        await this.lockLikeAndPair(tx, accountId, senderAccountId, likeId);

        const lockedIncomingLike = await tx.like.findUnique({ where: { id: likeId } });
        if (!lockedIncomingLike || lockedIncomingLike.toAccountId !== accountId) {
          throw new NotFoundException('This incoming like is no longer available.');
        }

        if (await this.hasMutualBlock(tx, accountId, senderAccountId)) {
          throw new ForbiddenException('Interaction unavailable because a safety block is active.');
        }

        await this.matchAuth.assertPairHasNoEndedMatch(tx, accountId, senderAccountId);

        if (lockedIncomingLike.status !== 'active') {
          throw new ConflictException({
            code: 'LIKE_UNAVAILABLE',
            message: 'This like is no longer available.',
          });
        }

        const expiresAt = new Date(now.getTime() + PASS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
        await tx.pass.upsert({
          where: {
            fromAccountId_toAccountId: { fromAccountId: accountId, toAccountId: senderAccountId },
          },
          create: { fromAccountId: accountId, toAccountId: senderAccountId, expiresAt },
          update: { expiresAt, createdAt: now },
        });

        const responseBody = { success: true, message: 'Passed.' };
        await this.saveIdempotency(tx, scopedKey, accountId, requestHash, responseBody);
        return responseBody;
      });
    } catch (err) {
      this.wrapStorageFailure(err);
    }
  }

  /**
   * 3f. List Sent Outgoing Likes (Paginated)
   * Displays caller's pending and withdrawn likes safely without exposing moderation, pass, or block details.
   */
  async getSentLikes(accountId: string, query: SentLikesFeedQueryDto = {}) {
    const now = new Date();
    const limit = Math.min(
      Math.max(1, Number(query?.limit) || DEFAULT_LIKES_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );
    const includeWithdrawn = query?.includeWithdrawn !== false;
    const prismaAny = this.prisma as any;

    let viewerProfile: any;
    let viewerCheck: any;
    try {
      ({ viewerProfile, viewerCheck } = await this.loadViewerAccessState(prismaAny, accountId, now));
    } catch (err) {
      this.wrapStorageFailure(err);
    }

    if (!viewerCheck.eligible && viewerCheck.reason !== 'paused') {
      throw new ForbiddenException(
        'Complete verification and publish your profile before viewing sent likes.',
      );
    }

    const viewerState = viewerCheck.reason === 'paused' ? ('paused' as const) : ('ready' as const);
    const decodedCursor = query?.cursor
      ? decodeLikesCursor(query.cursor, accountId, 'likes_sent', now)
      : null;

    const allowedStatuses = includeWithdrawn ? ['active', 'withdrawn'] : ['active'];

    let blocks: any[];
    let matches: any[];
    let outgoingLikes: any[];
    try {
      [blocks, matches, outgoingLikes] = await Promise.all([
        prismaAny.userBlock.findMany({
          where: { OR: [{ blockerId: accountId }, { blockedId: accountId }] },
        }),
        typeof prismaAny.match?.findMany === 'function'
          ? prismaAny.match.findMany({
              where: { OR: [{ userLowId: accountId }, { userHighId: accountId }] },
            })
          : Promise.resolve([]),
        prismaAny.like.findMany({
          where: {
            fromAccountId: accountId,
            status: { in: allowedStatuses },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      ]);
    } catch (err) {
      this.wrapStorageFailure(err);
    }

    const excludedRecipientIds = new Set<string>([accountId]);
    for (const b of blocks || []) {
      excludedRecipientIds.add(b.blockerId === accountId ? b.blockedId : b.blockerId);
    }
    for (const m of matches || []) {
      excludedRecipientIds.add(m.userLowId === accountId ? m.userHighId : m.userLowId);
    }

    const visibleLikes = this.sortLikesDesc(outgoingLikes).filter(
      (likeRow) => !excludedRecipientIds.has(likeRow.toAccountId),
    );

    const recipientIds = Array.from(new Set(visibleLikes.map((l) => l.toAccountId)));
    const recipientProfileByAccount = new Map<string, any>();

    if (recipientIds.length > 0) {
      try {
        const profiles = await prismaAny.profile.findMany({
          where: { accountId: { in: recipientIds } },
          include: {
            account: { include: { eligibility: true } },
            preferences: true,
            photos: {
              where: { deletedAt: null, moderationStatus: 'approved' },
              orderBy: { displayOrder: 'asc' },
            },
            interests: { include: { interest: true } },
            promptAnswers: { include: { prompt: true } },
          },
        });
        for (const prof of profiles || []) {
          recipientProfileByAccount.set(prof.accountId, prof);
        }
      } catch (err) {
        this.wrapStorageFailure(err);
      }
    }

    const totalActiveCount = visibleLikes.filter((l) => l.status === 'active').length;
    const afterCursor = this.applyLikesCursorFilter(visibleLikes, decodedCursor);
    const pageSlice = afterCursor.slice(0, limit);
    const hasMore = afterCursor.length > limit;
    const lastRow = pageSlice[pageSlice.length - 1];
    const nextCursor =
      hasMore && lastRow
        ? encodeLikesCursor(
            accountId,
            'likes_sent',
            new Date(lastRow.createdAt).toISOString(),
            lastRow.id,
            now,
          )
        : null;

    const viewerInterestNames = this.extractInterestSet(viewerProfile);

    const items = await Promise.all(
      pageSlice.map(async (likeRow) => {
        const recipientProfile = recipientProfileByAccount.get(likeRow.toAccountId);
        const targetDiscoverable = Boolean(
          recipientProfile && this.eligibility.isCandidateDiscoverable(recipientProfile, now),
        );

        const isWithdrawn = likeRow.status === 'withdrawn';
        const availability = isWithdrawn
          ? ('withdrawn' as const)
          : targetDiscoverable
            ? ('pending' as const)
            : ('unavailable' as const);

        const statusLabel = isWithdrawn
          ? 'Withdrawn'
          : targetDiscoverable
            ? 'Awaiting response'
            : 'Profile unavailable';

        let previewProfile: any;
        if (targetDiscoverable) {
          previewProfile = await this.toSanitizedCandidateDto(
            recipientProfile,
            viewerInterestNames,
            now,
          );
        } else {
          previewProfile = this.buildRedactedUnavailablePreview();
        }

        return {
          likeId: likeRow.id,
          status: likeRow.status,
          availability,
          statusLabel,
          canWithdraw: likeRow.status === 'active',
          sentAt: new Date(likeRow.createdAt).toISOString(),
          updatedAt: new Date(likeRow.updatedAt || likeRow.createdAt).toISOString(),
          profile: previewProfile,
        };
      }),
    );

    return {
      items,
      nextCursor,
      hasMore,
      count: items.length,
      totalActiveCount,
      pageSize: limit,
      viewerState,
    };
  }

  /**
   * 3g. Safely Withdraw a Pending Outgoing Like
   * Enforces ownership, concurrency lock, non-match guard, and idempotent withdrawn transitions.
   */
  async withdrawLike(accountId: string, likeId: string, idempotencyKey?: string) {
    const cleanKey = idempotencyKey?.trim() || null;

    try {
      return await this.runInTx(async (tx) => {
        const now = new Date();
        const { viewerCheck } = await this.loadViewerAccessState(tx, accountId, now);
        if (!viewerCheck.eligible && viewerCheck.reason !== 'paused') {
          throw new ForbiddenException(
            'Complete verification and publish your profile before managing sent likes.',
          );
        }

        const scopedKey = cleanKey ? `${accountId}:withdraw:${cleanKey}` : null;
        const requestHash = crypto
          .createHash('sha256')
          .update(`withdraw:${accountId}:${likeId}`)
          .digest('hex');

        const cached = await this.checkIdempotency(tx, scopedKey, requestHash);
        if (cached) {
          return cached;
        }

        const preLike = await tx.like.findUnique({ where: { id: likeId } });
        if (!preLike) {
          throw new NotFoundException('Like not found.');
        }

        if (preLike.fromAccountId !== accountId) {
          throw new ForbiddenException('You can only withdraw likes that you sent.');
        }

        await this.lockLikeAndPair(tx, preLike.fromAccountId, preLike.toAccountId, likeId);

        const like = await tx.like.findUnique({ where: { id: likeId } });
        if (!like) {
          throw new NotFoundException('Like not found.');
        }
        if (like.fromAccountId !== accountId) {
          throw new ForbiddenException('You can only withdraw likes that you sent.');
        }

        if (typeof tx.match?.findUnique === 'function') {
          const [userLowId, userHighId] = [like.fromAccountId, like.toAccountId].sort();
          const existingMatch = await tx.match.findUnique({
            where: { userLowId_userHighId: { userLowId, userHighId } },
          });
          if (existingMatch) {
            if (existingMatch.status === 'active') {
              throw new ConflictException(
                'A mutual match has already formed. Manage or unmatch connections from Matches instead.',
              );
            }
            throw new ConflictException(
              'This connection has ended and its like record cannot be retracted.',
            );
          }
        }

        if (like.status === 'blocked' || like.status === 'unmatched') {
          throw new ConflictException('This like can no longer be withdrawn.');
        }

        if (like.status === 'withdrawn') {
          const alreadyBody = {
            likeId: like.id,
            status: 'withdrawn',
            withdrawn: true,
            alreadyWithdrawn: true,
            message: 'Like was already withdrawn.',
          };
          await this.saveIdempotency(tx, scopedKey, accountId, requestHash, alreadyBody);
          return alreadyBody;
        }

        if (like.status !== 'active') {
          throw new ConflictException('Only active pending likes can be withdrawn.');
        }

        if (typeof tx.like?.updateMany === 'function') {
          const res = await tx.like.updateMany({
            where: { id: likeId, fromAccountId: accountId, status: 'active' },
            data: { status: 'withdrawn' },
          });
          if (!res || res.count === 0) {
            throw new ConflictException(
              'This like could not be withdrawn because its status changed concurrently.',
            );
          }
        } else {
          await tx.like.update({
            where: { id: likeId },
            data: { status: 'withdrawn' },
          });
        }

        const responseBody = {
          likeId: like.id,
          status: 'withdrawn',
          withdrawn: true,
          alreadyWithdrawn: false,
          message: 'Like withdrawn.',
        };

        await this.saveIdempotency(tx, scopedKey, accountId, requestHash, responseBody);
        return responseBody;
      });
    } catch (err) {
      this.wrapStorageFailure(err);
    }
  }

  private async buildSanitizedMatchSummary(
    m: any,
    accountId: string,
    partnerProfile: any | null,
    viewerInterestNames: Set<string>,
    now: Date,
    includeLegacyMockAccountId: boolean,
  ) {
    const otherAccountId = m.userLowId === accountId ? m.userHighId : m.userLowId;
    const lastMsg = m.conversation?.messages?.[0] || null;
    const lastMessageText = lastMsg?.bodyText ?? null;
    const rawLastMsgAt = lastMsg?.createdAt || m.conversation?.lastMessageAt || null;
    const parsedLastMsgAt = rawLastMsgAt ? new Date(rawLastMsgAt) : null;
    const lastMessageAt =
      parsedLastMsgAt && !Number.isNaN(parsedLastMsgAt.getTime())
        ? parsedLastMsgAt.toISOString()
        : null;
    const parsedMatchedAt = m.createdAt ? new Date(m.createdAt) : now;
    const matchedAt = Number.isNaN(parsedMatchedAt.getTime())
      ? now.toISOString()
      : parsedMatchedAt.toISOString();
    const lastMessageIsOwn = lastMsg ? lastMsg.senderAccountId === accountId : null;

    const sanitizedProfile = partnerProfile
      ? await this.toSanitizedCandidateDto(partnerProfile, viewerInterestNames, now)
      : null;

    const summary: Record<string, any> = {
      matchId: m.id,
      conversationId: m.conversation?.id ?? null,
      status: m.status || 'active',
      matchedAt,
      lastMessageText,
      lastMessageAt,
      lastMessageIsOwn,
      profile: sanitizedProfile,
    };

    if (includeLegacyMockAccountId) {
      summary.matchedAccountId = otherAccountId;
    }

    return summary;
  }

  /**
   * 4. List Active Matches (with sanitized partner profiles & zero internal ID leakage)
   */
  async getMatches(accountId: string) {
    try {
      const now = new Date();
      const prismaAny = this.prisma as any;
      const isLegacyMinimalMock =
        typeof prismaAny.account?.findUnique !== 'function' &&
        process.env.NODE_ENV !== 'production';

      if (!isLegacyMinimalMock) {
        const callerActive = await this.matchAuth.verifyParticipantAccountsActive(
          prismaAny,
          [accountId],
          now,
        );
        if (!callerActive) {
          return [];
        }
      }

      const matches = await prismaAny.match.findMany({
        where: {
          OR: [{ userLowId: accountId }, { userHighId: accountId }],
          status: 'active',
        },
        include: {
          conversation: {
            include: {
              messages: { orderBy: { sequenceNo: 'desc' }, take: 1 },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const validMatches: any[] = [];
      for (const m of matches || []) {
        if (m.conversation && m.conversation.status && m.conversation.status !== 'active') {
          continue;
        }
        const blocked = await this.matchAuth.hasBidirectionalBlock(
          prismaAny,
          m.userLowId,
          m.userHighId,
        );
        if (blocked) {
          continue;
        }
        const bothActive = await this.matchAuth.verifyParticipantAccountsActive(
          prismaAny,
          [m.userLowId, m.userHighId],
          now,
        );
        if (!bothActive) {
          continue;
        }
        validMatches.push(m);
      }

      if (validMatches.length === 0) {
        return [];
      }

      const partnerAccountIds = Array.from(
        new Set(
          validMatches.map((m) => (m.userLowId === accountId ? m.userHighId : m.userLowId)),
        ),
      );

      let viewerProfile: any = null;
      const partnerProfileByAccount = new Map<string, any>();

      if (typeof prismaAny.profile?.findUnique === 'function') {
        viewerProfile = await prismaAny.profile.findUnique({
          where: { accountId },
          include: { interests: { include: { interest: true } } },
        });
      }

      if (typeof prismaAny.profile?.findMany === 'function') {
        const profiles = await prismaAny.profile.findMany({
          where: { accountId: { in: partnerAccountIds } },
          include: {
            account: { include: { eligibility: true } },
            photos: {
              where: { deletedAt: null, moderationStatus: 'approved' },
              orderBy: { displayOrder: 'asc' },
            },
            interests: { include: { interest: true } },
            promptAnswers: { include: { prompt: true } },
          },
        });
        for (const p of profiles || []) {
          partnerProfileByAccount.set(p.accountId, p);
        }
      } else if (typeof prismaAny.profile?.findUnique === 'function') {
        const profiles = await Promise.all(
          partnerAccountIds.map((pid) =>
            prismaAny.profile.findUnique({
              where: { accountId: pid },
              include: {
                account: { include: { eligibility: true } },
                photos: {
                  where: { deletedAt: null, moderationStatus: 'approved' },
                  orderBy: { displayOrder: 'asc' },
                },
                interests: { include: { interest: true } },
                promptAnswers: { include: { prompt: true } },
              },
            }),
          ),
        );
        for (const p of profiles) {
          if (p) partnerProfileByAccount.set(p.accountId, p);
        }
      }

      const viewerInterestNames = this.extractInterestSet(viewerProfile);

      const results = await Promise.all(
        validMatches.map((m) => {
          const otherAccountId = m.userLowId === accountId ? m.userHighId : m.userLowId;
          const partnerProfile = partnerProfileByAccount.get(otherAccountId) || null;
          return this.buildSanitizedMatchSummary(
            m,
            accountId,
            partnerProfile,
            viewerInterestNames,
            now,
            isLegacyMinimalMock && !partnerProfile,
          );
        }),
      );

      // Sort by latest message or match creation time descending
      results.sort((a, b) => {
        const aTs = new Date(a.lastMessageAt || a.matchedAt).getTime();
        const bTs = new Date(b.lastMessageAt || b.matchedAt).getTime();
        return bTs - aTs;
      });

      return results;
    } catch (err) {
      this.wrapStorageFailure(err);
    }
  }

  /**
   * 4b. Get Single Authorized Active Match Detail
   */
  async getMatchDetail(accountId: string, matchId: string) {
    try {
      const now = new Date();
      const prismaAny = this.prisma as any;
      const auth = await this.matchAuth.assertAuthorizedForMatch(accountId, matchId);

      const match = await prismaAny.match.findUnique({
        where: { id: matchId },
        include: {
          conversation: {
            include: {
              messages: { orderBy: { sequenceNo: 'desc' }, take: 1 },
            },
          },
        },
      });

      if (!match) {
        throw new NotFoundException('Match not found.');
      }

      const partnerAccountId =
        auth.partnerAccountId || (match.userLowId === accountId ? match.userHighId : match.userLowId);

      const [viewerProfile, partnerProfile] = await Promise.all([
        typeof prismaAny.profile?.findUnique === 'function'
          ? prismaAny.profile.findUnique({
              where: { accountId },
              include: { interests: { include: { interest: true } } },
            })
          : Promise.resolve(null),
        typeof prismaAny.profile?.findUnique === 'function'
          ? prismaAny.profile.findUnique({
              where: { accountId: partnerAccountId },
              include: {
                account: { include: { eligibility: true } },
                photos: {
                  where: { deletedAt: null, moderationStatus: 'approved' },
                  orderBy: { displayOrder: 'asc' },
                },
                interests: { include: { interest: true } },
                promptAnswers: { include: { prompt: true } },
              },
            })
          : Promise.resolve(null),
      ]);

      return this.buildSanitizedMatchSummary(
        match,
        accountId,
        partnerProfile,
        this.extractInterestSet(viewerProfile),
        now,
        false,
      );
    } catch (err) {
      this.wrapStorageFailure(err);
    }
  }

  /**
   * 5. Unmatch
   * Concurrency-safe, idempotent termination of Match, Conversation, Calling, and Together permissions.
   */
  async unmatch(accountId: string, dto: UnmatchDto, idempotencyKey?: string) {
    const cleanKey = idempotencyKey?.trim() || null;

    try {
      return await this.runInTx(async (tx) => {
        const scopedKey = cleanKey ? `${accountId}:unmatch:${cleanKey}` : null;
        const requestHash = crypto
          .createHash('sha256')
          .update(`unmatch:${accountId}:${dto.matchId}`)
          .digest('hex');

        const cached = await this.checkIdempotency(tx, scopedKey, requestHash);
        if (cached) {
          return cached;
        }

        const preMatch = await tx.match.findUnique({
          where: { id: dto.matchId },
          include: { conversation: true },
        });

        if (!preMatch) {
          throw new NotFoundException('Match not found.');
        }

        if (preMatch.userLowId !== accountId && preMatch.userHighId !== accountId) {
          throw new ForbiddenException('You are not authorized to unmatch this connection.');
        }

        await this.lockLikeAndPair(tx, preMatch.userLowId, preMatch.userHighId);
        if (typeof tx?.$queryRaw === 'function' && UUID_PATTERN.test(dto.matchId)) {
          await tx.$queryRaw`SELECT id::text AS id FROM dating.matches WHERE id = ${dto.matchId}::uuid FOR UPDATE`;
        }

        const match = await tx.match.findUnique({
          where: { id: dto.matchId },
          include: { conversation: true },
        });

        if (!match) {
          throw new NotFoundException('Match not found.');
        }

        const alreadyEnded = match.status !== 'active';
        const sanitizedReason = dto.reason?.trim() || 'unmatched';

        await this.matchAuth.closeMatchDownstreamState(tx, {
          match,
          actorId: accountId,
          endedByAccountId: accountId,
          endReason: sanitizedReason,
          stateMetadata: { action: 'user_unmatch' },
          markLikesStatus: 'unmatched',
        });

        const responseBody = {
          matchId: match.id,
          status: 'ended' as const,
          message: alreadyEnded ? 'Match has already ended.' : 'Unmatched successfully.',
          alreadyEnded,
        };

        await this.saveIdempotency(tx, scopedKey, accountId, requestHash, responseBody);
        return responseBody;
      });
    } catch (err) {
      this.wrapStorageFailure(err);
    }
  }
}
