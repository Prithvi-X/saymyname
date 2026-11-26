import { test, describe } from 'node:test';
import * as assert from 'node:assert/strict';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { MatchAuthorizationService } from '../src/modules/safety/match-authorization.service';
import { DatingService } from '../src/modules/dating/dating.service';
import { MessagingService } from '../src/modules/messaging/messaging.service';
import { CallingService } from '../src/modules/calling/calling.service';
import { LiveKitProviderAdapter } from '../src/modules/calling/livekit-provider.adapter';
import { TogetherService } from '../src/modules/together/together.service';
import { SafetyService } from '../src/modules/safety/safety.service';
import { VerificationService } from '../src/modules/verification/verification.service';
import { IdentityService } from '../src/modules/identity/identity.service';
import { ProfilesService } from '../src/modules/profiles/profiles.service';
import { CryptoService } from '../src/modules/identity/security/crypto.service';
import { CallingController } from '../src/modules/calling/calling.controller';
import { TogetherController } from '../src/modules/together/together.controller';
import {
  doesFfmpegVersionSupportHeic,
  getAllowedImageMimes,
  isHeicDecodingSupported,
  verifyAndSanitizeR2Image,
} from '../src/modules/profiles/image-security';
import { AccountLifecycleState, ProgrammeFamily } from '@saymyname/contracts';

function uuid(n: number): string {
  return `99990000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function createClosureMockHarness() {
  const dobAdult = new Date(Date.UTC(2001, 4, 15));
  const accounts = new Map<string, any>();
  const eligibilities = new Map<string, any>();
  const profiles = new Map<string, any>();
  const likes: any[] = [];
  const passes: any[] = [];
  const blocks: any[] = [];
  const matches: any[] = [];
  const matchEvents: any[] = [];
  const conversations: any[] = [];
  const convMembers: any[] = [];
  const messages: any[] = [];
  const callSessions: any[] = [];
  const gameCatalog: any[] = [];
  const gameSessions: any[] = [];
  const gameMembers: any[] = [];
  const virtualDates: any[] = [];
  const relationshipSpaces: any[] = [];
  const milestones: any[] = [];
  const journals: any[] = [];
  const verificationCases: any[] = [];
  const appSessions: any[] = [];
  const auditEvents: any[] = [];

  const seedUser = (
    n: number,
    name: string,
    opts: { dob?: Date | null; status?: string; discoveryEligible?: boolean; ageStatus?: string; studentStatus?: string } = {},
  ) => {
    const id = uuid(n);
    const profId = uuid(100 + n);
    accounts.set(id, {
      id,
      authSubject: id,
      email: `user${n}@ds.study.iitm.ac.in`,
      accountStatus: opts.status ?? 'active',
      emailVerifiedAt: new Date(),
      displayName: name,
      deletedAt: null,
    });
    eligibilities.set(id, {
      accountId: id,
      ageStatus: opts.ageStatus ?? 'approved',
      studentStatus: opts.studentStatus ?? 'approved',
      programmeFamily: ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
      pathwayCode: 'foundation_entry',
      dateOfBirth: 'dob' in opts ? opts.dob : dobAdult,
      discoveryEligible: opts.discoveryEligible ?? true,
      validUntil: null,
      reviewNotes: `CONFIDENTIAL_MODERATOR_NOTE_${n}`,
    });
    profiles.set(id, {
      id: profId,
      accountId: id,
      displayName: name,
      programmeFamily: ProgrammeFamily.DATA_SCIENCE_APPLICATIONS,
      isPublished: true,
      isPaused: false,
      profileStatus: 'live',
      ageDisplayMode: 'show_calculated_age',
      consentAcceptedAt: new Date(),
      photos: [
        {
          id: uuid(500 + n),
          s3Key: `photos/${id}/p.jpg`,
          isPrimary: true,
          displayOrder: 0,
          deletedAt: null,
          moderationStatus: 'approved',
        },
      ],
      preferences: {
        minAge: 18,
        maxAge: 35,
        allowedProgrammes: [ProgrammeFamily.DATA_SCIENCE_APPLICATIONS],
        maxDistanceKm: null,
        showInDiscovery: true,
      },
      interests: [],
      promptAnswers: [],
    });
    return { accountId: id, profileId: profId };
  };

  const prisma: any = {
    account: {
      findUnique: async ({ where }: any) => {
        const a = accounts.get(where.id);
        return a ? { ...a, eligibility: eligibilities.get(a.id) ?? null } : null;
      },
      findMany: async ({ where }: any) => {
        const ids: string[] = where?.id?.in || [];
        return ids
          .map((id) => accounts.get(id))
          .filter(Boolean)
          .map((a) => ({ ...a, eligibility: eligibilities.get(a.id) ?? null }));
      },
      update: async ({ where, data }: any) => {
        const a = accounts.get(where.id);
        if (!a) throw new Error('Account not found');
        Object.assign(a, data);
        return a;
      },
    },
    accountEligibility: {
      findUnique: async ({ where }: any) => eligibilities.get(where.accountId) ?? null,
      upsert: async ({ where, update, create }: any) => {
        const existing = eligibilities.get(where.accountId);
        if (existing) {
          for (const [k, v] of Object.entries(update || {})) {
            if (v !== undefined) existing[k] = v;
          }
          return existing;
        }
        const row = { ...create };
        eligibilities.set(where.accountId, row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        const e = eligibilities.get(where.accountId);
        if (e) {
          Object.assign(e, data);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    verificationCase: {
      findUnique: async ({ where }: any) => {
        const c = verificationCases.find((v) => v.id === where.id);
        if (!c) return null;
        const a = accounts.get(c.accountId);
        return { ...c, account: a ? { ...a, eligibility: eligibilities.get(a.id) ?? null } : null };
      },
      update: async ({ where, data }: any) => {
        const c = verificationCases.find((v) => v.id === where.id);
        Object.assign(c, data);
        return c;
      },
      create: async ({ data }: any) => {
        const row = { id: crypto.randomUUID(), ...data };
        verificationCases.push(row);
        return row;
      },
    },
    profile: {
      findUnique: async ({ where }: any) => {
        const p = where.id
          ? Array.from(profiles.values()).find((x) => x.id === where.id)
          : profiles.get(where.accountId);
        if (!p) return null;
        const a = accounts.get(p.accountId);
        return { ...p, account: a ? { ...a, eligibility: eligibilities.get(a.id) ?? null } : null };
      },
      findMany: async () =>
        Array.from(profiles.values()).map((p) => {
          const a = accounts.get(p.accountId);
          return { ...p, account: a ? { ...a, eligibility: eligibilities.get(a.id) ?? null } : null };
        }),
      updateMany: async ({ where, data }: any) => {
        const p = profiles.get(where.accountId);
        if (p) {
          Object.assign(p, data);
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    like: {
      findMany: async ({ where }: any) =>
        likes.filter(
          (l) =>
            (!where?.fromAccountId || l.fromAccountId === where.fromAccountId) &&
            (!where?.status || l.status === where.status),
        ),
      findFirst: async ({ where }: any) =>
        likes.find(
          (l) =>
            l.fromAccountId === where.fromAccountId &&
            l.toAccountId === where.toAccountId &&
            (!where.status || l.status === where.status),
        ) ?? null,
      upsert: async ({ where, create, update }: any) => {
        const k = where.fromAccountId_toAccountId;
        let hit = likes.find((l) => l.fromAccountId === k.fromAccountId && l.toAccountId === k.toAccountId);
        if (hit) {
          Object.assign(hit, update);
          return hit;
        }
        hit = { id: crypto.randomUUID(), ...create };
        likes.push(hit);
        return hit;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const l of likes) {
          const orMatch = (where.OR || []).some(
            (c: any) => c.fromAccountId === l.fromAccountId && c.toAccountId === l.toAccountId,
          );
          if (orMatch && (!where.status || l.status === where.status)) {
            Object.assign(l, data);
            count++;
          }
        }
        return { count };
      },
    },
    pass: {
      findMany: async () => passes,
      upsert: async ({ where, create, update }: any) => {
        const k = where.fromAccountId_toAccountId;
        let hit = passes.find((p) => p.fromAccountId === k.fromAccountId && p.toAccountId === k.toAccountId);
        if (hit) {
          Object.assign(hit, update);
          return hit;
        }
        hit = { id: crypto.randomUUID(), ...create };
        passes.push(hit);
        return hit;
      },
    },
    userBlock: {
      findFirst: async ({ where }: any) =>
        blocks.find((b) =>
          (where.OR || []).some((c: any) => c.blockerId === b.blockerId && c.blockedId === b.blockedId),
        ) ?? null,
      findMany: async () => blocks,
      upsert: async ({ where, create }: any) => {
        const k = where.blockerId_blockedId;
        const hit = blocks.find((b) => b.blockerId === k.blockerId && b.blockedId === k.blockedId);
        if (hit) return hit;
        const row = { id: crypto.randomUUID(), ...create };
        blocks.push(row);
        return row;
      },
    },
    match: {
      findUnique: async ({ where }: any) => {
        let hit: any = null;
        if (where.id) hit = matches.find((m) => m.id === where.id);
        else if (where.userLowId_userHighId) {
          const k = where.userLowId_userHighId;
          hit = matches.find((m) => m.userLowId === k.userLowId && m.userHighId === k.userHighId);
        }
        if (!hit) return null;
        const conv = conversations.find((c) => c.matchId === hit.id) ?? null;
        return {
          ...hit,
          conversation: conv
            ? { ...conv, members: convMembers.filter((cm) => cm.conversationId === conv.id) }
            : null,
        };
      },
      findMany: async ({ where }: any) =>
        matches
          .filter((m) => {
            const orMatch = (where.OR || []).some(
              (c: any) => (c.userLowId && m.userLowId === c.userLowId) || (c.userHighId && m.userHighId === c.userHighId),
            );
            return orMatch && (!where.status || m.status === where.status);
          })
          .map((m) => {
            const conv = conversations.find((c) => c.matchId === m.id) ?? null;
            return { ...m, conversation: conv ? { ...conv, messages: [] } : null };
          }),
      upsert: async ({ where, create }: any) => {
        const k = where.userLowId_userHighId;
        let hit = matches.find((m) => m.userLowId === k.userLowId && m.userHighId === k.userHighId);
        if (!hit) {
          hit = {
            id: crypto.randomUUID(),
            userLowId: create.userLowId,
            userHighId: create.userHighId,
            status: create.status || 'active',
            createdAt: new Date(),
            endedAt: null,
            endedByAccountId: null,
            endReason: null,
          };
          matches.push(hit);
          if (create.conversation?.create) {
            const conv = {
              id: crypto.randomUUID(),
              matchId: hit.id,
              status: 'active',
              createdAt: new Date(),
              lastMessageAt: null,
            };
            conversations.push(conv);
            for (const mem of create.conversation.create.members?.create || []) {
              convMembers.push({ conversationId: conv.id, accountId: mem.accountId });
            }
          }
        }
        const conv = conversations.find((c) => c.matchId === hit.id) ?? null;
        return { ...hit, conversation: conv };
      },
      update: async ({ where, data }: any) => {
        const m = matches.find((x) => x.id === where.id);
        Object.assign(m, data);
        return m;
      },
    },
    matchStateEvent: {
      create: async ({ data }: any) => {
        const ev = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        matchEvents.push(ev);
        return ev;
      },
    },
    conversation: {
      findUnique: async ({ where }: any) => {
        const conv = conversations.find((c) => c.id === where.id);
        if (!conv) return null;
        const match = matches.find((m) => m.id === conv.matchId) ?? null;
        return {
          ...conv,
          match,
          members: convMembers.filter((cm) => cm.conversationId === conv.id),
        };
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const c of conversations) {
          if (
            (!where.id || c.id === where.id) &&
            (!where.matchId || c.matchId === where.matchId) &&
            (!where.status?.not || c.status !== where.status.not)
          ) {
            Object.assign(c, data);
            count++;
          }
        }
        return { count };
      },
      update: async ({ where, data }: any) => {
        const c = conversations.find((x) => x.id === where.id);
        if (c) Object.assign(c, data);
        return c;
      },
    },
    conversationMember: {
      findUnique: async ({ where }: any) => {
        const k = where.conversationId_accountId;
        const mem = convMembers.find((m) => m.conversationId === k.conversationId && m.accountId === k.accountId);
        if (!mem) return null;
        const conv = conversations.find((c) => c.id === k.conversationId);
        const match = matches.find((m) => m.id === conv?.matchId) ?? null;
        return {
          ...mem,
          conversation: conv
            ? { ...conv, match, members: convMembers.filter((cm) => cm.conversationId === conv.id) }
            : null,
        };
      },
      findMany: async ({ where }: any) =>
        convMembers
          .filter((m) => m.accountId === where.accountId)
          .map((m) => {
            const conv = conversations.find((c) => c.id === m.conversationId);
            const match = matches.find((mt) => mt.id === conv?.matchId) ?? null;
            return {
              ...m,
              conversation: conv
                ? {
                    ...conv,
                    match,
                    members: convMembers.filter((cm) => cm.conversationId === conv.id),
                    messages: [],
                  }
                : null,
            };
          }),
      upsert: async ({ where, create }: any) => {
        const k = where.conversationId_accountId;
        const hit = convMembers.find((m) => m.conversationId === k.conversationId && m.accountId === k.accountId);
        if (hit) return hit;
        const row = { ...create };
        convMembers.push(row);
        return row;
      },
    },
    message: {
      findMany: async ({ where }: any) => messages.filter((m) => m.conversationId === where.conversationId),
      findFirst: async () => messages[messages.length - 1] ?? null,
      create: async ({ data }: any) => {
        const row = { id: crypto.randomUUID(), createdAt: new Date(), ...data };
        messages.push(row);
        return row;
      },
    },
    callSession: {
      findUnique: async ({ where }: any) => callSessions.find((s) => s.id === where.id) ?? null,
      findFirst: async ({ where }: any) =>
        callSessions.find(
          (s) =>
            (!where?.conversationId || s.conversationId === where.conversationId) &&
            (!where?.callStatus?.in || where.callStatus.in.includes(s.callStatus)),
        ) ?? null,
      findMany: async ({ where }: any) =>
        callSessions.filter(
          (s) =>
            (!where?.conversationId || s.conversationId === where.conversationId) &&
            (!where?.callStatus?.in || where.callStatus.in.includes(s.callStatus)) &&
            (!where?.expiresAt?.lte || (s.expiresAt && new Date(s.expiresAt) <= where.expiresAt.lte)),
        ),
      create: async ({ data }: any) => {
        const row = { createdAt: new Date(), startedAt: null, endedAt: null, ...data };
        callSessions.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const s = callSessions.find((x) => x.id === where.id);
        Object.assign(s, data);
        return s;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const s of callSessions) {
          if (
            s.conversationId === where.conversationId &&
            (!where.callStatus?.in || where.callStatus.in.includes(s.callStatus))
          ) {
            Object.assign(s, data);
            count++;
          }
        }
        return { count };
      },
    },
    gameCatalog: {
      upsert: async ({ where, create }: any) => {
        let g = gameCatalog.find((x) => x.gameKey === where.gameKey);
        if (!g) {
          g = { id: crypto.randomUUID(), ...create };
          gameCatalog.push(g);
        }
        return g;
      },
    },
    gameSession: {
      findUnique: async ({ where }: any) => {
        const gs = gameSessions.find((x) => x.id === where.id);
        if (!gs) return null;
        return {
          ...gs,
          game: gameCatalog.find((g) => g.id === gs.gameId),
          members: gameMembers.filter((m) => m.sessionId === gs.id),
        };
      },
      create: async ({ data }: any) => {
        const row = {
          createdAt: new Date(),
          startedAt: null,
          completedAt: null,
          winnerAccountId: null,
          ...data,
        };
        delete row.members;
        gameSessions.push(row);
        for (const mem of data.members?.create || []) {
          gameMembers.push({ sessionId: row.id, ...mem });
        }
        return {
          ...row,
          game: gameCatalog.find((g) => g.id === row.gameId),
          members: gameMembers.filter((m) => m.sessionId === row.id),
        };
      },
      update: async ({ where, data }: any) => {
        const gs = gameSessions.find((x) => x.id === where.id);
        Object.assign(gs, data);
        return { ...gs, game: gameCatalog.find((g) => g.id === gs.gameId) };
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const gs of gameSessions) {
          if (
            gs.conversationId === where.conversationId &&
            (!where.sessionStatus?.in || where.sessionStatus.in.includes(gs.sessionStatus))
          ) {
            Object.assign(gs, data);
            count++;
          }
        }
        return { count };
      },
    },
    gameSessionMember: {
      upsert: async ({ where, create, update }: any) => {
        const k = where.sessionId_accountId;
        let hit = gameMembers.find((m) => m.sessionId === k.sessionId && m.accountId === k.accountId);
        if (hit) {
          Object.assign(hit, update);
          return hit;
        }
        hit = { ...create };
        gameMembers.push(hit);
        return hit;
      },
    },
    virtualDate: {
      findUnique: async ({ where }: any) => virtualDates.find((d) => d.id === where.id) ?? null,
      findMany: async ({ where }: any) => virtualDates.filter((d) => d.conversationId === where.conversationId),
      create: async ({ data }: any) => {
        const row = { createdAt: new Date(), completedAt: null, ...data };
        virtualDates.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const d = virtualDates.find((x) => x.id === where.id);
        Object.assign(d, data);
        return d;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const d of virtualDates) {
          if (
            d.conversationId === where.conversationId &&
            (!where.status?.in || where.status.in.includes(d.status))
          ) {
            Object.assign(d, data);
            count++;
          }
        }
        return { count };
      },
    },
    relationshipSpace: {
      findUnique: async ({ where }: any) => {
        const sp = relationshipSpaces.find((s) => s.matchId === where.matchId) ?? null;
        if (!sp) return null;
        return {
          ...sp,
          milestones: milestones.filter((m) => m.spaceId === sp.id),
          journals: journals.filter((j) => j.spaceId === sp.id),
        };
      },
      upsert: async ({ where, create, update }: any) => {
        let sp = relationshipSpaces.find((s) => s.matchId === where.matchId);
        if (sp) {
          Object.assign(sp, update);
          return sp;
        }
        sp = { id: crypto.randomUUID(), ...create };
        relationshipSpaces.push(sp);
        return sp;
      },
      update: async ({ where, data }: any) => {
        const sp = relationshipSpaces.find((s) => s.id === where.id);
        Object.assign(sp, data);
        return sp;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const sp of relationshipSpaces) {
          if (sp.matchId === where.matchId && (!where.isActive || sp.isActive === where.isActive)) {
            Object.assign(sp, data);
            count++;
          }
        }
        return { count };
      },
    },
    relationshipMilestone: {
      findMany: async () => milestones,
      create: async ({ data }: any) => {
        const row = { id: crypto.randomUUID(), createdAt: new Date(), ...data };
        milestones.push(row);
        return row;
      },
    },
    relationshipJournal: {
      findMany: async () => journals,
      create: async ({ data }: any) => {
        const row = { id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
        journals.push(row);
        return row;
      },
    },
    appSession: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const s of appSessions) {
          if (s.accountId === where.accountId && s.revokedAt === null) {
            Object.assign(s, data);
            count++;
          }
        }
        return { count };
      },
    },
    auditEvent: {
      create: async ({ data }: any) => {
        const row = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        auditEvents.push(row);
        return row;
      },
    },
    $transaction: async (fn: any) => fn(prisma),
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
  const cryptoService = new CryptoService();
  const dating = new DatingService(prisma, undefined, undefined, matchAuth);
  const messaging = new MessagingService(prisma, matchAuth);
  const calling = new CallingService(prisma, cryptoService, matchAuth, livekitAdapter);
  const together = new TogetherService(prisma, matchAuth);
  const safety = new SafetyService(prisma, matchAuth);
  const verification = new VerificationService(prisma, matchAuth);
  const identity = new IdentityService(prisma, cryptoService, verification, matchAuth);
  const profilesSvc = new ProfilesService(prisma);

  return {
    seedUser,
    accounts,
    eligibilities,
    profiles,
    matches,
    matchEvents,
    conversations,
    callSessions,
    gameSessions,
    virtualDates,
    relationshipSpaces,
    verificationCases,
    appSessions,
    dating,
    messaging,
    calling,
    together,
    safety,
    verification,
    identity,
    profilesSvc,
  };
}

describe('Phase 3.2 Final Must-Requirement Closure (MATCH-11, MATCH-22, HEIC/FFmpeg, DOB)', () => {
  test('MATCH-11: Unmatch cleanly ends Match/Conversation, denies Messaging/Calling/Together, handles idempotency, blocks unrelated user, and prevents reactivation', async () => {
    const h = createClosureMockHarness();
    const uA = h.seedUser(1, 'Ananya');
    const uB = h.seedUser(2, 'Rohan');
    const uUnrelated = h.seedUser(3, 'Karan');

    // Create mutual match & conversation
    await h.dating.sendLike(uA.accountId, { targetProfileId: uB.profileId });
    const matchRes = await h.dating.sendLike(uB.accountId, { targetProfileId: uA.profileId });
    assert.strictEqual(matchRes.isMutualMatch, true);
    const matchId = matchRes.matchId!;
    const conversationId = matchRes.conversationId!;

    // Pre-unmatch baseline works across all modules
    await h.messaging.sendMessage(uA.accountId, conversationId, { bodyText: 'Hey Rohan!' });
    const callInvite = await h.calling.inviteCall(uA.accountId, { conversationId });
    const gameInvite = await h.together.inviteGame(uA.accountId, {
      conversationId,
      gameKey: 'word_scramble',
    });
    const vDate = await h.together.proposeVirtualDate(uA.accountId, {
      conversationId,
      scheduledFor: '2026-12-05T19:00:00.000Z',
      timezone: 'Asia/Kolkata',
      activityType: 'coffee_chat',
    });
    await h.together.proposeRelationship(uA.accountId, { matchId });
    await h.together.proposeRelationship(uB.accountId, { matchId });

    // Unrelated user cannot unmatch, message, call, or touch Together
    await assert.rejects(
      () => h.dating.unmatch(uUnrelated.accountId, { matchId }),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      () => h.messaging.sendMessage(uUnrelated.accountId, conversationId, { bodyText: 'Intrude' }),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      () => h.calling.inviteCall(uUnrelated.accountId, { conversationId }),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      () => h.together.inviteGame(uUnrelated.accountId, { conversationId, gameKey: 'word_scramble' }),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      () => h.together.leaveRelationship(uUnrelated.accountId, { matchId }),
      (e: any) => e.status === 403,
    );

    // User A unmatches User B
    const unmatch1 = await h.dating.unmatch(uA.accountId, {
      matchId,
      reason: 'Different pace',
    });
    assert.strictEqual(unmatch1.alreadyEnded, false);
    const savedEndAt = h.matches[0].endedAt;

    // Repeated unmatch is cleanly idempotent and preserves original endedAt/reason
    const unmatch2 = await h.dating.unmatch(uA.accountId, {
      matchId,
      reason: 'Should not overwrite',
    });
    assert.strictEqual(unmatch2.alreadyEnded, true);
    assert.strictEqual(h.matches[0].endedAt, savedEndAt);
    assert.strictEqual(h.matches[0].endReason, 'Different pace');
    assert.strictEqual(h.conversations[0].status, 'closed');
    assert.strictEqual(h.relationshipSpaces[0].isActive, false);
    assert.strictEqual(h.callSessions[0].callStatus, 'ended');
    assert.strictEqual(h.gameSessions[0].sessionStatus, 'ended');
    assert.strictEqual(h.virtualDates[0].status, 'cancelled');

    // Subsequent Messaging, Calling, and Together attempts all fail closed (403)
    await assert.rejects(
      () => h.messaging.sendMessage(uB.accountId, conversationId, { bodyText: 'After unmatch' }),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      () => h.messaging.getMessages(uA.accountId, conversationId),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      () => h.calling.respondToCall(uB.accountId, callInvite.callSession.id, { action: 'accept' }),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      () => h.calling.inviteCall(uB.accountId, { conversationId }),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      () =>
        h.messaging.presignVoiceNoteForConversation(uB.accountId, conversationId, {
          filename: 'after.webm',
          mimeType: 'audio/webm',
          durationSeconds: 12,
        }),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      () => h.together.respondGame(uB.accountId, gameInvite.id, { action: 'accept' }),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      () => h.together.respondVirtualDate(uB.accountId, vDate.id, { action: 'accept' }),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      () => h.together.getRelationshipSpace(uB.accountId, matchId),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      () =>
        h.together.createMilestone(uB.accountId, matchId, {
          title: 'X',
          milestoneDate: '2026-11-25',
        }),
      (e: any) => e.status === 403,
    );

    // Conversations & matches exclude ended connection
    assert.strictEqual((await h.dating.getMatches(uA.accountId)).length, 0);
    assert.strictEqual((await h.messaging.getConversations(uB.accountId)).length, 0);

    // Ended Match CANNOT be silently reactivated via Like
    await assert.rejects(
      () => h.dating.sendLike(uA.accountId, { targetProfileId: uB.profileId }),
      (e: any) => e.status === 403,
    );
    assert.strictEqual(h.matches[0].status, 'ended');
  });

  test('MATCH-22: Account suspension and verification revocation distinctly invalidate active matches & permissions without leaking moderator notes', async () => {
    const h = createClosureMockHarness();
    const uA = h.seedUser(10, 'Meera');
    const uB = h.seedUser(11, 'Siddharth');
    const uC = h.seedUser(12, 'Kabir');

    // A <-> B match (testing suspension of B)
    await h.dating.sendLike(uA.accountId, { targetProfileId: uB.profileId });
    const matchAB = await h.dating.sendLike(uB.accountId, { targetProfileId: uA.profileId });
    const callAB = await h.calling.inviteCall(uA.accountId, {
      conversationId: matchAB.conversationId!,
    });

    // A <-> C match (testing verification revocation of C)
    await h.dating.sendLike(uA.accountId, { targetProfileId: uC.profileId });
    const matchAC = await h.dating.sendLike(uC.accountId, { targetProfileId: uA.profileId });
    h.verificationCases.push({
      id: uuid(777),
      accountId: uC.accountId,
      checkType: 'student_enrolment',
      status: 'approved',
    });

    // Suspend B
    const susp = await h.identity.suspendOrRestrictAccount(uB.accountId, { status: 'suspended' });
    assert.strictEqual(susp.reasonCode, 'account_suspended');
    assert.strictEqual(susp.invalidatedMatches, 1);

    // Verify distinction: 'account_suspended', NOT 'unmatched' or 'blocked'
    const abRow = h.matches.find((m) => m.id === matchAB.matchId);
    assert.strictEqual(abRow.status, 'ended');
    assert.strictEqual(abRow.endReason, 'account_suspended');
    assert.strictEqual(abRow.endedByAccountId, null);

    // A cannot message/call/getPublicProfile/detail B; error never leaks moderator notes
    for (const op of [
      () => h.messaging.sendMessage(uA.accountId, matchAB.conversationId!, { bodyText: 'Hi' }),
      () => h.calling.respondToCall(uB.accountId, callAB.callSession.id, { action: 'accept' }),
      () => h.together.proposeRelationship(uA.accountId, { matchId: matchAB.matchId! }),
    ]) {
      await assert.rejects(
        op,
        (e: any) =>
          e.status === 403 &&
          !e.message.includes('CONFIDENTIAL_MODERATOR_NOTE') &&
          !e.message.toLowerCase().includes('suspended'),
      );
    }
    await assert.rejects(
      () => h.profilesSvc.getPublicProfile(uA.accountId, uB.profileId),
      (e: any) => e.status === 404,
    );

    // Revoke C verification via reviewer decision -> rejected
    const revRes = await h.verification.decideCase('reviewer-1', uuid(777), {
      decision: 'rejected',
      reasonCode: 'doc_expired',
      rejectionReason: 'CONFIDENTIAL_REJECTION_REASON_DO_NOT_LEAK',
    });
    assert.strictEqual(revRes.discoveryEligible, false);

    const acRow = h.matches.find((m) => m.id === matchAC.matchId);
    assert.strictEqual(acRow.status, 'ended');
    assert.strictEqual(acRow.endReason, 'verification_revoked');

    // A gets generic 403 with zero rejection reason leakage
    await assert.rejects(
      () => h.messaging.sendMessage(uA.accountId, matchAC.conversationId!, { bodyText: 'Hello' }),
      (e: any) => e.status === 403 && !e.message.includes('CONFIDENTIAL_REJECTION_REASON'),
    );
    await assert.rejects(
      () => h.together.inviteGame(uA.accountId, { conversationId: matchAC.conversationId!, gameKey: 'iitm_trivia' }),
      (e: any) => e.status === 403,
    );

    // Candidate discovery excludes suspended/revoked accounts
    const feedA = await h.dating.getCandidates(uA.accountId, {});
    assert.strictEqual(feedA.candidates.length, 0);
  });

  test('Real-time & active session invalidation across all 5 triggers (Unmatch, Block, Suspension, Age Revocation, Student Revocation) and LiveKit SFU audit', async () => {
    const h = createClosureMockHarness();
    const uOwner = h.seedUser(30, 'Diya');
    const triggers = [
      { kind: 'unmatch', peerIdx: 31, expectedReason: 'unmatched' },
      { kind: 'block', peerIdx: 32, expectedReasonPrefix: 'User blocked:' },
      { kind: 'suspension', peerIdx: 33, expectedReason: 'account_suspended' },
      { kind: 'age_revocation', peerIdx: 34, expectedReason: 'verification_revoked' },
      { kind: 'student_revocation', peerIdx: 35, expectedReason: 'verification_revoked' },
    ] as const;

    for (const trig of triggers) {
      const uPeer = h.seedUser(trig.peerIdx, `Peer_${trig.kind}`);
      await h.dating.sendLike(uOwner.accountId, { targetProfileId: uPeer.profileId });
      const matchRes = await h.dating.sendLike(uPeer.accountId, { targetProfileId: uOwner.profileId });
      const matchId = matchRes.matchId!;
      const conversationId = matchRes.conversationId!;

      // Activate an accepted CallSession cleanly (Phase 4.1: no pre-accept token, max 1 active call, 300s audio-only JWT)
      const activeCall = await h.calling.inviteCall(uOwner.accountId, { conversationId });
      assert.strictEqual('token' in (activeCall as any), false);
      const acceptRes = await h.calling.respondToCall(uPeer.accountId, activeCall.callSession.id, {
        action: 'accept',
      });
      await assert.rejects(
        () => h.calling.inviteCall(uPeer.accountId, { conversationId }),
        { name: 'ConflictException' },
      );

      // Inspect issued LiveKit JWT claims: 300s window, microphone-only audio grant
      const [, payloadB64] = acceptRes.token.split('.');
      const lkPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      assert.strictEqual(lkPayload.exp - lkPayload.nbf, 300);
      assert.strictEqual(lkPayload.video.room, activeCall.callSession.livekitRoomId);
      assert.deepStrictEqual(lkPayload.video.canPublishSources, ['microphone']);
      assert.strictEqual(lkPayload.video.canPublishData, false);

      // Activate Together GameSession (ACTIVE), VirtualDate (ACCEPTED), and RelationshipSpace (isActive: true)
      const game = await h.together.inviteGame(uOwner.accountId, {
        conversationId,
        gameKey: 'word_scramble',
      });
      await h.together.respondGame(uPeer.accountId, game.id, { action: 'accept' });
      const vDate = await h.together.proposeVirtualDate(uOwner.accountId, {
        conversationId,
        scheduledFor: '2026-12-15T18:30:00.000Z',
        timezone: 'Asia/Kolkata',
        activityType: 'coffee_chat',
      });
      await h.together.respondVirtualDate(uPeer.accountId, vDate.id, { action: 'accept' });
      await h.together.proposeRelationship(uOwner.accountId, { matchId });
      await h.together.proposeRelationship(uPeer.accountId, { matchId });

      if (trig.kind === 'age_revocation' || trig.kind === 'student_revocation') {
        h.verificationCases.push({
          id: uuid(800 + trig.peerIdx),
          accountId: uPeer.accountId,
          checkType: trig.kind === 'age_revocation' ? 'age' : 'student_enrolment',
          status: 'approved',
        });
      }

      // Execute trigger
      if (trig.kind === 'unmatch') {
        await h.dating.unmatch(uOwner.accountId, { matchId });
      } else if (trig.kind === 'block') {
        await h.safety.blockUser(uOwner.accountId, {
          targetProfileId: uPeer.profileId,
          reason: 'Safety action',
        });
      } else if (trig.kind === 'suspension') {
        await h.identity.suspendOrRestrictAccount(uPeer.accountId, { status: 'suspended' });
      } else {
        await h.verification.decideCase('reviewer-audit', uuid(800 + trig.peerIdx), {
          decision: 'rejected',
          reasonCode: 'revoked_audit',
          rejectionReason: 'CONFIDENTIAL_MOD_AUDIT_NOTE',
        });
      }

      // Verify persistent DB/store invalidation for Match, Conversation, Calls (active+pending), Games, VirtualDates, and RelationshipSpace
      const matchRow = h.matches.find((m) => m.id === matchId);
      assert.strictEqual(matchRow.status, 'ended', `${trig.kind} must end Match`);
      if ('expectedReason' in trig) {
        assert.strictEqual(matchRow.endReason, trig.expectedReason);
      } else {
        assert.ok(matchRow.endReason.startsWith(trig.expectedReasonPrefix));
      }

      const convRow = h.conversations.find((c) => c.id === conversationId);
      assert.strictEqual(convRow.status, 'closed', `${trig.kind} must close Conversation`);

      const callRow = h.callSessions.find((s) => s.id === activeCall.callSession.id);
      assert.strictEqual(callRow.callStatus, 'ended', `${trig.kind} must end CallSession`);

      const gameRow = h.gameSessions.find((g) => g.id === game.id);
      assert.strictEqual(gameRow.sessionStatus, 'ended', `${trig.kind} must end GameSession`);

      const dateRow = h.virtualDates.find((d) => d.id === vDate.id);
      assert.strictEqual(dateRow.status, 'cancelled', `${trig.kind} must cancel VirtualDate`);

      const spaceRow = h.relationshipSpaces.find((s) => s.matchId === matchId);
      assert.strictEqual(spaceRow.isActive, false, `${trig.kind} must deactivate RelationshipSpace`);

      // Verify subsequent HTTP/service actions fail closed cleanly for BOTH owner and peer
      for (const deniedOp of [
        () => h.messaging.sendMessage(uOwner.accountId, conversationId, { bodyText: 'After' }),
        () => h.calling.getCallSession(uOwner.accountId, activeCall.callSession.id),
        () => h.calling.issueJoinToken(uOwner.accountId, activeCall.callSession.id),
        () => h.calling.inviteCall(uOwner.accountId, { conversationId }),
        () => h.messaging.presignVoiceNoteForConversation(uOwner.accountId, conversationId, {
          filename: 'after.webm',
          mimeType: 'audio/webm',
          durationSeconds: 5,
        }),
        () => h.together.submitMove(uOwner.accountId, game.id, { moveType: 'guess_word', moveData: { guess: 'ALGORITHM' } }),
        () => h.together.getGameSession(uOwner.accountId, game.id),
        () => h.together.createMilestone(uOwner.accountId, matchId, { title: 'M', milestoneDate: '2026-11-25' }),
        () => h.together.createJournalEntry(uOwner.accountId, matchId, { entryText: 'J', entryDate: '2026-11-25' }),
        () => h.dating.sendLike(uOwner.accountId, { targetProfileId: uPeer.profileId }),
      ]) {
        await assert.rejects(
          deniedOp,
          (e: any) => e.status === 403 && !e.message.includes('CONFIDENTIAL_MOD_AUDIT_NOTE'),
          `${trig.kind} failed to block subsequent operation cleanly`,
        );
      }
    }
  });

  test('Controllers extract authenticated user from JWT req.user.sub cleanly', async () => {
    const mockCallingSvc: any = {
      inviteCall: async (uid: string, dto: any) => ({ uid, dto }),
    };
    const mockTogetherSvc: any = {
      inviteGame: async (uid: string, dto: any) => ({ uid, dto }),
      leaveRelationship: async (uid: string, dto: any) => ({ uid, dto }),
    };
    const cc = new CallingController(mockCallingSvc);
    const tc = new TogetherController(mockTogetherSvc);

    const callRes: any = await cc.inviteCall({ user: { sub: uuid(55) } }, { conversationId: 'conv-1' });
    assert.strictEqual(callRes.uid, uuid(55));
    const gameRes: any = await tc.inviteGame({ user: { sub: uuid(56) } }, { conversationId: 'conv-1', gameKey: 'word_scramble' });
    assert.strictEqual(gameRes.uid, uuid(56));
    const leaveRes: any = await tc.leaveRelationship({ user: { sub: uuid(57) } }, { matchId: 'm-1' });
    assert.strictEqual(leaveRes.uid, uuid(57));
  });

  test('HEIC fail-closed & runtime MIME allowlist when FFmpeg/HEVC is unavailable, plus R2_FORCE_PATH_STYLE guard', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevFfmpeg = process.env.FFMPEG_PATH;
    const prevDisableHeic = process.env.DISABLE_HEIC_UPLOAD;
    const prevPathStyle = process.env.R2_FORCE_PATH_STYLE;
    const prevBucket = process.env.R2_BUCKET_NAME;
    const prevKey = process.env.R2_ACCESS_KEY_ID;
    const prevSec = process.env.R2_SECRET_ACCESS_KEY;
    const prevEndpoint = process.env.R2_ENDPOINT;

    // Synthesize genuine still HEIC header/payload using system ffmpeg if installed to confirm fail-closed when FFMPEG_PATH is absent
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smn-closure-heic-'));
    try {
      let heicBytes: Buffer;
      try {
        const heicFile = path.join(tmpDir, 'sample.heic');
        execFileSync(
          'ffmpeg',
          ['-y', '-f', 'lavfi', '-i', 'color=c=0x1C2024:s=64x64', '-frames:v', '1', '-c:v', 'libx265', '-f', 'hevc', path.join(tmpDir, 'frame.265')],
          { timeout: 10000, stdio: 'ignore' },
        );
        const h265 = fs.readFileSync(path.join(tmpDir, 'frame.265'));
        heicBytes = Buffer.concat([
          Buffer.from('\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic', 'latin1'),
          Buffer.from('\x00\x00\x00\x08mdat', 'latin1'),
          h265,
        ]);
        void heicFile;
      } catch {
        heicBytes = Buffer.from('\x00\x00\x00\x18ftypheic\x00\x00\x00\x00mif1heic\x00\x00\x00\x08mdat1234', 'latin1');
      }

      // Simulate runtime WITHOUT FFmpeg/HEVC decoding
      process.env.NODE_ENV = 'production';
      process.env.FFMPEG_PATH = '/nonexistent-dir/missing-ffmpeg-bin';
      delete process.env.DISABLE_HEIC_UPLOAD;

      assert.strictEqual(doesFfmpegVersionSupportHeic('ffmpeg version 5.1.9-0+deb12u1', ' V....D hevc'), false);
      assert.strictEqual(doesFfmpegVersionSupportHeic('ffmpeg version 7.1.5-0+deb13u1', ' V....D hevc'), true);
      assert.strictEqual(doesFfmpegVersionSupportHeic('ffmpeg version 7.1.5-0+deb13u1', ' V....D h264'), false);

      assert.strictEqual(isHeicDecodingSupported(), false);
      const allowed = getAllowedImageMimes();
      assert.deepStrictEqual(allowed, ['image/jpeg', 'image/png', 'image/webp']);

      const svc = new ProfilesService({} as any);
      await assert.rejects(
        () => svc.presignPhoto(uuid(1), { filename: 'iphone.heic', mimeType: 'image/heic', fileSizeBytes: 1024 }),
        (e: any) => e.status === 400 && !e.message.includes('HEIC'),
      );
      await assert.rejects(
        () => verifyAndSanitizeR2Image(heicBytes, 'image/heic'),
        (e: any) => e.status === 400,
      );

      // Explicit R2 Cloudflare host must NEVER enable forcePathStyle even if R2_FORCE_PATH_STYLE='true'
      process.env.R2_BUCKET_NAME = 'private-bucket';
      process.env.R2_ACCESS_KEY_ID = 'test-key';
      process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
      process.env.R2_ENDPOINT = 'https://acct123.r2.cloudflarestorage.com';
      process.env.R2_FORCE_PATH_STYLE = 'true';
      const prodR2 = (svc as any).createR2Client();
      assert.strictEqual(Boolean(prodR2?.client?.config?.forcePathStyle), false);

      // Local non-R2 explicit endpoint DOES permit path-style when opted in
      process.env.R2_ENDPOINT = 'http://127.0.0.1:9009';
      const localS3 = (svc as any).createR2Client();
      assert.strictEqual(localS3?.client?.config?.forcePathStyle, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      process.env.NODE_ENV = prevNodeEnv;
      if (prevFfmpeg === undefined) delete process.env.FFMPEG_PATH;
      else process.env.FFMPEG_PATH = prevFfmpeg;
      if (prevDisableHeic === undefined) delete process.env.DISABLE_HEIC_UPLOAD;
      else process.env.DISABLE_HEIC_UPLOAD = prevDisableHeic;
      if (prevPathStyle === undefined) delete process.env.R2_FORCE_PATH_STYLE;
      else process.env.R2_FORCE_PATH_STYLE = prevPathStyle;
      if (prevBucket === undefined) delete process.env.R2_BUCKET_NAME;
      else process.env.R2_BUCKET_NAME = prevBucket;
      if (prevKey === undefined) delete process.env.R2_ACCESS_KEY_ID;
      else process.env.R2_ACCESS_KEY_ID = prevKey;
      if (prevSec === undefined) delete process.env.R2_SECRET_ACCESS_KEY;
      else process.env.R2_SECRET_ACCESS_KEY = prevSec;
      if (prevEndpoint === undefined) delete process.env.R2_ENDPOINT;
      else process.env.R2_ENDPOINT = prevEndpoint;
    }
  });

  test('DOB integrity: missing DOB forces AGE_VERIFICATION while existing verified DOB remains unaffected', () => {
    const identity = new IdentityService({} as any, new CryptoService(), {} as any);
    const liveProfile = { isPublished: true, profileStatus: 'live', publishedAt: new Date() };
    const missingDob = identity.computeLifecycleState(
      { accountStatus: 'active', emailVerifiedAt: new Date(), deletedAt: null },
      { ageStatus: 'approved', studentStatus: 'approved', discoveryEligible: true, dateOfBirth: null },
      liveProfile,
    );
    assert.strictEqual(missingDob, AccountLifecycleState.AGE_VERIFICATION);

    const validDob = identity.computeLifecycleState(
      { accountStatus: 'active', emailVerifiedAt: new Date(), deletedAt: null },
      {
        ageStatus: 'approved',
        studentStatus: 'approved',
        discoveryEligible: true,
        dateOfBirth: new Date(Date.UTC(2002, 5, 10)),
      },
      liveProfile,
    );
    assert.strictEqual(validDob, AccountLifecycleState.ACTIVE_MEMBER);
  });
});
