import { describe, test } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharpModule = require('sharp');
const sharp: (input?: any, options?: any) => any = sharpModule.default || sharpModule;
import { DatingService } from '../src/modules/dating/dating.service';
import { MessagingService } from '../src/modules/messaging/messaging.service';
import {
  decodeDiscoveryCursor,
  encodeDiscoveryCursor,
} from '../src/modules/dating/discovery-cursor';
import { IdentityService } from '../src/modules/identity/identity.service';
import { ProfilesService, validateImageBinary } from '../src/modules/profiles/profiles.service';
import { verifyAndSanitizeR2Image } from '../src/modules/profiles/image-security';
import { SafetyService } from '../src/modules/safety/safety.service';
import { AccountLifecycleState, ProgrammeFamily } from '@saymyname/contracts';

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function makeDobForAge(ageYears: number, ref: Date = new Date()): Date {
  return new Date(Date.UTC(ref.getUTCFullYear() - ageYears, ref.getUTCMonth(), Math.min(28, ref.getUTCDate())));
}

function buildUserRecord(opts: {
  n: number;
  displayName: string;
  age: number;
  programme?: string;
  ageStatus?: string;
  studentStatus?: string;
  discoveryEligible?: boolean;
  accountStatus?: string;
  deletedAt?: Date | null;
  profileStatus?: string;
  isPublished?: boolean;
  isPaused?: boolean;
  ageDisplayMode?: 'show_calculated_age' | 'hidden';
  minAge?: number;
  maxAge?: number;
  allowedProgrammes?: string[];
  showInDiscovery?: boolean;
  maxDistanceKm?: number | null;
  photoModerationStatus?: string;
  interests?: string[];
  locationCity?: string | null;
  consentAcceptedAt?: Date | null;
  publishedAt?: Date | null;
  hasPhoto?: boolean;
}) {
  const accountId = uuid(100 + opts.n);
  const profileId = uuid(200 + opts.n);
  const prog = opts.programme ?? ProgrammeFamily.DATA_SCIENCE_APPLICATIONS;

  const account = {
    id: accountId,
    email: `24f${opts.n}@ds.study.iitm.ac.in`,
    emailVerifiedAt: new Date('2026-10-01T00:00:00Z'),
    accountStatus: opts.accountStatus ?? 'active',
    deletedAt: opts.deletedAt ?? null,
    eligibility: {
      accountId,
      ageStatus: opts.ageStatus ?? 'approved',
      studentStatus: opts.studentStatus ?? 'approved',
      programmeFamily: prog,
      dateOfBirth: makeDobForAge(opts.age),
      discoveryEligible: opts.discoveryEligible ?? true,
      validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  };

  const photos =
    opts.hasPhoto === false
      ? []
      : [
          {
            id: uuid(300 + opts.n),
            profileId,
            photoUrl: `https://signed.local/photo-${opts.n}.jpg`,
            s3Key: `photos/${accountId}/p1.jpg`,
            displayOrder: 0,
            isPrimary: true,
            moderationStatus: opts.photoModerationStatus ?? 'approved',
            deletedAt: null,
          },
        ];

  const profile = {
    id: profileId,
    accountId,
    displayName: opts.displayName,
    bio: `Student bio ${opts.n}`,
    programmeFamily: prog,
    termOrYear: 'Diploma Level',
    locationCity: opts.locationCity !== undefined ? opts.locationCity : 'Chennai',
    locationState: 'Tamil Nadu',
    intention: 'serious_relationship',
    profileStatus: opts.profileStatus ?? 'live',
    ageDisplayMode: opts.ageDisplayMode ?? 'show_calculated_age',
    publishedAt: opts.publishedAt !== undefined ? opts.publishedAt : new Date('2026-10-01T00:00:00Z'),
    consentAcceptedAt:
      opts.consentAcceptedAt !== undefined ? opts.consentAcceptedAt : new Date('2026-10-01T00:00:00Z'),
    isPublished: opts.isPublished ?? true,
    isPaused: opts.isPaused ?? false,
    account,
    photos,
    interests: (opts.interests ?? ['Mathematics', 'Jazz']).map((name, idx) => ({
      interest: { id: `int-${idx}`, name },
    })),
    promptAnswers: [
      {
        id: `pa-${opts.n}`,
        promptId: 'pr-1',
        prompt: { promptText: 'Weekend offline ritual?' },
        answerText: 'Filter coffee and solving linear algebra puzzles.',
      },
    ],
    preferences: {
      profileId,
      minAge: opts.minAge ?? 18,
      maxAge: opts.maxAge ?? 35,
      allowedProgrammes: opts.allowedProgrammes ?? [
        ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
        ProgrammeFamily.ELECTRONIC_SYSTEMS,
        ProgrammeFamily.AERONAUTICS_SPACE,
        ProgrammeFamily.MANAGEMENT_DATA_SCIENCE,
      ],
      maxDistanceKm: opts.maxDistanceKm ?? 10,
      showInDiscovery: opts.showInDiscovery ?? true,
    },
  };

  return { accountId, profileId, account, profile };
}

function createDiscoveryMockPrisma(users: ReturnType<typeof buildUserRecord>[]) {
  const accounts = new Map(users.map((u) => [u.accountId, u.account]));
  const profilesByAccount = new Map(users.map((u) => [u.accountId, u.profile]));
  const profilesById = new Map(users.map((u) => [u.profileId, u.profile]));

  const likes: any[] = [];
  const passes: any[] = [];
  const matches: any[] = [];
  const conversations: any[] = [];
  const blocks: any[] = [];
  const reports: any[] = [];
  const idempotencyRecords = new Map<string, any>();

  const prisma: any = {
    state: { likes, passes, matches, conversations, blocks, reports, idempotencyRecords },
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(prisma),
    account: {
      findUnique: async ({ where }: any) => accounts.get(where.id) ?? null,
    },
    profile: {
      findUnique: async ({ where }: any) => {
        if (where.id) return profilesById.get(where.id) ?? null;
        if (where.accountId) return profilesByAccount.get(where.accountId) ?? null;
        return null;
      },
      findMany: async ({ where }: any) => {
        const excluded = new Set<string>(where?.accountId?.notIn || []);
        return users
          .map((u) => u.profile)
          .filter((p) => {
            if (excluded.has(p.accountId)) return false;
            if (where.isPublished !== undefined && p.isPublished !== where.isPublished) return false;
            if (where.isPaused !== undefined && p.isPaused !== where.isPaused) return false;
            if (where.profileStatus && p.profileStatus !== where.profileStatus) return false;
            if (where.account?.accountStatus && p.account.accountStatus !== where.account.accountStatus) return false;
            if (where.account?.deletedAt === null && p.account.deletedAt !== null) return false;
            if (where.account?.eligibility) {
              const e = where.account.eligibility;
              if (e.ageStatus && p.account.eligibility.ageStatus !== e.ageStatus) return false;
              if (e.studentStatus && p.account.eligibility.studentStatus !== e.studentStatus) return false;
              if (e.discoveryEligible !== undefined && p.account.eligibility.discoveryEligible !== e.discoveryEligible) return false;
            }
            const approvedPhotos = (p.photos || []).filter(
              (ph: any) => !ph.deletedAt && ph.moderationStatus === 'approved',
            );
            if (approvedPhotos.length === 0) return false;
            return true;
          });
      },
    },
    userBlock: {
      findMany: async ({ where }: any) =>
        blocks.filter((b) =>
          (where?.OR || []).some(
            (cond: any) =>
              (cond.blockerId && b.blockerId === cond.blockerId) ||
              (cond.blockedId && b.blockedId === cond.blockedId),
          ),
        ),
      findFirst: async ({ where }: any) =>
        blocks.find((b) =>
          (where?.OR || []).some(
            (cond: any) =>
              b.blockerId === cond.blockerId && b.blockedId === cond.blockedId,
          ),
        ) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const key = where.blockerId_blockedId;
        const existing = blocks.find(
          (b) => b.blockerId === key.blockerId && b.blockedId === key.blockedId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: `blk-${blocks.length + 1}`, ...create };
        blocks.push(row);
        return row;
      },
    },
    like: {
      findMany: async ({ where }: any) =>
        likes.filter(
          (l) =>
            l.fromAccountId === where.fromAccountId &&
            (!where.status || l.status === where.status),
        ),
      findFirst: async ({ where }: any) =>
        likes.find(
          (l) =>
            l.fromAccountId === where.fromAccountId &&
            l.toAccountId === where.toAccountId &&
            (!where.status || l.status === where.status),
        ) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const key = where.fromAccountId_toAccountId;
        const existing = likes.find(
          (l) => l.fromAccountId === key.fromAccountId && l.toAccountId === key.toAccountId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: `like-${likes.length + 1}`, ...create };
        likes.push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const l of likes) {
          const matchesPair = (where?.OR || []).some(
            (cond: any) =>
              l.fromAccountId === cond.fromAccountId && l.toAccountId === cond.toAccountId,
          );
          if (matchesPair && (!where.status || l.status === where.status)) {
            Object.assign(l, data);
            count++;
          }
        }
        return { count };
      },
    },
    pass: {
      findMany: async ({ where }: any) =>
        passes.filter(
          (p) =>
            p.fromAccountId === where.fromAccountId &&
            (!where.expiresAt?.gt || new Date(p.expiresAt) > where.expiresAt.gt),
        ),
      upsert: async ({ where, create, update }: any) => {
        const key = where.fromAccountId_toAccountId;
        const existing = passes.find(
          (p) => p.fromAccountId === key.fromAccountId && p.toAccountId === key.toAccountId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: `pass-${passes.length + 1}`, ...create };
        passes.push(row);
        return row;
      },
    },
    match: {
      findMany: async ({ where }: any) =>
        matches.filter((m) => {
          const matchUser = (where?.OR || []).some(
            (cond: any) =>
              (cond.userLowId && m.userLowId === cond.userLowId) ||
              (cond.userHighId && m.userHighId === cond.userHighId),
          );
          return matchUser && (!where.status || m.status === where.status);
        }),
      findUnique: async ({ where }: any) => {
        const key = where.userLowId_userHighId;
        return (
          matches.find(
            (m) => m.userLowId === key.userLowId && m.userHighId === key.userHighId,
          ) ?? null
        );
      },
      upsert: async ({ where, create }: any) => {
        const key = where.userLowId_userHighId;
        const existing = matches.find(
          (m) => m.userLowId === key.userLowId && m.userHighId === key.userHighId,
        );
        if (existing) return existing;
        const matchId = `match-${matches.length + 1}`;
        const conv = create.conversation?.create
          ? { id: `conv-${conversations.length + 1}`, matchId, ...create.conversation.create }
          : null;
        if (conv) conversations.push(conv);
        const row = {
          id: matchId,
          userLowId: create.userLowId,
          userHighId: create.userHighId,
          status: create.status || 'active',
          conversation: conv,
          createdAt: new Date(),
        };
        matches.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const m = matches.find((row) => row.id === where.id);
        if (m) Object.assign(m, data);
        return m;
      },
    },
    conversation: {
      create: async ({ data }: any) => {
        const existing = conversations.find((c) => c.matchId === data.matchId);
        if (existing) {
          const err: any = new Error('Unique constraint failed on conversation.match_id');
          err.code = 'P2002';
          throw err;
        }
        const row = { id: `conv-${conversations.length + 1}`, ...data };
        conversations.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const c = conversations.find((row) => row.id === where.id);
        if (c) Object.assign(c, data);
        return c;
      },
    },
    idempotencyRecord: {
      findUnique: async ({ where }: any) =>
        idempotencyRecords.get(where.idempotencyKey) ?? null,
      create: async ({ data }: any) => {
        if (idempotencyRecords.has(data.idempotencyKey)) {
          const err: any = new Error('Unique constraint failed');
          err.code = 'P2002';
          throw err;
        }
        idempotencyRecords.set(data.idempotencyKey, data);
        return data;
      },
    },
    report: {
      create: async ({ data }: any) => {
        const row = { id: `report-${reports.length + 1}`, ...data, createdAt: new Date() };
        reports.push(row);
        return row;
      },
    },
  };

  return prisma;
}

describe('Phase 3.2: Discover, Reciprocal Filtering, Pagination, Match & Media Security', () => {
  test('ELIG-01 & ELIG-02: Rejects unverified, under-18, suspended, and deleted requesters', async () => {
    const unverified = buildUserRecord({ n: 1, displayName: 'Unverified', age: 21, studentStatus: 'pending', discoveryEligible: false });
    const underage = buildUserRecord({ n: 2, displayName: 'Minor', age: 17 });
    const suspended = buildUserRecord({ n: 3, displayName: 'Suspended', age: 22, accountStatus: 'suspended' });
    const deleted = buildUserRecord({ n: 4, displayName: 'Deleted', age: 22, deletedAt: new Date() });

    const prisma = createDiscoveryMockPrisma([unverified, underage, suspended, deleted]);
    const service = new DatingService(prisma);

    for (const u of [unverified, underage, suspended, deleted]) {
      await assert.rejects(
        () => service.getCandidates(u.accountId),
        (err: any) => err.status === 403,
      );
    }
  });

  test('PAUSE-01 & LIFECYCLE-01: Completed paused member remains ACTIVE_MEMBER and sees calm paused state, while excluded from feeds', async () => {
    const viewerPaused = buildUserRecord({
      n: 1,
      displayName: 'Meera Nair',
      age: 22,
      profileStatus: 'paused',
      isPublished: false,
      isPaused: true,
      publishedAt: new Date('2026-10-01T00:00:00Z'),
    });
    const activePeer = buildUserRecord({ n: 2, displayName: 'Arjun Menon', age: 23 });
    const draftUser = buildUserRecord({
      n: 3,
      displayName: 'Draft Peer',
      age: 22,
      profileStatus: 'draft',
      isPublished: false,
      publishedAt: null,
    });

    const prisma = createDiscoveryMockPrisma([viewerPaused, activePeer, draftUser]);
    const service = new DatingService(prisma);
    const idService = new IdentityService(prisma, {} as any, {} as any);

    // Identity lifecycle keeps paused completed user inside member shell
    const pausedLifecycle = idService.computeLifecycleState(
      viewerPaused.account,
      viewerPaused.account.eligibility,
      viewerPaused.profile,
    );
    assert.strictEqual(pausedLifecycle, AccountLifecycleState.ACTIVE_MEMBER);

    // Unpublished draft remains PROFILE_INCOMPLETE
    const draftLifecycle = idService.computeLifecycleState(
      draftUser.account,
      draftUser.account.eligibility,
      draftUser.profile,
    );
    assert.strictEqual(draftLifecycle, AccountLifecycleState.PROFILE_INCOMPLETE);

    // Paused viewer gets clean paused state with 0 leaked candidates
    const pausedFeed = await service.getCandidates(viewerPaused.accountId);
    assert.strictEqual(pausedFeed.viewerState, 'paused');
    assert.strictEqual(pausedFeed.candidates.length, 0);

    // Active peer never sees paused viewer or draft peer
    const peerFeed = await service.getCandidates(activePeer.accountId);
    assert.strictEqual(peerFeed.viewerState, 'ready');
    assert.strictEqual(peerFeed.candidates.length, 0);
  });

  test('ELIG-03: Excludes candidates with pending photos, roll-number-spoofed names, or paused showInDiscovery', async () => {
    const viewer = buildUserRecord({ n: 1, displayName: 'Viewer One', age: 21 });
    const pendingPhoto = buildUserRecord({ n: 2, displayName: 'PendingPic', age: 21, photoModerationStatus: 'pending' });
    const hiddenPref = buildUserRecord({ n: 3, displayName: 'HiddenPref', age: 21, showInDiscovery: false });
    const rollName = buildUserRecord({ n: 4, displayName: '24f3001234', age: 21 });
    const validPeer = buildUserRecord({ n: 5, displayName: 'Kavya Rao', age: 21 });

    const prisma = createDiscoveryMockPrisma([viewer, pendingPhoto, hiddenPref, rollName, validPeer]);
    const service = new DatingService(prisma);

    const feed = await service.getCandidates(viewer.accountId);
    assert.strictEqual(feed.candidates.length, 1);
    assert.strictEqual(feed.candidates[0].profileId, validPeer.profileId);
  });

  test('PREF-RECIP-01 & PREF-RECIP-02 & DIST-01: Enforces strict reciprocal age + 4-programme intersection while keeping distance dormant', async () => {
    const viewer = buildUserRecord({
      n: 1,
      displayName: 'Aarav',
      age: 25,
      programme: ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
      minAge: 20,
      maxAge: 24,
      allowedProgrammes: [
        ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
        ProgrammeFamily.ELECTRONIC_SYSTEMS,
      ],
      maxDistanceKm: 5,
      locationCity: 'Chennai',
    });

    // Fits Aarav (age 22, ES), AND accepts Aarav (maxAge 26, accepts DSA), despite different city & 5km dormant preference
    const mutualMatchCandidate = buildUserRecord({
      n: 2,
      displayName: 'Nisha',
      age: 22,
      programme: ProgrammeFamily.ELECTRONIC_SYSTEMS,
      minAge: 20,
      maxAge: 26,
      allowedProgrammes: [ProgrammeFamily.DATA_SCIENCE_APPLICATIONS],
      maxDistanceKm: 5,
      locationCity: 'Bengaluru',
    });

    // Fits Aarav (age 21), BUT rejects Aarav's age (candidate wants <= 23 while Aarav is 25)
    const rejectsViewerAge = buildUserRecord({
      n: 3,
      displayName: 'Riya',
      age: 21,
      programme: ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
      minAge: 19,
      maxAge: 23,
    });

    // Fits Aarav (age 22), BUT excludes Aarav's programme (only allows Management)
    const rejectsViewerProgramme = buildUserRecord({
      n: 4,
      displayName: 'Vikram',
      age: 22,
      programme: ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
      allowedProgrammes: [ProgrammeFamily.MANAGEMENT_DATA_SCIENCE],
    });

    // Unapproved candidate programme
    const invalidProgramme = buildUserRecord({
      n: 5,
      displayName: 'External',
      age: 22,
      programme: 'external_btech',
    });

    // Inclusive boundary match: candidate is exact minAge (20) & accepts Aarav's exact age (25)
    const boundaryExact = buildUserRecord({
      n: 6,
      displayName: 'Tanya',
      age: 20,
      programme: ProgrammeFamily.ELECTRONIC_SYSTEMS,
      minAge: 25,
      maxAge: 25,
      allowedProgrammes: [ProgrammeFamily.DATA_SCIENCE_APPLICATIONS],
    });

    const prisma = createDiscoveryMockPrisma([
      viewer,
      mutualMatchCandidate,
      rejectsViewerAge,
      rejectsViewerProgramme,
      invalidProgramme,
      boundaryExact,
    ]);
    const service = new DatingService(prisma);

    const feed = await service.getCandidates(viewer.accountId);
    const returnedIds = new Set(feed.candidates.map((c: any) => c.profileId));

    assert.strictEqual(feed.preferencesApplied?.dormantDistanceIgnored, true);
    assert.strictEqual(returnedIds.size, 2);
    assert.ok(returnedIds.has(mutualMatchCandidate.profileId));
    assert.ok(returnedIds.has(boundaryExact.profileId));
    assert.ok(!returnedIds.has(rejectsViewerAge.profileId));
    assert.ok(!returnedIds.has(rejectsViewerProgramme.profileId));
    assert.ok(!returnedIds.has(invalidProgramme.profileId));

    // Confirm zero distance calculation/exposure
    for (const c of feed.candidates) {
      assert.strictEqual((c as any).distanceKm, undefined);
    }
  });

  test('AGE-06 & PRIV-01: Hidden age hides public age while still passing reciprocal server age filter & omitting sensitive fields', async () => {
    const viewer = buildUserRecord({ n: 1, displayName: 'Viewer', age: 23, minAge: 20, maxAge: 25 });
    const hiddenAgePeer = buildUserRecord({
      n: 2,
      displayName: 'PrivateAgePeer',
      age: 22,
      ageDisplayMode: 'hidden',
      minAge: 20,
      maxAge: 25,
    });
    const outOfRangeHidden = buildUserRecord({
      n: 3,
      displayName: 'TooOldHidden',
      age: 34,
      ageDisplayMode: 'hidden',
    });

    const prisma = createDiscoveryMockPrisma([viewer, hiddenAgePeer, outOfRangeHidden]);
    const service = new DatingService(prisma);

    const feed = await service.getCandidates(viewer.accountId);
    assert.strictEqual(feed.candidates.length, 1);

    const card: any = feed.candidates[0];
    assert.strictEqual(card.profileId, hiddenAgePeer.profileId);
    assert.strictEqual(card.age, null);
    assert.strictEqual(card.ageVisible, false);

    // Exhaustive redaction check
    const rawJson = JSON.stringify(card);
    assert.strictEqual(card.accountId, undefined);
    assert.strictEqual(card.dateOfBirth, undefined);
    assert.strictEqual(card.preferences, undefined);
    assert.ok(!rawJson.includes(hiddenAgePeer.accountId));
    assert.ok(!rawJson.includes('@'));
  });

  test('PAGE-01..04 & ORDER-01: Deterministic cursor pagination returns non-overlapping pages and blocks cursor tampering/replay', async () => {
    const viewer = buildUserRecord({ n: 1, displayName: 'PaginatingUser', age: 22 });
    const peers = [2, 3, 4, 5, 6].map((n) =>
      buildUserRecord({ n, displayName: `Peer ${n}`, age: 22 }),
    );
    const prisma = createDiscoveryMockPrisma([viewer, ...peers]);
    const service = new DatingService(prisma);

    const p1 = await service.getCandidates(viewer.accountId, { limit: 2 });
    assert.strictEqual(p1.candidates.length, 2);
    assert.strictEqual(p1.hasMore, true);
    assert.ok(p1.nextCursor);

    const p2 = await service.getCandidates(viewer.accountId, { cursor: p1.nextCursor!, limit: 2 });
    assert.strictEqual(p2.candidates.length, 2);
    assert.strictEqual(p2.hasMore, true);
    assert.ok(p2.nextCursor);

    const p3 = await service.getCandidates(viewer.accountId, { cursor: p2.nextCursor!, limit: 2 });
    assert.strictEqual(p3.candidates.length, 1);
    assert.strictEqual(p3.hasMore, false);
    assert.strictEqual(p3.nextCursor, null);

    const combinedIds = [
      ...p1.candidates.map((c: any) => c.profileId),
      ...p2.candidates.map((c: any) => c.profileId),
      ...p3.candidates.map((c: any) => c.profileId),
    ];
    assert.strictEqual(new Set(combinedIds).size, 5);

    // Tampered signature rejected
    const tampered = `${p1.nextCursor!.split('.')[0]}.invalidSigXYZ`;
    assert.throws(
      () => decodeDiscoveryCursor(tampered, viewer.accountId),
      (err: any) => err.status === 400,
    );

    // Cross-user cursor replay rejected
    assert.throws(
      () => decodeDiscoveryCursor(p1.nextCursor!, peers[0].accountId),
      (err: any) => err.status === 403,
    );

    // Stale-day cursor triggers CURSOR_EXPIRED
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oldCursor = encodeDiscoveryCursor(viewer.accountId, '99:abc', peers[0].profileId, yesterday);
    assert.throws(
      () => decodeDiscoveryCursor(oldCursor, viewer.accountId, new Date()),
      (err: any) => err.status === 400 && err.getResponse().code === 'CURSOR_EXPIRED',
    );
  });

  test('LIKE-01..03, CONC-01, PASS-01, BLOCK-01..03, SAFE-01: Full interaction, concurrency, pass privacy, stale state, and safety block tests', async () => {
    const userA = buildUserRecord({ n: 1, displayName: 'Asha', age: 22 });
    const userB = buildUserRecord({ n: 2, displayName: 'Rohan', age: 23 });
    const userC = buildUserRecord({ n: 3, displayName: 'Dev', age: 23 });
    const userD = buildUserRecord({ n: 4, displayName: 'Meera', age: 23 });

    const prisma = createDiscoveryMockPrisma([userA, userB, userC, userD]);
    const service = new DatingService(prisma);
    const safety = new SafetyService(prisma);

    // 1. Unilateral Like (QA-MAT-001)
    const uni = await service.sendLike(
      userA.accountId,
      { targetProfileId: userB.profileId },
      'idem-a-b-1',
    );
    assert.strictEqual(uni.isMutualMatch, false);
    assert.strictEqual(prisma.state.matches.length, 0);
    assert.strictEqual(prisma.state.conversations.length, 0);

    // Idempotent retry returns same result, different candidate conflict rejected (QA-MAT-003)
    const uniRetry = await service.sendLike(
      userA.accountId,
      { targetProfileId: userB.profileId },
      'idem-a-b-1',
    );
    assert.strictEqual(uniRetry.likeId, uni.likeId);
    assert.strictEqual(prisma.state.likes.length, 1);
    await assert.rejects(
      () =>
        service.sendLike(
          userA.accountId,
          { targetProfileId: userC.profileId },
          'idem-a-b-1',
        ),
      (err: any) => err.status === 409,
    );

    // 2. Reciprocal Concurrent Mutual Like -> strictly 1 match & 1 conversation (QA-MAT-002 / MATCH-08)
    const [bLike1, bLike2] = await Promise.all([
      service.sendLike(userB.accountId, { targetProfileId: userA.profileId }),
      service.sendLike(userB.accountId, { targetProfileId: userA.profileId }),
    ]);
    assert.strictEqual(bLike1.isMutualMatch, true);
    assert.strictEqual(bLike2.isMutualMatch, true);
    assert.strictEqual(bLike1.matchId, bLike2.matchId);
    assert.strictEqual(prisma.state.matches.length, 1);
    assert.strictEqual(prisma.state.conversations.length, 1);
    assert.strictEqual(bLike1.matchedProfile.profileId, userA.profileId);
    assert.strictEqual(bLike1.matchedProfile.accountId, undefined);

    // 3. Private Pass suppresses C from A without disclosing to C (QA-MAT-004 / MATCH-19)
    const passRes = await service.sendPass(userA.accountId, { targetProfileId: userC.profileId });
    assert.strictEqual(passRes.success, true);
    const feedA = await service.getCandidates(userA.accountId);
    assert.strictEqual(feedA.candidates.map((c: any) => c.profileId).join(','), userD.profileId);

    // C does not see A excluded unless C also blocks/passes — and never gets pass notice
    const matchesC = await service.getMatches(userC.accountId);
    assert.strictEqual(matchesC.length, 0);

    // 4. Stale paused target rejection (MATCH-AC-09)
    userD.profile.isPaused = true;
    userD.profile.profileStatus = 'paused';
    await assert.rejects(
      () => service.sendLike(userA.accountId, { targetProfileId: userD.profileId }),
      (err: any) => err.status === 404,
    );
    userD.profile.isPaused = false;
    userD.profile.profileStatus = 'live';

    // 5. Block via opaque targetProfileId (MATCH-13, QA-SAFE-001, QA-MAT-005)
    await safety.blockUser(userA.accountId, { targetProfileId: userD.profileId, reason: 'Privacy' });
    await assert.rejects(
      () => service.getCandidateDetail(userD.accountId, userA.profileId),
      (err: any) => err.status === 404,
    );
    await assert.rejects(
      () => service.sendLike(userD.accountId, { targetProfileId: userA.profileId }),
      (err: any) => err.status === 403,
    );

    // 6. Report with category validation via opaque targetProfileId (QA-SAFE-002)
    const reportRes = await safety.reportUser(userA.accountId, {
      targetProfileId: userC.profileId,
      reportCategory: 'harassment',
      description: 'Unsolicited conduct',
    });
    assert.strictEqual(reportRes.success, true);
    assert.strictEqual(prisma.state.reports.length, 1);
    assert.strictEqual(prisma.state.reports[0].reportedId, userC.accountId);
  });

  test('MEDIA-01..04: Validates real JPEG/PNG/WebP R2 binaries, strips metadata across formats, and deletes disguised payloads', async () => {
    // 1. Construct real PNG & WebP & JPEG images with sharp
    const cleanPng = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 20, g: 30, b: 40 } },
    })
      .png()
      .toBuffer();

    const cleanWebp = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 60, g: 70, b: 80 } },
    })
      .webp()
      .toBuffer();

    // Inject fake PNG tEXt chunk before IEND to prove chunk stripper works
    const textData = Buffer.from('Comment\0GPS=13.0,80.2', 'ascii');
    const textChunkLen = Buffer.alloc(4);
    textChunkLen.writeUInt32BE(textData.length, 0);
    const textChunk = Buffer.concat([
      textChunkLen,
      Buffer.from('tEXt', 'ascii'),
      textData,
      Buffer.alloc(4), // dummy CRC for structural chunk test
    ]);
    const iendOffset = cleanPng.indexOf(Buffer.from('IEND', 'ascii')) - 4;
    const pngWithText = Buffer.concat([
      cleanPng.subarray(0, iendOffset),
      textChunk,
      cleanPng.subarray(iendOffset),
    ]);

    const strippedPngResult = validateImageBinary(pngWithText, 'image/png');
    assert.strictEqual(strippedPngResult.sanitizedBuffer!.includes(Buffer.from('tEXt')), false);

    const jpgWithExif = await sharp({
      create: { width: 12, height: 12, channels: 3, background: { r: 100, g: 120, b: 140 } },
    })
      .withExif({ IFD0: { Copyright: 'GPS-SECRET-LOC' } })
      .jpeg()
      .toBuffer();
    assert.ok(jpgWithExif.includes(Buffer.from('GPS-SECRET-LOC')));

    const verifiedJpg = await verifyAndSanitizeR2Image(jpgWithExif, 'image/jpeg');
    assert.strictEqual(verifiedJpg.detectedMime, 'image/jpeg');
    assert.strictEqual(verifiedJpg.widthPx, 12);
    assert.strictEqual(verifiedJpg.heightPx, 12);
    assert.strictEqual(verifiedJpg.sanitizedBuffer!.includes(Buffer.from('GPS-SECRET-LOC')), false);

    const verifiedWebp = await verifyAndSanitizeR2Image(cleanWebp, 'image/webp');
    assert.strictEqual(verifiedWebp.detectedMime, 'image/webp');

    // Corrupted/truncated payload pretending to be JPEG rejected
    await assert.rejects(
      () => verifyAndSanitizeR2Image(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x02]), 'image/jpeg'),
      (err: any) => err.status === 400,
    );

    // Verify ProfilesService R2 Get -> Validate/Strip -> Put -> Delete flow directly
    const r2Objects = new Map<string, { body: Buffer; contentType: string }>();
    const s3KeyValid = `photos/${uuid(101)}/portrait.jpg`;
    const s3KeyEvil = `photos/${uuid(101)}/evil.jpg`;
    r2Objects.set(s3KeyValid, { body: jpgWithExif, contentType: 'image/jpeg' });
    r2Objects.set(s3KeyEvil, {
      body: Buffer.from('<html><script>alert(1)</script></html>'),
      contentType: 'image/jpeg',
    });

    const deletedKeys: string[] = [];
    const putKeys: string[] = [];

    const mockPrisma: any = {
      profile: {
        findUnique: async () => ({
          id: uuid(201),
          accountId: uuid(101),
          photos: [],
          interests: [],
          promptAnswers: [],
        }),
      },
      profilePhoto: {
        create: async ({ data }: any) => ({ id: 'photo-new', ...data }),
        updateMany: async () => ({ count: 0 }),
      },
      $transaction: async (fn: (tx: any) => Promise<any>) => fn(mockPrisma),
    };

    const profilesSvc: any = new ProfilesService(mockPrisma);
    profilesSvc.createR2Client = () => ({
      bucket: 'mock-bucket',
      client: {
        send: async (cmd: any) => {
          const name = cmd.constructor?.name;
          if (name === 'GetObjectCommand') {
            const entry = r2Objects.get(cmd.input.Key);
            if (!entry) throw new Error('NoSuchKey');
            return {
              ContentLength: entry.body.length,
              ContentType: entry.contentType,
              Body: { transformToByteArray: async () => new Uint8Array(entry.body) },
            };
          }
          if (name === 'PutObjectCommand') {
            putKeys.push(cmd.input.Key);
            r2Objects.set(cmd.input.Key, {
              body: cmd.input.Body,
              contentType: cmd.input.ContentType,
            });
            return {};
          }
          if (name === 'DeleteObjectCommand') {
            deletedKeys.push(cmd.input.Key);
            r2Objects.delete(cmd.input.Key);
            return {};
          }
          return {};
        },
      },
    });
    profilesSvc.signPhotoUrl = async (key: string) => `https://signed.local/${key}`;

    const added = await profilesSvc.addPhoto(uuid(101), {
      s3Key: s3KeyValid,
      mimeType: 'image/jpeg',
    });
    assert.strictEqual(added.moderationStatus, 'approved');
    assert.ok(putKeys.includes(s3KeyValid));
    assert.strictEqual(r2Objects.get(s3KeyValid)!.body.includes(Buffer.from('GPS-SECRET-LOC')), false);

    // Malicious object fetched from R2 fails validation AND is deleted from R2
    await assert.rejects(
      () => profilesSvc.addPhoto(uuid(101), { s3Key: s3KeyEvil, mimeType: 'image/jpeg' }),
      (err: any) => err.status === 400,
    );
    assert.ok(deletedKeys.includes(s3KeyEvil));
    assert.strictEqual(r2Objects.has(s3KeyEvil), false);
  });

  test('MEDIA-05 & MEDIA-06: Decodes authentic ISO BMFF still HEIC to normalized JPEG and fails closed on undecodable HEIC containers', async () => {
    // 1. Construct an authentic single-item Apple-style still HEIC (ftypheic + meta + hdlr/pict + pitm + iinf + ipco/hvcC/ispe + ipma + iloc + Exif + mdat)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smn-test-heic-'));
    let heicBuffer: Buffer;
    try {
      const mp4Path = path.join(tmpDir, 'frame.mp4');
      execFileSync(
        'ffmpeg',
        ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=#8580C4:s=96x96', '-frames:v', '1', '-c:v', 'libx265', '-f', 'mp4', mp4Path],
        { timeout: 15000, windowsHide: true },
      );
      const mp4 = fs.readFileSync(mp4Path);
      const idxHvcc = mp4.indexOf(Buffer.from('hvcC'));
      const hvccSize = mp4.readUInt32BE(idxHvcc - 4);
      const hvccBox = mp4.subarray(idxHvcc - 4, idxHvcc - 4 + hvccSize);
      const idxMdat = mp4.indexOf(Buffer.from('mdat'));
      const mdatSize = mp4.readUInt32BE(idxMdat - 4);
      const sampleBytes = mp4.subarray(idxMdat + 4, idxMdat - 4 + mdatSize);

      const box = (type: string, payload: Buffer) => {
        const hdr = Buffer.alloc(8);
        hdr.writeUInt32BE(8 + payload.length, 0);
        hdr.write(type, 4, 4, 'ascii');
        return Buffer.concat([hdr, payload]);
      };
      const fullbox = (type: string, ver: number, flags: number, payload: Buffer) => {
        const vf = Buffer.alloc(4);
        vf.writeUInt32BE((ver << 24) | flags, 0);
        return box(type, Buffer.concat([vf, payload]));
      };

      const ftyp = box('ftyp', Buffer.from('heic\x00\x00\x00\x00mif1heic', 'latin1'));
      const hdlr = fullbox('hdlr', 0, 0, Buffer.concat([Buffer.alloc(4), Buffer.from('pict', 'ascii'), Buffer.alloc(13)]));
      const pitm = fullbox('pitm', 0, 0, Buffer.from([0x00, 0x01]));
      const infe = fullbox('infe', 2, 0, Buffer.concat([Buffer.from([0x00, 0x01, 0x00, 0x00]), Buffer.from('hvc1Image\x00', 'ascii')]));
      const iinf = fullbox('iinf', 0, 0, Buffer.concat([Buffer.from([0x00, 0x01]), infe]));
      const ispeBuf = Buffer.alloc(8);
      ispeBuf.writeUInt32BE(96, 0);
      ispeBuf.writeUInt32BE(96, 4);
      const ispe = fullbox('ispe', 0, 0, ispeBuf);
      const ipco = box('ipco', Buffer.concat([hvccBox, ispe]));
      const ipma = fullbox('ipma', 0, 0, Buffer.from([0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x02, 0x81, 0x02]));
      const iprp = box('iprp', Buffer.concat([ipco, ipma]));
      const buildMeta = (offset: number) => {
        const ilocPayload = Buffer.alloc(18);
        ilocPayload[0] = 0x44;
        ilocPayload.writeUInt16BE(1, 2);
        ilocPayload.writeUInt16BE(1, 4);
        ilocPayload.writeUInt16BE(0, 6);
        ilocPayload.writeUInt16BE(1, 8);
        ilocPayload.writeUInt32BE(offset, 10);
        ilocPayload.writeUInt32BE(sampleBytes.length, 14);
        const iloc = fullbox('iloc', 0, 0, ilocPayload);
        return fullbox('meta', 0, 0, Buffer.concat([hdlr, pitm, iinf, iprp, iloc]));
      };
      const metaLen = buildMeta(0).length;
      const meta = buildMeta(ftyp.length + metaLen + 8);
      const mdat = box('mdat', sampleBytes);
      heicBuffer = Buffer.concat([ftyp, meta, mdat]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    const decodedHeic = await verifyAndSanitizeR2Image(heicBuffer, 'image/heic');
    assert.strictEqual(decodedHeic.isValid, true);
    assert.strictEqual(decodedHeic.isHeic, true);
    assert.strictEqual(decodedHeic.transcodedFromHeic, true);
    assert.strictEqual(decodedHeic.detectedMime, 'image/jpeg');
    assert.strictEqual(decodedHeic.widthPx, 96);
    assert.strictEqual(decodedHeic.heightPx, 96);
    assert.strictEqual(decodedHeic.sanitizedBuffer![0], 0xff);
    assert.strictEqual(decodedHeic.sanitizedBuffer![1], 0xd8);

    // 2. Fake undecodable HEIC container (valid ftyp + meta + mdat bytes without valid HEVC stream) MUST reject fail-closed
    const fakeHeic = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from('ftypheic\x00\x00\x00\x00mif1heic', 'latin1'),
      Buffer.from([0x00, 0x00, 0x00, 0x14]),
      Buffer.from('meta\x00\x00\x00\x00not_real_box', 'latin1'),
      Buffer.from([0x00, 0x00, 0x00, 0x14]),
      Buffer.from('mdatgarbage_hevc_bad', 'latin1'),
    ]);
    await assert.rejects(
      () => verifyAndSanitizeR2Image(fakeHeic, 'image/heic'),
      (err: any) => err.status === 400 && err.message.includes('HEIC image decoding failed'),
    );
  });

  test('MATCH-10: Messaging stays locked until active mutual match creates ConversationMember rows, and shuts cleanly on Block', async () => {
    const convMembers: any[] = [];
    const blocks: any[] = [];
    const matches: any[] = [];
    const conversations: any[] = [];

    const mockPrisma: any = {
      conversationMember: {
        findUnique: async ({ where }: any) => {
          const key = where.conversationId_accountId;
          const hit = convMembers.find(
            (m) => m.conversationId === key.conversationId && m.accountId === key.accountId,
          );
          if (!hit) return null;
          const conv = conversations.find((c) => c.id === hit.conversationId);
          const match = matches.find((m) => m.id === conv?.matchId);
          return { ...hit, conversation: { ...conv, match } };
        },
        upsert: async ({ where, create }: any) => {
          const key = where.conversationId_accountId;
          const hit = convMembers.find(
            (m) => m.conversationId === key.conversationId && m.accountId === key.accountId,
          );
          if (hit) return hit;
          const row = { ...create };
          convMembers.push(row);
          return row;
        },
      },
      userBlock: {
        findFirst: async ({ where }: any) =>
          blocks.find((b) =>
            (where.OR || []).some((c: any) => c.blockerId === b.blockerId && c.blockedId === b.blockedId),
          ) ?? null,
      },
      message: {
        findMany: async () => [],
        findFirst: async () => null,
        create: async ({ data }: any) => ({ id: 'msg-1', createdAt: new Date(), ...data }),
      },
      conversation: {
        update: async () => ({}),
      },
      $transaction: async (fn: any) => fn(mockPrisma),
    };

    const msgService = new MessagingService(mockPrisma);

    // Non-member or unilateral non-matched attempt denied cleanly
    await assert.rejects(
      () => msgService.sendMessage(uuid(1), 'conv-none', { bodyText: 'Hello!' }),
      (err: any) => err.status === 403,
    );

    // Active match + conversation + members allows messaging
    matches.push({ id: 'm-1', userLowId: uuid(1), userHighId: uuid(2), status: 'active' });
    conversations.push({ id: 'conv-1', matchId: 'm-1', status: 'active' });
    convMembers.push({ conversationId: 'conv-1', accountId: uuid(1) });
    convMembers.push({ conversationId: 'conv-1', accountId: uuid(2) });

    const sent = await msgService.sendMessage(uuid(1), 'conv-1', { bodyText: 'Hi verified match!' });
    assert.strictEqual(sent.bodyText, 'Hi verified match!');

    // Block denies messaging even if ConversationMember row still exists
    blocks.push({ blockerId: uuid(1), blockedId: uuid(2) });
    await assert.rejects(
      () => msgService.sendMessage(uuid(2), 'conv-1', { bodyText: 'Trying after block' }),
      (err: any) => err.status === 403,
    );
  });
});
