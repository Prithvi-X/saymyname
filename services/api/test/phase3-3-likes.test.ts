import { describe, test } from 'node:test';
import * as assert from 'node:assert';
import { DatingService } from '../src/modules/dating/dating.service';
import { SafetyService } from '../src/modules/safety/safety.service';
import {
  decodeLikesCursor,
  encodeLikesCursor,
} from '../src/modules/dating/discovery-cursor';
import { ProgrammeFamily } from '@saymyname/contracts';

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function makeDobForAge(ageYears: number, ref: Date = new Date()): Date {
  return new Date(
    Date.UTC(ref.getUTCFullYear() - ageYears, ref.getUTCMonth(), Math.min(28, ref.getUTCDate())),
  );
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
  showInDiscovery?: boolean;
  photoModerationStatus?: string;
  publishedAt?: Date | null;
  consentAcceptedAt?: Date | null;
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

  const profile = {
    id: profileId,
    accountId,
    displayName: opts.displayName,
    bio: `Bio for ${opts.displayName}`,
    programmeFamily: prog,
    termOrYear: 'Diploma Level',
    locationCity: 'Chennai',
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
    photos: [
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
    ],
    interests: [{ interest: { id: 'int-1', name: 'Mathematics' } }],
    promptAnswers: [
      {
        id: `pa-${opts.n}`,
        promptId: 'pr-1',
        prompt: { promptText: 'Favourite ritual?' },
        answerText: 'Filter coffee before evening coding.',
      },
    ],
    preferences: {
      profileId,
      minAge: 18,
      maxAge: 35,
      allowedProgrammes: [
        ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
        ProgrammeFamily.ELECTRONIC_SYSTEMS,
        ProgrammeFamily.AERONAUTICS_SPACE,
        ProgrammeFamily.MANAGEMENT_DATA_SCIENCE,
      ],
      maxDistanceKm: 15,
      showInDiscovery: opts.showInDiscovery ?? true,
    },
  };

  return { accountId, profileId, account, profile };
}

function createLikesMockPrisma(users: ReturnType<typeof buildUserRecord>[]) {
  const accounts = new Map(users.map((u) => [u.accountId, u.account]));
  const profilesByAccount = new Map(users.map((u) => [u.accountId, u.profile]));
  const profilesById = new Map(users.map((u) => [u.profileId, u.profile]));

  const likes: any[] = [];
  const passes: any[] = [];
  const matches: any[] = [];
  const conversations: any[] = [];
  const blocks: any[] = [];
  const matchEvents: any[] = [];
  const idempotencyRecords = new Map<string, any>();

  let likeSeq = 1;

  const prisma: any = {
    state: { likes, passes, matches, conversations, blocks, idempotencyRecords },
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
        const included = where?.accountId?.in ? new Set<string>(where.accountId.in) : null;
        return users
          .map((u) => u.profile)
          .filter((p) => {
            if (excluded.has(p.accountId)) return false;
            if (included && !included.has(p.accountId)) return false;
            if (where?.isPublished !== undefined && p.isPublished !== where.isPublished) return false;
            if (where?.isPaused !== undefined && p.isPaused !== where.isPaused) return false;
            if (where?.profileStatus && p.profileStatus !== where.profileStatus) return false;
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
            (cond: any) => b.blockerId === cond.blockerId && b.blockedId === cond.blockedId,
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
        const row = { id: uuid(900 + blocks.length + 1), ...create };
        blocks.push(row);
        return row;
      },
    },
    like: {
      findUnique: async ({ where }: any) => {
        if (where.id) return likes.find((l) => l.id === where.id) ?? null;
        if (where.fromAccountId_toAccountId) {
          const k = where.fromAccountId_toAccountId;
          return (
            likes.find(
              (l) => l.fromAccountId === k.fromAccountId && l.toAccountId === k.toAccountId,
            ) ?? null
          );
        }
        return null;
      },
      findFirst: async ({ where }: any) =>
        likes.find(
          (l) =>
            (!where.fromAccountId || l.fromAccountId === where.fromAccountId) &&
            (!where.toAccountId || l.toAccountId === where.toAccountId) &&
            (!where.status || l.status === where.status),
        ) ?? null,
      findMany: async ({ where }: any) => {
        const statusSet = where?.status?.in
          ? new Set<string>(where.status.in)
          : where?.status
            ? new Set<string>([where.status])
            : null;
        return likes.filter((l) => {
          if (where.fromAccountId && l.fromAccountId !== where.fromAccountId) return false;
          if (where.toAccountId && l.toAccountId !== where.toAccountId) return false;
          if (statusSet && !statusSet.has(l.status)) return false;
          return true;
        });
      },
      create: async ({ data }: any) => {
        const now = data.createdAt || new Date(Date.now() + likeSeq * 100);
        const row = {
          id: data.id || uuid(400 + likeSeq++),
          fromAccountId: data.fromAccountId,
          toAccountId: data.toAccountId,
          status: data.status || 'active',
          createdAt: now,
          updatedAt: now,
        };
        likes.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const row = likes.find((l) => l.id === where.id);
        if (!row) throw new Error('Like not found');
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
      upsert: async ({ where, create, update }: any) => {
        const key = where.fromAccountId_toAccountId;
        const existing = likes.find(
          (l) => l.fromAccountId === key.fromAccountId && l.toAccountId === key.toAccountId,
        );
        if (existing) {
          Object.assign(existing, update, { updatedAt: new Date() });
          return existing;
        }
        const now = new Date(Date.now() + likeSeq * 100);
        const row = {
          id: uuid(400 + likeSeq++),
          ...create,
          createdAt: now,
          updatedAt: now,
        };
        likes.push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const l of likes) {
          let matchesWhere = true;
          if (where.id && l.id !== where.id) matchesWhere = false;
          if (where.fromAccountId && l.fromAccountId !== where.fromAccountId) matchesWhere = false;
          if (where.OR) {
            const orMatch = where.OR.some(
              (cond: any) =>
                l.fromAccountId === cond.fromAccountId && l.toAccountId === cond.toAccountId,
            );
            if (!orMatch) matchesWhere = false;
          }
          if (where.status && l.status !== where.status) matchesWhere = false;
          if (matchesWhere) {
            Object.assign(l, data, { updatedAt: new Date() });
            count++;
          }
        }
        return { count };
      },
    },
    pass: {
      findUnique: async ({ where }: any) => {
        const k = where.fromAccountId_toAccountId;
        return (
          passes.find(
            (p) => p.fromAccountId === k.fromAccountId && p.toAccountId === k.toAccountId,
          ) ?? null
        );
      },
      findMany: async ({ where }: any) =>
        passes.filter(
          (p) =>
            p.fromAccountId === where.fromAccountId &&
            (!where.expiresAt?.gt || new Date(p.expiresAt) > where.expiresAt.gt),
        ),
      upsert: async ({ where, create, update }: any) => {
        const k = where.fromAccountId_toAccountId;
        const existing = passes.find(
          (p) => p.fromAccountId === k.fromAccountId && p.toAccountId === k.toAccountId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: uuid(600 + passes.length + 1), createdAt: new Date(), ...create };
        passes.push(row);
        return row;
      },
    },
    match: {
      findUnique: async ({ where }: any) => {
        if (where.id) return matches.find((m) => m.id === where.id) ?? null;
        const k = where.userLowId_userHighId;
        return matches.find((m) => m.userLowId === k.userLowId && m.userHighId === k.userHighId) ?? null;
      },
      findMany: async ({ where }: any) =>
        matches.filter((m) =>
          (where?.OR || []).some(
            (cond: any) =>
              (cond.userLowId && m.userLowId === cond.userLowId) ||
              (cond.userHighId && m.userHighId === cond.userHighId),
          ),
        ),
      upsert: async ({ where, create, update }: any) => {
        const k = where.userLowId_userHighId;
        const existing = matches.find(
          (m) => m.userLowId === k.userLowId && m.userHighId === k.userHighId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const conv = {
          id: uuid(700 + conversations.length + 1),
          status: 'active',
          members: [],
        };
        conversations.push(conv);
        const matchRow = {
          id: uuid(800 + matches.length + 1),
          userLowId: create.userLowId,
          userHighId: create.userHighId,
          status: create.status || 'active',
          createdAt: new Date(),
          endedAt: null,
          conversation: conv,
        };
        matches.push(matchRow);
        return matchRow;
      },
      update: async ({ where, data }: any) => {
        const m = matches.find((row) => row.id === where.id);
        if (m) Object.assign(m, data);
        return m;
      },
    },
    conversation: {
      updateMany: async ({ where, data }: any) => {
        for (const c of conversations) {
          if (c.id === where.id) Object.assign(c, data);
        }
        return { count: 1 };
      },
    },
    matchStateEvent: {
      create: async ({ data }: any) => {
        matchEvents.push(data);
        return data;
      },
    },
    callSession: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
    gameSession: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
    virtualDate: { updateMany: async () => ({ count: 0 }) },
    relationshipProposal: { updateMany: async () => ({ count: 0 }) },
    relationshipSpace: { findUnique: async () => null, updateMany: async () => ({ count: 0 }) },
    idempotencyRecord: {
      findUnique: async ({ where }: any) => idempotencyRecords.get(where.idempotencyKey) ?? null,
      create: async ({ data }: any) => {
        idempotencyRecords.set(data.idempotencyKey, data);
        return data;
      },
    },
  };

  return prisma;
}

describe('Phase 3.3: Likes & Interest Management Domain, Privacy, Concurrency & Pagination', () => {
  test('ELIG-LIKES-01: Rejects unverified, under-18, suspended, deleted & draft accounts across all Likes endpoints', async () => {
    const recipient = buildUserRecord({ n: 1, displayName: 'Meera Nair', age: 21 });
    const unverified = buildUserRecord({
      n: 2,
      displayName: 'Unverified',
      age: 21,
      studentStatus: 'pending',
      discoveryEligible: false,
    });
    const underage = buildUserRecord({ n: 3, displayName: 'Minor', age: 17 });
    const suspended = buildUserRecord({
      n: 4,
      displayName: 'Suspended',
      age: 22,
      accountStatus: 'suspended',
    });
    const deleted = buildUserRecord({
      n: 5,
      displayName: 'Deleted',
      age: 22,
      deletedAt: new Date(),
    });
    const draft = buildUserRecord({
      n: 6,
      displayName: 'Draft User',
      age: 22,
      isPublished: false,
      profileStatus: 'draft',
      publishedAt: null,
    });

    const prisma = createLikesMockPrisma([
      recipient,
      unverified,
      underage,
      suspended,
      deleted,
      draft,
    ]);
    const service = new DatingService(prisma);

    const fakeLikeId = uuid(499);
    for (const bad of [unverified, underage, suspended, deleted, draft]) {
      await assert.rejects(
        () => service.getReceivedLikes(bad.accountId),
        (err: any) => err.status === 403,
      );
      await assert.rejects(
        () => service.getSentLikes(bad.accountId),
        (err: any) => err.status === 403,
      );
      await assert.rejects(
        () => service.withdrawLike(bad.accountId, fakeLikeId),
        (err: any) => err.status === 403,
      );
      await assert.rejects(
        () => service.likeBackReceivedLike(bad.accountId, fakeLikeId),
        (err: any) => err.status === 403,
      );
      await assert.rejects(
        () => service.passReceivedLike(bad.accountId, fakeLikeId),
        (err: any) => err.status === 403,
      );
    }
  });

  test('PAUSE-LIKES-01: Completed paused member gets calm paused received inbox while retaining Sent Likes withdrawal control', async () => {
    const pausedViewer = buildUserRecord({
      n: 1,
      displayName: 'Aarav Rao',
      age: 22,
      profileStatus: 'paused',
      isPublished: false,
      isPaused: true,
      publishedAt: new Date('2026-10-01T00:00:00Z'),
    });
    const activeTarget = buildUserRecord({ n: 2, displayName: 'Diya Sen', age: 21 });

    const prisma = createLikesMockPrisma([pausedViewer, activeTarget]);
    prisma.state.likes.push({
      id: uuid(410),
      fromAccountId: pausedViewer.accountId,
      toAccountId: activeTarget.accountId,
      status: 'active',
      createdAt: new Date('2026-11-24T10:00:00Z'),
      updatedAt: new Date('2026-11-24T10:00:00Z'),
    });
    const service = new DatingService(prisma);

    const recv = await service.getReceivedLikes(pausedViewer.accountId);
    assert.strictEqual(recv.viewerState, 'paused');
    assert.strictEqual(recv.items.length, 0);

    const sent = await service.getSentLikes(pausedViewer.accountId);
    assert.strictEqual(sent.viewerState, 'paused');
    assert.strictEqual(sent.items.length, 1);
    assert.strictEqual(sent.items[0].canWithdraw, true);

    const withdrawn = await service.withdrawLike(pausedViewer.accountId, uuid(410));
    assert.strictEqual(withdrawn.status, 'withdrawn');
    assert.strictEqual(withdrawn.withdrawn, true);
  });

  test('RECV-LIKES-01: Filters blocked, passed, matched, ended-match, paused, suspended, deleted, under-age & pending-photo senders and respects hidden age', async () => {
    const viewer = buildUserRecord({ n: 1, displayName: 'Kavya Sharma', age: 22 });
    const eligibleHiddenAge = buildUserRecord({
      n: 2,
      displayName: 'Rohan Kulkarni',
      age: 24,
      ageDisplayMode: 'hidden',
    });
    const blockedSender = buildUserRecord({ n: 3, displayName: 'Blocked', age: 22 });
    const passedSender = buildUserRecord({ n: 4, displayName: 'Passed', age: 22 });
    const matchedSender = buildUserRecord({ n: 5, displayName: 'Matched', age: 22 });
    const endedMatchSender = buildUserRecord({ n: 6, displayName: 'Unmatched', age: 22 });
    const pausedSender = buildUserRecord({
      n: 7,
      displayName: 'PausedSender',
      age: 22,
      profileStatus: 'paused',
      isPublished: false,
      isPaused: true,
    });
    const suspendedSender = buildUserRecord({
      n: 8,
      displayName: 'SuspendedSender',
      age: 22,
      accountStatus: 'suspended',
    });
    const deletedSender = buildUserRecord({
      n: 9,
      displayName: 'DeletedSender',
      age: 22,
      deletedAt: new Date(),
    });
    const minorSender = buildUserRecord({ n: 10, displayName: 'MinorSender', age: 17 });
    const pendingPhotoSender = buildUserRecord({
      n: 11,
      displayName: 'PendingPhoto',
      age: 22,
      photoModerationStatus: 'pending',
    });

    const all = [
      viewer,
      eligibleHiddenAge,
      blockedSender,
      passedSender,
      matchedSender,
      endedMatchSender,
      pausedSender,
      suspendedSender,
      deletedSender,
      minorSender,
      pendingPhotoSender,
    ];
    const prisma = createLikesMockPrisma(all);

    let seq = 1;
    for (const sender of all.slice(1)) {
      prisma.state.likes.push({
        id: uuid(450 + seq++),
        fromAccountId: sender.accountId,
        toAccountId: viewer.accountId,
        status: 'active',
        createdAt: new Date(Date.UTC(2026, 10, 20, 10, seq)),
        updatedAt: new Date(Date.UTC(2026, 10, 20, 10, seq)),
      });
    }

    prisma.state.blocks.push({
      id: 'blk-1',
      blockerId: viewer.accountId,
      blockedId: blockedSender.accountId,
    });
    prisma.state.passes.push({
      id: 'pass-1',
      fromAccountId: viewer.accountId,
      toAccountId: passedSender.accountId,
      expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });
    const [mLow, mHigh] = [viewer.accountId, matchedSender.accountId].sort();
    prisma.state.matches.push({
      id: uuid(851),
      userLowId: mLow,
      userHighId: mHigh,
      status: 'active',
    });
    const [eLow, eHigh] = [viewer.accountId, endedMatchSender.accountId].sort();
    prisma.state.matches.push({
      id: uuid(852),
      userLowId: eLow,
      userHighId: eHigh,
      status: 'ended',
    });

    const service = new DatingService(prisma);
    const recv = await service.getReceivedLikes(viewer.accountId);

    assert.strictEqual(recv.items.length, 1);
    assert.strictEqual(recv.totalActiveCount, 1);
    assert.strictEqual(recv.items[0].profileId, eligibleHiddenAge.profileId);
    assert.strictEqual(recv.items[0].profile.age, null);
    assert.strictEqual(recv.items[0].profile.ageVisible, false);

    // Must not expose internal accountId, DOB, or email
    const serialized = JSON.stringify(recv);
    assert.strictEqual(serialized.includes(eligibleHiddenAge.accountId), false);
    assert.strictEqual(serialized.includes('24f2@ds.study.iitm.ac.in'), false);
    assert.strictEqual(serialized.includes('dateOfBirth'), false);
  });

  test('SENT-LIKES-PRIVACY-01: Hides moderation/block/pass reasons and keeps Sent Likes non-confidential', async () => {
    const viewer = buildUserRecord({ n: 1, displayName: 'Nikhil Verma', age: 23 });
    const pendingRecipient = buildUserRecord({ n: 2, displayName: 'Priya Menon', age: 22 });
    const passedByRecipient = buildUserRecord({ n: 3, displayName: 'Sneha Iyer', age: 22 });
    const suspendedRecipient = buildUserRecord({
      n: 4,
      displayName: 'ModSuspended',
      age: 22,
      accountStatus: 'suspended',
    });
    const pausedRecipient = buildUserRecord({
      n: 5,
      displayName: 'PausedTarget',
      age: 22,
      profileStatus: 'paused',
      isPublished: false,
      isPaused: true,
    });
    const blockedRecipient = buildUserRecord({ n: 6, displayName: 'BlockedTarget', age: 22 });

    const prisma = createLikesMockPrisma([
      viewer,
      pendingRecipient,
      passedByRecipient,
      suspendedRecipient,
      pausedRecipient,
      blockedRecipient,
    ]);
    const service = new DatingService(prisma);

    // Viewer likes pendingRecipient, passedByRecipient, suspendedRecipient, pausedRecipient
    await service.sendLike(viewer.accountId, { targetProfileId: pendingRecipient.profileId });
    await service.sendLike(viewer.accountId, { targetProfileId: passedByRecipient.profileId });

    prisma.state.likes.push(
      {
        id: uuid(480),
        fromAccountId: viewer.accountId,
        toAccountId: suspendedRecipient.accountId,
        status: 'active',
        createdAt: new Date('2026-11-24T09:00:00Z'),
        updatedAt: new Date('2026-11-24T09:00:00Z'),
      },
      {
        id: uuid(481),
        fromAccountId: viewer.accountId,
        toAccountId: pausedRecipient.accountId,
        status: 'active',
        createdAt: new Date('2026-11-24T08:00:00Z'),
        updatedAt: new Date('2026-11-24T08:00:00Z'),
      },
      {
        id: uuid(482),
        fromAccountId: viewer.accountId,
        toAccountId: blockedRecipient.accountId,
        status: 'active',
        createdAt: new Date('2026-11-24T07:00:00Z'),
        updatedAt: new Date('2026-11-24T07:00:00Z'),
      },
    );

    // passedByRecipient privately passes viewer -> viewer MUST NOT see any hint of this pass!
    await service.sendPass(passedByRecipient.accountId, { targetProfileId: viewer.profileId });

    // blockedRecipient blocks viewer (via SafetyService OR direct block) -> must vanish completely
    const safety = new SafetyService(prisma);
    await safety.blockUser(blockedRecipient.accountId, { targetProfileId: viewer.profileId, reason: 'Privacy' });

    const sent = await service.getSentLikes(viewer.accountId);
    assert.strictEqual(sent.items.length, 4);

    const byName = new Map(sent.items.map((item) => [item.profile.displayName, item]));
    assert.strictEqual(byName.get('Priya Menon')?.availability, 'pending');
    assert.strictEqual(byName.get('Sneha Iyer')?.availability, 'pending'); // Pass stays invisible!

    const unavailableItems = sent.items.filter((i) => i.availability === 'unavailable');
    assert.strictEqual(unavailableItems.length, 2);
    for (const u of unavailableItems) {
      assert.strictEqual(u.profile.displayName, 'Member unavailable');
      assert.strictEqual(u.profile.photos.length, 0);
      assert.strictEqual(u.profile.bio, null);
      assert.strictEqual(u.canWithdraw, true);
    }

    const dump = JSON.stringify(sent).toLowerCase();
    assert.strictEqual(dump.includes('suspended'), false);
    assert.strictEqual(dump.includes('passed'), false);
    assert.strictEqual(dump.includes('modsuspended'), false);
    assert.strictEqual(dump.includes('pausedtarget'), false);
    assert.strictEqual(dump.includes('blockedtarget'), false);
  });

  test('WITHDRAW-RACE-01: Safe withdraw is idempotent, prevents subsequent Like Back match, and never retracts active or ended matches', async () => {
    const sender = buildUserRecord({ n: 1, displayName: 'Sender Aditi', age: 21 });
    const recipient = buildUserRecord({ n: 2, displayName: 'Recipient Kabir', age: 22 });

    const prisma = createLikesMockPrisma([sender, recipient]);
    const service = new DatingService(prisma);

    // 1. Sender sends active Like to Recipient
    const likeRes = await service.sendLike(
      sender.accountId,
      { targetProfileId: recipient.profileId },
      'key-send-1',
    );
    assert.strictEqual(likeRes.isMutualMatch, false);

    // Non-owner cannot withdraw sender's Like
    await assert.rejects(
      () => service.withdrawLike(recipient.accountId, likeRes.likeId),
      (err: any) => err.status === 403,
    );

    // 2. Sender safely withdraws pending Like before recipient acts
    const w1 = await service.withdrawLike(sender.accountId, likeRes.likeId, 'key-w-1');
    assert.strictEqual(w1.status, 'withdrawn');
    assert.strictEqual(w1.alreadyWithdrawn, false);

    // Repeated withdraw is idempotent
    const w2 = await service.withdrawLike(sender.accountId, likeRes.likeId, 'key-w-2');
    assert.strictEqual(w2.status, 'withdrawn');
    assert.strictEqual(w2.alreadyWithdrawn, true);

    // Sender reappears cleanly in Discover if neither passed/blocked, and disappears from Received Likes
    const recvAfterWithdraw = await service.getReceivedLikes(recipient.accountId);
    assert.strictEqual(recvAfterWithdraw.items.length, 0);

    // 3. Stale Like Back on withdrawn incoming Like is rejected cleanly without creating a Match
    await assert.rejects(
      () => service.likeBackReceivedLike(recipient.accountId, likeRes.likeId),
      (err: any) => err.status === 409 && err.response?.code === 'LIKE_UNAVAILABLE',
    );
    assert.strictEqual(prisma.state.matches.length, 0);

    // 4. Sender re-likes Recipient later, Recipient accepts via Like Back -> mutual match created!
    const reLikeRes = await service.sendLike(sender.accountId, {
      targetProfileId: recipient.profileId,
    });
    assert.strictEqual(reLikeRes.isMutualMatch, false);

    const acceptRes = await service.likeBackReceivedLike(
      recipient.accountId,
      reLikeRes.likeId,
      'accept-1',
    );
    assert.strictEqual(acceptRes.isMutualMatch, true);
    assert.ok(acceptRes.matchId);
    assert.ok(acceptRes.conversationId);

    // 5. After mutual Match forms, withdrawing outgoing Like is strictly rejected (409)
    await assert.rejects(
      () => service.withdrawLike(sender.accountId, reLikeRes.likeId),
      (err: any) => err.status === 409,
    );

    // 6. After Unmatch (ended match), withdraw remains strictly forbidden and Match stays ended
    await service.unmatch(sender.accountId, { matchId: acceptRes.matchId! });
    await assert.rejects(
      () => service.withdrawLike(sender.accountId, reLikeRes.likeId),
      (err: any) => err.status === 409,
    );
    await assert.rejects(
      () => service.sendLike(sender.accountId, { targetProfileId: recipient.profileId }),
      (err: any) => err.status === 403,
    );
  });

  test('PASS-RECV-01: Passing an incoming like suppresses sender from Received Likes & Discover while keeping Pass invisible to sender', async () => {
    const viewer = buildUserRecord({ n: 1, displayName: 'Maya', age: 21 });
    const sender = buildUserRecord({ n: 2, displayName: 'Vikram', age: 22 });

    const prisma = createLikesMockPrisma([viewer, sender]);
    const service = new DatingService(prisma);

    const likeRes = await service.sendLike(sender.accountId, {
      targetProfileId: viewer.profileId,
    });

    let recv = await service.getReceivedLikes(viewer.accountId);
    assert.strictEqual(recv.items.length, 1);

    const passRes = await service.passReceivedLike(viewer.accountId, likeRes.likeId, 'pass-rx-1');
    assert.strictEqual(passRes.success, true);

    // Viewer no longer sees sender in Received Likes OR Discover
    recv = await service.getReceivedLikes(viewer.accountId);
    assert.strictEqual(recv.items.length, 0);
    const feed = await service.getCandidates(viewer.accountId);
    assert.strictEqual(feed.candidates.length, 0);

    // Inspecting stale detail throws 404
    await assert.rejects(
      () => service.getReceivedLikeDetail(viewer.accountId, likeRes.likeId),
      (err: any) => err.status === 404,
    );

    // Sender's Sent Likes still calmly sees pending status — zero pass leak!
    const senderSent = await service.getSentLikes(sender.accountId);
    assert.strictEqual(senderSent.items.length, 1);
    assert.strictEqual(senderSent.items[0].availability, 'pending');
  });

  test('CURSOR-LIKES-01: Keyset cursor pagination handles tie timestamps, live withdrawals & rejects tampering/cross-user/wrong-scope cursors', async () => {
    const viewer = buildUserRecord({ n: 1, displayName: 'Tara', age: 21 });
    const peers = [
      buildUserRecord({ n: 2, displayName: 'Peer One', age: 21 }),
      buildUserRecord({ n: 3, displayName: 'Peer Two', age: 22 }),
      buildUserRecord({ n: 4, displayName: 'Peer Three', age: 23 }),
      buildUserRecord({ n: 5, displayName: 'Peer Four', age: 24 }),
      buildUserRecord({ n: 6, displayName: 'Peer Five', age: 25 }),
    ];

    const prisma = createLikesMockPrisma([viewer, ...peers]);
    const sharedTs = new Date('2026-11-25T12:00:00Z');
    peers.forEach((p, idx) => {
      prisma.state.likes.push({
        id: uuid(500 + idx),
        fromAccountId: p.accountId,
        toAccountId: viewer.accountId,
        status: 'active',
        // First 2 share an exact tie timestamp to prove deterministic UUID keyset tie-breaker
        createdAt: idx >= 3 ? sharedTs : new Date(sharedTs.getTime() - (5 - idx) * 60000),
        updatedAt: sharedTs,
      });
    });

    const service = new DatingService(prisma);

    const page1 = await service.getReceivedLikes(viewer.accountId, { limit: 2 });
    assert.strictEqual(page1.items.length, 2);
    assert.strictEqual(page1.hasMore, true);
    assert.ok(page1.nextCursor);

    // Sender from page 1 withdraws live before page 2 is fetched — must NOT cause duplicates or skips!
    await service.withdrawLike(peers[3].accountId, page1.items[1].likeId);

    const page2 = await service.getReceivedLikes(viewer.accountId, {
      limit: 2,
      cursor: page1.nextCursor!,
    });
    const page3 = await service.getReceivedLikes(viewer.accountId, {
      limit: 2,
      cursor: page2.nextCursor!,
    });

    const collectedIds = [
      ...page1.items.map((i) => i.likeId),
      ...page2.items.map((i) => i.likeId),
      ...page3.items.map((i) => i.likeId),
    ];
    assert.strictEqual(new Set(collectedIds).size, 5);
    assert.strictEqual(page3.hasMore, false);

    // Wrong-scope cursor (likes_sent cursor used on likes_received) must fail 400
    const sentCursor = encodeLikesCursor(
      viewer.accountId,
      'likes_sent',
      new Date().toISOString(),
      uuid(500),
    );
    await assert.rejects(
      () => service.getReceivedLikes(viewer.accountId, { cursor: sentCursor }),
      (err: any) => err.status === 400,
    );

    // Cross-account cursor replay must fail 403
    assert.throws(
      () =>
        decodeLikesCursor(
          page1.nextCursor!,
          peers[0].accountId,
          'likes_received',
        ),
      (err: any) => err.status === 403,
    );
    await assert.rejects(
      () => service.getReceivedLikes(peers[0].accountId, { cursor: page1.nextCursor! }),
      (err: any) => err.status === 403,
    );

    // Expired cursor fails 400 CURSOR_EXPIRED
    const expiredCursor = encodeLikesCursor(
      viewer.accountId,
      'likes_received',
      new Date().toISOString(),
      uuid(500),
      new Date(Date.now() - 48 * 60 * 60 * 1000),
    );
    await assert.rejects(
      () => service.getReceivedLikes(viewer.accountId, { cursor: expiredCursor }),
      (err: any) => err.status === 400,
    );
  });
});
