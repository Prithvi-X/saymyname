import { describe, test } from 'node:test';
import * as assert from 'node:assert';
import { DatingService } from '../src/modules/dating/dating.service';
import { MessagingService } from '../src/modules/messaging/messaging.service';
import { CallingService } from '../src/modules/calling/calling.service';
import { LiveKitProviderAdapter } from '../src/modules/calling/livekit-provider.adapter';
import { TogetherService } from '../src/modules/together/together.service';
import { IdentityService } from '../src/modules/identity/identity.service';
import { SafetyService } from '../src/modules/safety/safety.service';
import { CryptoService } from '../src/modules/identity/security/crypto.service';
import { MatchAuthorizationService } from '../src/modules/safety/match-authorization.service';
import { ProgrammeFamily } from '@saymyname/contracts';

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function makeDobForAge(ageYears: number, ref: Date = new Date()): Date {
  return new Date(
    Date.UTC(ref.getUTCFullYear() - ageYears, ref.getUTCMonth(), Math.min(28, ref.getUTCDate())),
  );
}

function createPhase34Harness() {
  const accounts = new Map<string, any>();
  const profilesByAccount = new Map<string, any>();
  const profilesById = new Map<string, any>();
  const likes: any[] = [];
  const passes: any[] = [];
  const matches: any[] = [];
  const conversations: any[] = [];
  const conversationMembers: any[] = [];
  const messages: any[] = [];
  const blocks: any[] = [];
  const reports: any[] = [];
  const matchEvents: any[] = [];
  const callSessions: any[] = [];
  const gameCatalog: any[] = [];
  const gameSessions: any[] = [];
  const relationshipSpaces: any[] = [];
  const idempotencyRecords = new Map<string, any>();

  let seq = 1;

  const prisma: any = {
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(prisma),
    account: {
      findUnique: async ({ where }: any) => accounts.get(where.id) ?? null,
      findMany: async ({ where }: any) => {
        const ids = new Set<string>(where?.id?.in || []);
        return Array.from(accounts.values()).filter((a) => ids.has(a.id));
      },
      update: async ({ where, data }: any) => {
        const acc = accounts.get(where.id);
        if (acc) Object.assign(acc, data);
        return acc;
      },
    },
    accountEligibility: {
      update: async ({ where, data }: any) => {
        const acc = accounts.get(where.accountId);
        if (acc?.eligibility) Object.assign(acc.eligibility, data);
        return acc?.eligibility ?? null;
      },
      updateMany: async ({ where, data }: any) => {
        const acc = accounts.get(where.accountId);
        if (acc?.eligibility) Object.assign(acc.eligibility, data);
        return { count: acc?.eligibility ? 1 : 0 };
      },
    },
    profile: {
      findUnique: async ({ where }: any) => {
        if (where.id) return profilesById.get(where.id) ?? null;
        if (where.accountId) return profilesByAccount.get(where.accountId) ?? null;
        return null;
      },
      findMany: async ({ where }: any) => {
        const included = where?.accountId?.in ? new Set<string>(where.accountId.in) : null;
        const excluded = where?.accountId?.notIn ? new Set<string>(where.accountId.notIn) : new Set();
        return Array.from(profilesByAccount.values()).filter((p) => {
          if (excluded.has(p.accountId)) return false;
          if (included && !included.has(p.accountId)) return false;
          return true;
        });
      },
      updateMany: async () => ({ count: 1 }),
    },
    userBlock: {
      findFirst: async ({ where }: any) =>
        blocks.find((b) =>
          (where?.OR || []).some(
            (cond: any) => b.blockerId === cond.blockerId && b.blockedId === cond.blockedId,
          ),
        ) ?? null,
      findMany: async ({ where }: any) =>
        blocks.filter((b) =>
          (where?.OR || []).some(
            (cond: any) =>
              (cond.blockerId && b.blockerId === cond.blockerId) ||
              (cond.blockedId && b.blockedId === cond.blockedId),
          ),
        ),
      upsert: async ({ where, create, update }: any) => {
        const k = where.blockerId_blockedId;
        const existing = blocks.find((b) => b.blockerId === k.blockerId && b.blockedId === k.blockedId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: uuid(900 + seq++), ...create };
        blocks.push(row);
        return row;
      },
    },
    report: {
      findFirst: async ({ where }: any) =>
        reports.find(
          (r) =>
            r.reporterId === where.reporterId &&
            r.reportedId === where.reportedId &&
            r.reportCategory === where.reportCategory &&
            r.status === where.status,
        ) ?? null,
      create: async ({ data }: any) => {
        const row = { id: uuid(950 + seq++), createdAt: new Date(), ...data };
        reports.push(row);
        return row;
      },
    },
    like: {
      findUnique: async ({ where }: any) => {
        if (where.id) return likes.find((l) => l.id === where.id) ?? null;
        const k = where.fromAccountId_toAccountId;
        return (
          likes.find((l) => l.fromAccountId === k.fromAccountId && l.toAccountId === k.toAccountId) ??
          null
        );
      },
      findFirst: async ({ where }: any) =>
        likes.find(
          (l) =>
            (!where.fromAccountId || l.fromAccountId === where.fromAccountId) &&
            (!where.toAccountId || l.toAccountId === where.toAccountId) &&
            (!where.status || l.status === where.status),
        ) ?? null,
      findMany: async ({ where }: any) =>
        likes.filter(
          (l) =>
            (!where.fromAccountId || l.fromAccountId === where.fromAccountId) &&
            (!where.toAccountId || l.toAccountId === where.toAccountId) &&
            (!where.status || l.status === where.status),
        ),
      create: async ({ data }: any) => {
        const now = new Date();
        const row = { id: uuid(400 + seq++), ...data, createdAt: now, updatedAt: now };
        likes.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const l = likes.find((r) => r.id === where.id);
        if (l) Object.assign(l, data);
        return l;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const l of likes) {
          const matchOr = (where?.OR || []).some(
            (c: any) => l.fromAccountId === c.fromAccountId && l.toAccountId === c.toAccountId,
          );
          if ((!where.OR || matchOr) && (!where.status || l.status === where.status)) {
            Object.assign(l, data);
            count++;
          }
        }
        return { count };
      },
    },
    pass: {
      findMany: async () => passes,
    },
    match: {
      findUnique: async ({ where, include }: any) => {
        const m = where.id
          ? matches.find((row) => row.id === where.id)
          : matches.find(
              (row) =>
                row.userLowId === where.userLowId_userHighId.userLowId &&
                row.userHighId === where.userLowId_userHighId.userHighId,
            );
        if (!m) return null;
        if (include?.conversation) {
          const conv = conversations.find((c) => c.matchId === m.id) || null;
          return {
            ...m,
            conversation: conv
              ? {
                  ...conv,
                  messages: messages
                    .filter((msg) => msg.conversationId === conv.id)
                    .sort((a, b) => Number(b.sequenceNo) - Number(a.sequenceNo))
                    .slice(0, 1),
                }
              : null,
          };
        }
        return m;
      },
      findMany: async ({ where }: any) =>
        matches
          .filter(
            (m) =>
              (m.userLowId === where.OR[0].userLowId || m.userHighId === where.OR[1].userHighId) &&
              (!where.status || m.status === where.status),
          )
          .map((m) => {
            const conv = conversations.find((c) => c.matchId === m.id) || null;
            return {
              ...m,
              conversation: conv
                ? {
                    ...conv,
                    messages: messages
                      .filter((msg) => msg.conversationId === conv.id)
                      .sort((a, b) => Number(b.sequenceNo) - Number(a.sequenceNo))
                      .slice(0, 1),
                  }
                : null,
            };
          }),
      upsert: async ({ where, create, update }: any) => {
        const k = where.userLowId_userHighId;
        const existing = matches.find((m) => m.userLowId === k.userLowId && m.userHighId === k.userHighId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const matchRow = {
          id: uuid(700 + seq++),
          userLowId: create.userLowId,
          userHighId: create.userHighId,
          status: 'active',
          createdAt: new Date(),
          endedAt: null,
          endedByAccountId: null,
          endReason: null,
        };
        matches.push(matchRow);
        const conv = {
          id: uuid(800 + seq++),
          matchId: matchRow.id,
          status: 'active',
          createdAt: new Date(),
          lastMessageAt: null,
        };
        conversations.push(conv);
        for (const mem of [matchRow.userLowId, matchRow.userHighId]) {
          conversationMembers.push({ conversationId: conv.id, accountId: mem });
        }
        return { ...matchRow, conversation: conv };
      },
      update: async ({ where, data }: any) => {
        const m = matches.find((row) => row.id === where.id);
        if (m) Object.assign(m, data);
        return m;
      },
    },
    conversation: {
      findUnique: async ({ where }: any) => conversations.find((c) => c.id === where.id) ?? null,
      update: async ({ where, data }: any) => {
        const c = conversations.find((r) => r.id === where.id);
        if (c) Object.assign(c, data);
        return c;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const c of conversations) {
          if ((where.id ? c.id === where.id : c.matchId === where.matchId) && c.status !== data.status) {
            Object.assign(c, data);
            count++;
          }
        }
        return { count };
      },
    },
    conversationMember: {
      findUnique: async ({ where }: any) => {
        const k = where.conversationId_accountId;
        const hit = conversationMembers.find(
          (m) => m.conversationId === k.conversationId && m.accountId === k.accountId,
        );
        if (!hit) return null;
        const conv = conversations.find((c) => c.id === hit.conversationId);
        const match = conv ? matches.find((m) => m.id === conv.matchId) : null;
        return {
          ...hit,
          conversation: { ...conv, match, members: conversationMembers.filter((m) => m.conversationId === hit.conversationId) },
        };
      },
      upsert: async ({ where, create }: any) => {
        const k = where.conversationId_accountId;
        if (!conversationMembers.find((m) => m.conversationId === k.conversationId && m.accountId === k.accountId)) {
          conversationMembers.push({ ...create });
        }
        return create;
      },
    },
    message: {
      findFirst: async ({ where }: any) =>
        messages
          .filter((m) => m.conversationId === where.conversationId)
          .sort((a, b) => Number(b.sequenceNo) - Number(a.sequenceNo))[0] ?? null,
      findMany: async ({ where }: any) =>
        messages
          .filter((m) => m.conversationId === where.conversationId)
          .sort((a, b) => Number(a.sequenceNo) - Number(b.sequenceNo)),
      create: async ({ data }: any) => {
        const msg = { id: uuid(850 + seq++), createdAt: new Date(), ...data };
        messages.push(msg);
        return msg;
      },
    },
    matchStateEvent: {
      create: async ({ data }: any) => {
        matchEvents.push(data);
        return data;
      },
    },
    callSession: {
      findUnique: async ({ where }: any) => callSessions.find((c) => c.id === where.id) ?? null,
      findFirst: async ({ where }: any) =>
        callSessions.find(
          (c) =>
            (!where?.conversationId || c.conversationId === where.conversationId) &&
            (!where?.callStatus?.in || where.callStatus.in.includes(c.callStatus)),
        ) ?? null,
      findMany: async ({ where }: any) =>
        callSessions.filter(
          (c) =>
            (!where?.conversationId || c.conversationId === where.conversationId) &&
            (!where?.callStatus?.in || where.callStatus.in.includes(c.callStatus)),
        ),
      create: async ({ data }: any) => {
        const row = { ...data, createdAt: new Date(), startedAt: null, endedAt: null };
        callSessions.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const c = callSessions.find((r) => r.id === where.id);
        if (c) Object.assign(c, data);
        return c;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const c of callSessions) {
          if (c.conversationId === where.conversationId && where.callStatus.in.includes(c.callStatus)) {
            Object.assign(c, data);
            count++;
          }
        }
        return { count };
      },
    },
    gameCatalog: {
      upsert: async ({ create }: any) => {
        const row = { id: uuid(980 + seq++), ...create };
        gameCatalog.push(row);
        return row;
      },
    },
    gameSession: {
      findUnique: async ({ where }: any) => gameSessions.find((g) => g.id === where.id) ?? null,
      create: async ({ data }: any) => {
        const row = {
          ...data,
          game: { gameKey: 'word_scramble', title: 'Word Scramble' },
          members: [{ accountId: 'inviter', role: 'inviter', score: 0 }],
          startedAt: null,
          completedAt: null,
        };
        gameSessions.push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const g of gameSessions) {
          if (g.conversationId === where.conversationId && where.sessionStatus.in.includes(g.sessionStatus)) {
            Object.assign(g, data);
            count++;
          }
        }
        return { count };
      },
    },
    virtualDate: {
      updateMany: async () => ({ count: 0 }),
    },
    relationshipSpace: {
      findUnique: async ({ where }: any) =>
        relationshipSpaces.find((r) => r.matchId === where.matchId) ?? null,
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const r of relationshipSpaces) {
          if (r.matchId === where.matchId && r.isActive) {
            Object.assign(r, data);
            count++;
          }
        }
        return { count };
      },
    },
    appSession: { updateMany: async () => ({ count: 0 }) },
    auditEvent: { create: async () => ({ id: 'audit-1' }) },
    idempotencyRecord: {
      findUnique: async ({ where }: any) => idempotencyRecords.get(where.idempotencyKey) ?? null,
      create: async ({ data }: any) => {
        idempotencyRecords.set(data.idempotencyKey, data);
        return data;
      },
    },
  };

  process.env.LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880';
  process.env.LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'APItestkey123';
  process.env.LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '0123456789abcdef0123456789abcdef';
  const livekitAdapter = new LiveKitProviderAdapter();
  (livekitAdapter as any).ensureAudioRoom = async () => {};
  (livekitAdapter as any).deleteRoom = async () => 'deleted';
  (livekitAdapter as any).evictSession = async () => ({
    outcome: 'evicted',
    participantIdentities: [],
    roomDeleted: 'deleted',
  });

  const matchAuth = new MatchAuthorizationService(prisma);
  const cryptoSvc = new CryptoService();
  const dating = new DatingService(prisma, undefined, undefined, matchAuth);
  const messaging = new MessagingService(prisma, matchAuth);
  const calling = new CallingService(prisma, cryptoSvc, matchAuth, livekitAdapter);
  const together = new TogetherService(prisma, matchAuth);
  const safety = new SafetyService(prisma, matchAuth);
  const identity = new IdentityService(prisma, cryptoSvc, { sendOtpEmail: async () => {} } as any, matchAuth);

  const seedUser = (
    num: number,
    name: string,
    opts?: { age?: number; ageDisplayMode?: 'show_calculated_age' | 'hidden'; isPaused?: boolean },
  ) => {
    const accountId = uuid(10 + num);
    const profileId = uuid(200 + num);
    const acc = {
      id: accountId,
      email: `24f${num}@ds.study.iitm.ac.in`,
      accountStatus: 'active',
      deletedAt: null,
      eligibility: {
        accountId,
        ageStatus: 'approved',
        studentStatus: 'approved',
        programmeFamily: ProgrammeFamily.ELECTRONIC_SYSTEMS,
        dateOfBirth: makeDobForAge(opts?.age ?? 22),
        discoveryEligible: true,
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      },
    };
    const prof = {
      id: profileId,
      accountId,
      displayName: name,
      bio: `Peer bio for ${name}`,
      programmeFamily: ProgrammeFamily.ELECTRONIC_SYSTEMS,
      termOrYear: 'BSc Level',
      locationCity: 'Chennai',
      locationState: 'Tamil Nadu',
      intention: 'serious_relationship',
      profileStatus: opts?.isPaused ? 'paused' : 'live',
      isPublished: !opts?.isPaused,
      isPaused: Boolean(opts?.isPaused),
      ageDisplayMode: opts?.ageDisplayMode ?? 'show_calculated_age',
      publishedAt: new Date(),
      consentAcceptedAt: new Date(),
      account: acc,
      photos: [
        {
          id: uuid(300 + num),
          profileId,
          photoUrl: `https://signed.local/match-${num}.jpg`,
          s3Key: `private/raw/storage/key/${num}.jpg`,
          displayOrder: 0,
          isPrimary: true,
          moderationStatus: 'approved',
          deletedAt: null,
        },
      ],
      interests: [{ interest: { id: 'int-1', name: 'Robotics' } }],
      promptAnswers: [{ id: `pa-${num}`, prompt: { promptText: 'Study break?' }, answerText: 'Tea on the terrace.' }],
      preferences: {
        minAge: 18,
        maxAge: 35,
        allowedProgrammes: [ProgrammeFamily.ELECTRONIC_SYSTEMS, ProgrammeFamily.DATA_SCIENCE_APPLICATIONS],
        showInDiscovery: !opts?.isPaused,
      },
    };
    accounts.set(accountId, acc);
    profilesByAccount.set(accountId, prof);
    profilesById.set(profileId, prof);
    return { accountId, profileId, acc, prof };
  };

  return {
    prisma,
    dating,
    messaging,
    calling,
    together,
    safety,
    identity,
    seedUser,
    state: { matches, conversations, messages, blocks, reports, matchEvents, callSessions, gameSessions },
  };
}

describe('Phase 3.4: Matches & Connection Management Domain, Privacy, Unmatch vs Block & Security', () => {
  test('MATCH-PRIV-01: getMatches & getMatchDetail hydrate partner profile safely without leaking internal IDs, DOB, roll no, or raw storage keys', async () => {
    const h = createPhase34Harness();
    const uA = h.seedUser(1, 'Ananya');
    const uB = h.seedUser(2, 'Arjun Hidden', { age: 25, ageDisplayMode: 'hidden' });

    await h.dating.sendLike(uA.accountId, { targetProfileId: uB.profileId });
    const matchRes = await h.dating.sendLike(uB.accountId, { targetProfileId: uA.profileId });
    assert.strictEqual(matchRes.isMutualMatch, true);

    // Pausing discovery must NOT delete or hide existing active Matches (Doc 02 §3.2)
    uB.prof.isPaused = true;
    uB.prof.profileStatus = 'paused';
    uB.prof.isPublished = false;

    await h.messaging.sendMessage(uB.accountId, matchRes.conversationId!, {
      bodyText: 'Hey Ananya!',
    });

    const matchesA = await h.dating.getMatches(uA.accountId);
    assert.strictEqual(matchesA.length, 1);
    const m = matchesA[0];
    assert.strictEqual(m.matchId, matchRes.matchId);
    assert.strictEqual(m.conversationId, matchRes.conversationId);
    assert.strictEqual(m.matchedAccountId, undefined, 'Must not expose internal matchedAccountId');
    assert.strictEqual(m.profile.profileId, uB.profileId);
    assert.strictEqual(m.profile.displayName, 'Arjun Hidden');
    assert.strictEqual(m.profile.age, null, 'Hidden age must remain null');
    assert.strictEqual(m.profile.ageVisible, false);
    assert.strictEqual(m.lastMessageText, 'Hey Ananya!');
    assert.strictEqual(m.lastMessageIsOwn, false);

    // Ensure zero sensitive fields appear in serialized payload
    const rawJson = JSON.stringify(matchesA);
    assert.strictEqual(rawJson.includes(uB.accountId), false);
    assert.strictEqual(rawJson.includes('private/raw/storage/key'), false);
    assert.strictEqual(rawJson.includes('dateOfBirth'), false);
    assert.strictEqual(rawJson.includes('ds.study.iitm.ac.in'), false);

    // Messaging history serializes BigInt sequenceNo safely without exposing senderAccountId
    const msgsA = await h.messaging.getMessages(uA.accountId, matchRes.conversationId!);
    assert.strictEqual(msgsA.length, 1);
    assert.strictEqual(typeof msgsA[0].sequenceNo, 'number');
    assert.strictEqual((msgsA[0] as any).senderAccountId, undefined);
    assert.strictEqual(msgsA[0].isOwn, false);

    // Match detail lookup succeeds for participant & rejects third party
    const detailA = await h.dating.getMatchDetail(uA.accountId, matchRes.matchId!);
    assert.strictEqual(detailA.profile.profileId, uB.profileId);
    const uUnrelated = h.seedUser(3, 'Outsider');
    await assert.rejects(
      () => h.dating.getMatchDetail(uUnrelated.accountId, matchRes.matchId!),
      (err: any) => err.status === 403,
    );
  });

  test('UNMATCH-SEPARATION-01: Unmatch ends match & closes Messaging/Calling/Games idempotently without creating a Block or Report', async () => {
    const h = createPhase34Harness();
    const uA = h.seedUser(1, 'Meera');
    const uB = h.seedUser(2, 'Kabir');

    await h.dating.sendLike(uA.accountId, { targetProfileId: uB.profileId });
    const matchRes = await h.dating.sendLike(uB.accountId, { targetProfileId: uA.profileId });
    const matchId = matchRes.matchId!;
    const conversationId = matchRes.conversationId!;

    const call = await h.calling.inviteCall(uA.accountId, { conversationId });
    const game = await h.together.inviteGame(uA.accountId, {
      conversationId,
      gameKey: 'word_scramble',
    });

    // Idempotent unmatch via Idempotency-Key + repeat call
    const u1 = await h.dating.unmatch(uA.accountId, { matchId, reason: 'Changed mind' }, 'idem-u-1');
    assert.strictEqual(u1.status, 'ended');
    assert.strictEqual(u1.alreadyEnded, false);
    assert.strictEqual(h.state.matchEvents.length, 1);

    const uReplay = await h.dating.unmatch(uA.accountId, { matchId }, 'idem-u-1');
    assert.strictEqual(uReplay.alreadyEnded, false); // replayed cached 1st response
    assert.strictEqual(h.state.matchEvents.length, 1);

    const uRepeat = await h.dating.unmatch(uB.accountId, { matchId }, 'idem-u-2');
    assert.strictEqual(uRepeat.alreadyEnded, true);
    assert.strictEqual(h.state.matchEvents.length, 1, 'Repeated unmatch must not duplicate MatchStateEvent');

    // Separate from Block & Report
    assert.strictEqual(h.state.blocks.length, 0, 'Ordinary unmatch must NOT create a safety block');
    assert.strictEqual(h.state.reports.length, 0, 'Ordinary unmatch must NOT create a report');

    // Downstream access revoked for both former partners
    for (const op of [
      () => h.dating.getMatchDetail(uA.accountId, matchId),
      () => h.dating.getMatchDetail(uB.accountId, matchId),
      () => h.messaging.getMessages(uA.accountId, conversationId),
      () => h.messaging.sendMessage(uB.accountId, conversationId, { bodyText: 'After unmatch' }),
      () => h.calling.respondToCall(uB.accountId, call.callSession.id, { action: 'accept' }),
      () => h.together.respondGame(uB.accountId, game.id, { action: 'accept' }),
      () => h.dating.sendLike(uA.accountId, { targetProfileId: uB.profileId }),
    ]) {
      await assert.rejects(op, (err: any) => err.status === 403);
    }

    assert.strictEqual((await h.dating.getMatches(uA.accountId)).length, 0);
    assert.strictEqual((await h.dating.getMatches(uB.accountId)).length, 0);
  });

  test('SAFETY-REPORT-01: Report is separate from Unmatch, deduplicates identical pending reports cleanly, and Block closes Match independently', async () => {
    const h = createPhase34Harness();
    const uA = h.seedUser(1, 'Diya');
    const uB = h.seedUser(2, 'Rohan');

    await h.dating.sendLike(uA.accountId, { targetProfileId: uB.profileId });
    const matchRes = await h.dating.sendLike(uB.accountId, { targetProfileId: uA.profileId });

    const r1 = await h.safety.reportUser(
      uA.accountId,
      { targetProfileId: uB.profileId, reportCategory: 'spam', description: 'Promotional link' },
      'rep-key-1',
    );
    assert.strictEqual(r1.success, true);
    assert.strictEqual(r1.alreadyReported, false);

    // Duplicate identical pending report within window is cleanly deduplicated
    const r2 = await h.safety.reportUser(uA.accountId, {
      targetProfileId: uB.profileId,
      reportCategory: 'spam',
      description: 'Promotional link',
    });
    assert.strictEqual(r2.alreadyReported, true);
    assert.strictEqual(h.state.reports.length, 1);

    // Report alone does NOT close the Match unless user also blocks/unmatches
    assert.strictEqual((await h.dating.getMatches(uA.accountId)).length, 1);

    // Explicit Block ends Match and creates UserBlock
    await h.safety.blockUser(uA.accountId, { targetProfileId: uB.profileId, reason: 'Block' });
    assert.strictEqual(h.state.blocks.length, 1);
    assert.strictEqual((await h.dating.getMatches(uA.accountId)).length, 0);
    await assert.rejects(
      () => h.dating.getMatchDetail(uB.accountId, matchRes.matchId!),
      (err: any) => err.status === 403,
    );
  });

  test('AUTH-REVOKE-01: Suspended, deleted, age-revoked, and student-revoked partners lose Match visibility and getMatchDetail denies access cleanly', async () => {
    const h = createPhase34Harness();
    const uA = h.seedUser(1, 'Neha');
    const uSusp = h.seedUser(2, 'SuspendedPartner');
    const uDel = h.seedUser(3, 'DeletedPartner');
    const uAgeRev = h.seedUser(4, 'AgeRevoked');
    const uStuRev = h.seedUser(5, 'StudentRevoked');

    const pairMap = new Map<string, string>();
    for (const peer of [uSusp, uDel, uAgeRev, uStuRev]) {
      await h.dating.sendLike(uA.accountId, { targetProfileId: peer.profileId });
      const res = await h.dating.sendLike(peer.accountId, { targetProfileId: uA.profileId });
      pairMap.set(peer.accountId, res.matchId!);
    }
    assert.strictEqual((await h.dating.getMatches(uA.accountId)).length, 4);

    await h.identity.suspendOrRestrictAccount(uSusp.accountId, { status: 'suspended' });
    uDel.acc.deletedAt = new Date();
    uAgeRev.acc.eligibility.ageStatus = 'rejected';
    uAgeRev.acc.eligibility.discoveryEligible = false;
    uStuRev.acc.eligibility.studentStatus = 'rejected';
    uStuRev.acc.eligibility.discoveryEligible = false;

    assert.strictEqual((await h.dating.getMatches(uA.accountId)).length, 0);
    for (const matchId of pairMap.values()) {
      await assert.rejects(
        () => h.dating.getMatchDetail(uA.accountId, matchId),
        (err: any) => err.status === 403,
      );
    }
  });
});
