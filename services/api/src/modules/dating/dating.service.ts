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
} from './discovery-cursor';
import {
  DiscoveryFeedQueryDto,
  LikeCandidateDto,
  PassCandidateDto,
  UnmatchDto,
} from './dto/dating.dto';

const PASS_COOLDOWN_DAYS = 30;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 20;

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

        const scopedKey = cleanKey ? `${accountId}:like:${cleanKey}` : null;
        const requestHash = crypto
          .createHash('sha256')
          .update(`like:${accountId}:${targetAccountId}`)
          .digest('hex');

        const hasIdempotencyStore = typeof tx.idempotencyRecord?.findUnique === 'function';
        if (scopedKey && hasIdempotencyStore) {
          const existingRecord = await tx.idempotencyRecord.findUnique({
            where: { idempotencyKey: scopedKey },
          });
          if (existingRecord) {
            if (existingRecord.requestHash !== requestHash) {
              throw new ConflictException('Idempotency key already used for a different candidate.');
            }
            return existingRecord.responseBody;
          }
        }

        const like = await tx.like.upsert({
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

        if (reciprocalLike) {
          // Final block check right before creating a bilateral match/conversation
          if (await this.hasMutualBlock(tx, accountId, targetAccountId)) {
            throw new ForbiddenException('Interaction unavailable because a safety block is active.');
          }

          const [userLowId, userHighId] = [accountId, targetAccountId].sort();
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
          } else if (matchRecord.status === 'active' && !matchRecord.conversation && typeof tx.conversation?.create === 'function') {
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

          if (matchRecord && matchRecord.status === 'active') {
            isMutualMatch = true;
            matchId = matchRecord.id;
            conversationId = matchRecord.conversation?.id || null;
          }
        }

        let matchedProfile: any = null;
        if (isMutualMatch && targetProfile) {
          const hydrated = this.profilesService
            ? await this.profilesService.hydrateProfileMedia(targetProfile)
            : targetProfile;
          const approvedPhotos = (hydrated.photos || []).filter(
            (p: any) => !p.deletedAt && (p.moderationStatus === undefined || p.moderationStatus === 'approved'),
          );
          const primaryPhoto =
            approvedPhotos.find((p: any) => p.isPrimary) || approvedPhotos[0] || null;
          matchedProfile = {
            profileId: targetProfile.id,
            displayName: this.eligibility.sanitizeDisplayName(targetProfile.displayName),
            programmeFamily:
              targetProfile.account?.eligibility?.programmeFamily || targetProfile.programmeFamily,
            primaryPhotoUrl: primaryPhoto?.photoUrl ?? null,
          };
        }

        const responseBody = {
          likeId: like.id,
          isMutualMatch,
          matchId,
          conversationId,
          message: isMutualMatch ? 'It is a mutual match!' : 'Like sent successfully.',
          matchedProfile,
        };

        if (scopedKey && hasIdempotencyStore) {
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

        const hasIdempotencyStore = typeof tx.idempotencyRecord?.findUnique === 'function';
        if (scopedKey && hasIdempotencyStore) {
          const existingRecord = await tx.idempotencyRecord.findUnique({
            where: { idempotencyKey: scopedKey },
          });
          if (existingRecord) {
            if (existingRecord.requestHash !== requestHash) {
              throw new ConflictException('Idempotency key already used for a different candidate.');
            }
            return existingRecord.responseBody;
          }
        }

        const expiresAt = new Date(Date.now() + PASS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
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
          },
        });

        const responseBody = { success: true, message: 'Passed.' };

        if (scopedKey && hasIdempotencyStore) {
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

        return responseBody;
      });
    } catch (err) {
      this.wrapStorageFailure(err);
    }
  }

  /**
   * 4. List Active Matches
   */
  async getMatches(accountId: string) {
    try {
      const matches = await this.prisma.match.findMany({
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

      const activeMatches: any[] = [];
      for (const m of matches) {
        if (m.conversation && m.conversation.status && m.conversation.status !== 'active') {
          continue;
        }
        const blocked = await this.matchAuth.hasBidirectionalBlock(
          this.prisma,
          m.userLowId,
          m.userHighId,
        );
        if (blocked) {
          continue;
        }
        const bothActive = await this.matchAuth.verifyParticipantAccountsActive(this.prisma, [
          m.userLowId,
          m.userHighId,
        ]);
        if (!bothActive) {
          continue;
        }
        const otherAccountId = m.userLowId === accountId ? m.userHighId : m.userLowId;
        activeMatches.push({
          matchId: m.id,
          matchedAccountId: otherAccountId,
          conversationId: m.conversation?.id,
          lastMessage: m.conversation?.messages?.[0] || null,
          createdAt: m.createdAt,
        });
      }

      return activeMatches;
    } catch (err) {
      this.wrapStorageFailure(err);
    }
  }

  /**
   * 5. Unmatch
   * Idempotently closes active Match, Conversation, Calling, and Together permissions cleanly.
   */
  async unmatch(accountId: string, dto: UnmatchDto) {
    try {
      return await this.runInTx(async (tx) => {
        const match = await tx.match.findUnique({
          where: { id: dto.matchId },
          include: { conversation: true },
        });

        if (!match) {
          throw new NotFoundException('Match not found.');
        }

        if (match.userLowId !== accountId && match.userHighId !== accountId) {
          throw new ForbiddenException('You are not authorized to unmatch this connection.');
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

        return {
          message: alreadyEnded ? 'Match has already ended.' : 'Unmatched successfully.',
          alreadyEnded,
        };
      });
    } catch (err) {
      this.wrapStorageFailure(err);
    }
  }
}
