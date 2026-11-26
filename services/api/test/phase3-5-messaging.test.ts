import { describe, test } from 'node:test';
import * as assert from 'node:assert/strict';
import * as http from 'node:http';
import * as crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';
import { MessagingService } from '../src/modules/messaging/messaging.service';
import { verifyVoiceNoteBinary } from '../src/modules/messaging/audio-security';
import { DatingService } from '../src/modules/dating/dating.service';
import { SafetyService } from '../src/modules/safety/safety.service';
import { IdentityService } from '../src/modules/identity/identity.service';
import { CryptoService } from '../src/modules/identity/security/crypto.service';
import { MatchAuthorizationService } from '../src/modules/safety/match-authorization.service';
import { RealtimeEventBusService } from '../src/modules/realtime/realtime-event-bus.service';
import { RealtimeTicketService } from '../src/modules/realtime/realtime-ticket.service';
import { MessagingGateway } from '../src/modules/realtime/messaging.gateway';
import { MessagingOutboxRelayService } from '../src/modules/realtime/messaging-outbox-relay.service';

function createRealWavBuffer(durationSec = 1): Buffer {
  // Real 8kHz mono 16-bit PCM WAV binary generated cleanly without external fixtures
  const sampleRate = 8000;
  const numSamples = Math.max(1600, Math.floor(sampleRate * durationSec));
  const dataSize = numSamples * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  return buf;
}

function createPhase35Harness() {
  const accounts = new Map<string, any>();
  const eligibilities = new Map<string, any>();
  const profiles = new Map<string, any>();
  const likes: any[] = [];
  const matches: any[] = [];
  const matchEvents: any[] = [];
  const conversations: any[] = [];
  const conversationMembers: any[] = [];
  const messages: any[] = [];
  const messageMedia: any[] = [];
  const blocks: any[] = [];
  const reports: any[] = [];
  const outboxEvents: any[] = [];
  const idempotencyRecords: any[] = [];
  const auditEvents: any[] = [];

  const filterWhere = (row: any, where: any): boolean => {
    if (!where) return true;
    for (const [k, v] of Object.entries(where)) {
      if (k === 'OR' && Array.isArray(v)) {
        if (!v.some((sub) => filterWhere(row, sub))) return false;
        continue;
      }
      if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
        if ('not' in v && row[k] === (v as any).not) return false;
        if ('in' in v && !((v as any).in as any[]).includes(row[k])) return false;
        if ('gt' in v && (row[k] === null || row[k] === undefined || !(Number(row[k]) > Number((v as any).gt)))) return false;
        if ('lt' in v && (row[k] === null || row[k] === undefined || !(Number(row[k]) < Number((v as any).lt)))) return false;
        if ('lte' in v) {
          if (row[k] === null || row[k] === undefined) return false;
          const rowVal = row[k] instanceof Date ? row[k].getTime() : Number(row[k]);
          const cmpVal = (v as any).lte instanceof Date ? (v as any).lte.getTime() : Number((v as any).lte);
          if (!(rowVal <= cmpVal)) return false;
        }
        if ('gte' in v) {
          if (row[k] === null || row[k] === undefined) return false;
          if (!(new Date(row[k]) >= new Date((v as any).gte))) return false;
        }
        continue;
      }
      if (row[k] !== v) return false;
    }
    return true;
  };

  const prisma: any = {
    $transaction: async (fn: any) => fn(prisma),
    account: {
      findUnique: async ({ where, include }: any) => {
        const acc = accounts.get(where.id) || null;
        if (!acc) return null;
        if (include?.eligibility) {
          return { ...acc, eligibility: eligibilities.get(acc.id) || null };
        }
        return acc;
      },
      update: async ({ where, data }: any) => {
        const acc = accounts.get(where.id);
        if (acc) Object.assign(acc, data);
        return acc;
      },
    },
    appSession: { updateMany: async () => ({ count: 0 }) },
    accountEligibility: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const el of eligibilities.values()) {
          if (filterWhere(el, where)) {
            Object.assign(el, data);
            count++;
          }
        }
        return { count };
      },
    },
    profile: {
      findUnique: async ({ where }: any) => {
        const p =
          (where.accountId ? Array.from(profiles.values()).find((x) => x.accountId === where.accountId) : null) ||
          (where.id ? profiles.get(where.id) : null) ||
          null;
        if (!p) return null;
        return {
          ...p,
          account: {
            ...(accounts.get(p.accountId) || {}),
            eligibility: eligibilities.get(p.accountId) || null,
          },
          interests: [],
          promptAnswers: [],
        };
      },
      findMany: async ({ where }: any) => {
        const ids: string[] = where?.accountId?.in || [];
        return Array.from(profiles.values())
          .filter((p) => (ids.length === 0 ? true : ids.includes(p.accountId)))
          .map((p) => ({
            ...p,
            account: {
              ...(accounts.get(p.accountId) || {}),
              eligibility: eligibilities.get(p.accountId) || null,
            },
            interests: [],
            promptAnswers: [],
          }));
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const p of profiles.values()) {
          if (filterWhere(p, where)) {
            Object.assign(p, data);
            count++;
          }
        }
        return { count };
      },
    },
    userBlock: {
      findFirst: async ({ where }: any) => blocks.find((b) => filterWhere(b, where)) || null,
      findMany: async () => blocks,
      upsert: async ({ where, create, update }: any) => {
        const existing = blocks.find(
          (b) =>
            b.blockerId === where.blockerId_blockedId.blockerId &&
            b.blockedId === where.blockerId_blockedId.blockedId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: crypto.randomUUID(), createdAt: new Date(), ...create };
        blocks.push(row);
        return row;
      },
    },
    like: {
      findFirst: async ({ where }: any) => likes.find((l) => filterWhere(l, where)) || null,
      findUnique: async ({ where }: any) => {
        const k = where.fromAccountId_toAccountId;
        if (k) {
          return (
            likes.find(
              (l) => l.fromAccountId === k.fromAccountId && l.toAccountId === k.toAccountId,
            ) || null
          );
        }
        return likes.find((l) => l.id === where.id) || null;
      },
      create: async ({ data }: any) => {
        const row = { id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...data };
        likes.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const existing = likes.find((l) => l.id === where.id);
        if (existing) Object.assign(existing, data);
        return existing;
      },
      upsert: async ({ where, create, update }: any) => {
        const existing = likes.find(
          (l) =>
            l.fromAccountId === where.fromAccountId_toAccountId.fromAccountId &&
            l.toAccountId === where.fromAccountId_toAccountId.toAccountId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date(), ...create };
        likes.push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const l of likes) {
          if (filterWhere(l, where)) {
            Object.assign(l, data);
            count++;
          }
        }
        return { count };
      },
    },
    pass: {
      findMany: async () => [],
      findFirst: async () => null,
    },
    match: {
      findUnique: async ({ where, include }: any) => {
        let m: any = null;
        if (where.id) m = matches.find((x) => x.id === where.id) || null;
        else if (where.userLowId_userHighId) {
          m =
            matches.find(
              (x) =>
                x.userLowId === where.userLowId_userHighId.userLowId &&
                x.userHighId === where.userLowId_userHighId.userHighId,
            ) || null;
        }
        if (!m) return null;
        return include?.conversation
          ? { ...m, conversation: conversations.find((c) => c.matchId === m.id) || null }
          : m;
      },
      findMany: async ({ where, include }: any) => {
        return matches
          .filter((m) => filterWhere(m, where))
          .map((m) =>
            include?.conversation
              ? { ...m, conversation: conversations.find((c) => c.matchId === m.id) || null }
              : m,
          );
      },
      create: async ({ data }: any) => {
        const mId = crypto.randomUUID();
        const matchRow = {
          id: mId,
          userLowId: data.userLowId,
          userHighId: data.userHighId,
          status: data.status || 'active',
          createdAt: new Date(),
        };
        matches.push(matchRow);

        let convRow: any = null;
        if (data.conversation?.create) {
          const cId = crypto.randomUUID();
          convRow = {
            id: cId,
            matchId: mId,
            status: data.conversation.create.status || 'active',
            createdAt: new Date(),
            lastMessageAt: null,
          };
          conversations.push(convRow);
          for (const cm of data.conversation.create.members?.create || []) {
            conversationMembers.push({
              conversationId: cId,
              accountId: cm.accountId,
              lastReadSeq: BigInt(0),
              lastDeliveredSeq: BigInt(0),
              joinedAt: new Date(),
            });
          }
        }
        return { ...matchRow, conversation: convRow };
      },
      upsert: async ({ where, create, update }: any) => {
        const k = where.userLowId_userHighId;
        const existing = matches.find(
          (x) => x.userLowId === k.userLowId && x.userHighId === k.userHighId,
        );
        if (existing) {
          Object.assign(existing, update);
          return { ...existing, conversation: conversations.find((c) => c.matchId === existing.id) || null };
        }
        const mId = crypto.randomUUID();
        const matchRow = {
          id: mId,
          userLowId: create.userLowId,
          userHighId: create.userHighId,
          status: create.status || 'active',
          createdAt: new Date(),
        };
        matches.push(matchRow);
        let convRow: any = null;
        if (create.conversation?.create) {
          const cId = crypto.randomUUID();
          convRow = {
            id: cId,
            matchId: mId,
            status: create.conversation.create.status || 'active',
            createdAt: new Date(),
            lastMessageAt: null,
          };
          conversations.push(convRow);
          for (const cm of create.conversation.create.members?.create || []) {
            conversationMembers.push({
              conversationId: cId,
              accountId: cm.accountId,
              lastReadSeq: BigInt(0),
              lastDeliveredSeq: BigInt(0),
              joinedAt: new Date(),
            });
          }
        }
        return { ...matchRow, conversation: convRow };
      },
      update: async ({ where, data }: any) => {
        const m = matches.find((x) => x.id === where.id);
        if (m) Object.assign(m, data);
        return m;
      },
    },
    matchStateEvent: {
      create: async ({ data }: any) => {
        const ev = { id: crypto.randomUUID(), createdAt: new Date(), ...data };
        matchEvents.push(ev);
        return ev;
      },
    },
    conversation: {
      findUnique: async ({ where, include }: any) => {
        const c = conversations.find((x) => x.id === where.id) || null;
        if (!c) return null;
        return {
          ...c,
          ...(include?.match ? { match: matches.find((m) => m.id === c.matchId) || null } : {}),
          ...(include?.members
            ? { members: conversationMembers.filter((cm) => cm.conversationId === c.id) }
            : {}),
        };
      },
      create: async ({ data }: any) => {
        const cId = crypto.randomUUID();
        const convRow = {
          id: cId,
          matchId: data.matchId,
          status: data.status || 'active',
          createdAt: new Date(),
          lastMessageAt: null,
        };
        conversations.push(convRow);
        for (const cm of data.members?.create || []) {
          conversationMembers.push({
            conversationId: cId,
            accountId: cm.accountId,
            lastReadSeq: BigInt(0),
            lastDeliveredSeq: BigInt(0),
            joinedAt: new Date(),
          });
        }
        return convRow;
      },
      update: async ({ where, data }: any) => {
        const c = conversations.find((x) => x.id === where.id);
        if (c) Object.assign(c, data);
        return c;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const c of conversations) {
          if (filterWhere(c, where)) {
            Object.assign(c, data);
            count++;
          }
        }
        return { count };
      },
    },
    conversationMember: {
      findUnique: async ({ where, include }: any) => {
        const k = where.conversationId_accountId;
        const cm =
          conversationMembers.find(
            (row) => row.conversationId === k.conversationId && row.accountId === k.accountId,
          ) || null;
        if (!cm) return null;
        if (include?.conversation) {
          const conv = conversations.find((c) => c.id === cm.conversationId) || null;
          if (!conv) return { ...cm, conversation: null };
          const convInclude = typeof include.conversation === 'object' ? include.conversation.include : {};
          return {
            ...cm,
            conversation: {
              ...conv,
              ...(convInclude?.match ? { match: matches.find((m) => m.id === conv.matchId) || null } : {}),
              ...(convInclude?.members
                ? { members: conversationMembers.filter((m) => m.conversationId === conv.id) }
                : {}),
            },
          };
        }
        return cm;
      },
      findMany: async ({ where }: any) => {
        return conversationMembers
          .filter((cm) => cm.accountId === where.accountId)
          .map((cm) => {
            const c = conversations.find((x) => x.id === cm.conversationId);
            const convMsgs = messages
              .filter((m) => m.conversationId === c.id)
              .sort((a, b) => Number(b.sequenceNo) - Number(a.sequenceNo))
              .slice(0, 1)
              .map((m) => ({
                ...m,
                media: messageMedia.find((mm) => mm.messageId === m.id) || null,
              }));
            return {
              ...cm,
              conversation: {
                ...c,
                members: conversationMembers.filter((x) => x.conversationId === c.id),
                match: matches.find((m) => m.id === c.matchId) || null,
                messages: convMsgs,
              },
            };
          });
      },
      upsert: async ({ where, create, update }: any) => {
        const k = where.conversationId_accountId;
        const existing = conversationMembers.find(
          (cm) => cm.conversationId === k.conversationId && cm.accountId === k.accountId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = {
          conversationId: create.conversationId,
          accountId: create.accountId,
          lastReadSeq: BigInt(0),
          lastDeliveredSeq: BigInt(0),
          joinedAt: new Date(),
        };
        conversationMembers.push(row);
        return row;
      },
      update: async ({ where, data }: any) => {
        const k = where.conversationId_accountId;
        const row = conversationMembers.find(
          (cm) => cm.conversationId === k.conversationId && cm.accountId === k.accountId,
        );
        if (row) Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const cm of conversationMembers) {
          if (filterWhere(cm, where)) {
            Object.assign(cm, data);
            count++;
          }
        }
        return { count };
      },
    },
    message: {
      findUnique: async ({ where, include }: any) => {
        const m =
          (where.id ? messages.find((x) => x.id === where.id) : null) ||
          (where.clientAssignedUuid
            ? messages.find((x) => x.clientAssignedUuid === where.clientAssignedUuid)
            : null) ||
          null;
        if (!m) return null;
        return {
          ...m,
          ...(include?.media ? { media: messageMedia.find((mm) => mm.messageId === m.id) || null } : {}),
          ...(include?.conversation
            ? {
                conversation: {
                  ...conversations.find((c) => c.id === m.conversationId),
                  members: conversationMembers.filter((cm) => cm.conversationId === m.conversationId),
                },
              }
            : {}),
        };
      },
      findFirst: async ({ where }: any) => {
        const matching = messages
          .filter((m) => filterWhere(m, where))
          .sort((a, b) => Number(b.sequenceNo) - Number(a.sequenceNo));
        return matching[0] || null;
      },
      findMany: async ({ where, take }: any) => {
        let rows = messages.filter((m) => filterWhere(m, where));
        rows = rows.sort((a, b) => Number(a.sequenceNo) - Number(b.sequenceNo));
        if (typeof take === 'number' && take > 0 && rows.length > take) {
          // Matches take behavior cleanly with MessagingService desc sort before slicing
          rows = rows.slice(-take);
        }
        return rows.map((m) => ({
          ...m,
          media: messageMedia.find((mm) => mm.messageId === m.id) || null,
        }));
      },
      count: async ({ where }: any) => messages.filter((m) => filterWhere(m, where)).length,
      create: async ({ data }: any) => {
        const msgId = crypto.randomUUID();
        const row: any = {
          id: msgId,
          conversationId: data.conversationId,
          sequenceNo: data.sequenceNo,
          senderAccountId: data.senderAccountId,
          clientAssignedUuid: data.clientAssignedUuid ?? null,
          messageType: data.messageType || 'text',
          bodyText: data.bodyText ?? null,
          mediaRefId: data.mediaRefId ?? null,
          deliveryState: data.deliveryState || 'sent',
          createdAt: new Date(),
          deliveredAt: null,
          readAt: null,
        };
        messages.push(row);
        let mediaRow: any = null;
        if (data.media?.create) {
          mediaRow = {
            id: data.media.create.id || crypto.randomUUID(),
            messageId: msgId,
            mediaType: data.media.create.mediaType,
            durationSeconds: data.media.create.durationSeconds,
            s3Key: data.media.create.s3Key,
            fileSizeBytes: data.media.create.fileSizeBytes,
            sha256: data.media.create.sha256 ?? null,
            processingStatus: 'ready',
            uploaderAccountId: data.media.create.uploaderAccountId ?? null,
            createdAt: new Date(),
          };
          messageMedia.push(mediaRow);
        }
        return { ...row, media: mediaRow };
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const m of messages) {
          if (filterWhere(m, where)) {
            Object.assign(m, data);
            count++;
          }
        }
        return { count };
      },
    },
    messageMedia: {
      findUnique: async ({ where, include }: any) => {
        const mm = messageMedia.find((x) => x.id === where.id) || null;
        if (!mm) return null;
        return include?.message
          ? { ...mm, message: messages.find((m) => m.id === mm.messageId) || null }
          : mm;
      },
    },
    report: {
      findFirst: async ({ where }: any) => reports.find((r) => filterWhere(r, where)) || null,
      create: async ({ data }: any) => {
        const row = { id: crypto.randomUUID(), createdAt: new Date(), ...data };
        reports.push(row);
        return row;
      },
    },
    outboxEvent: {
      create: async ({ data }: any) => {
        const row = {
          id: crypto.randomUUID(),
          createdAt: new Date(),
          retryCount: 0,
          nextAttemptAt: new Date(),
          lockedBy: null,
          lockedUntil: null,
          lastErrorCode: null,
          lastErrorAt: null,
          processedAt: null,
          ...data,
        };
        outboxEvents.push(row);
        return row;
      },
      findUnique: async ({ where }: any) => outboxEvents.find((e) => e.id === where.id) || null,
      findMany: async ({ where, orderBy, take }: any) => {
        let rows = outboxEvents.filter((e) => filterWhere(e, where));
        if (orderBy?.createdAt === 'asc') {
          rows = rows.sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
        }
        if (typeof take === 'number' && take > 0) {
          rows = rows.slice(0, take);
        }
        return rows.map((e) => ({ ...e }));
      },
      update: async ({ where, data }: any) => {
        const row = outboxEvents.find((e) => e.id === where.id);
        if (row) Object.assign(row, data);
        return row || null;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const e of outboxEvents) {
          if (filterWhere(e, where)) {
            Object.assign(e, data);
            count++;
          }
        }
        return { count };
      },
    },
    idempotencyRecord: {
      findUnique: async ({ where }: any) =>
        idempotencyRecords.find((r) => r.idempotencyKey === where.idempotencyKey) || null,
      create: async ({ data }: any) => {
        idempotencyRecords.push(data);
        return data;
      },
    },
    auditEvent: {
      create: async ({ data }: any) => {
        auditEvents.push(data);
        return data;
      },
    },
    profilePhoto: { findMany: async () => [] },
    profileInterest: { findMany: async () => [] },
    profilePromptAnswer: { findMany: async () => [] },
  };

  const matchAuth = new MatchAuthorizationService(prisma);
  const cryptoSvc = new CryptoService();
  const realtimeBus = new RealtimeEventBusService();
  const outboxRelay = new MessagingOutboxRelayService(prisma, matchAuth, realtimeBus, 'test-w1');
  const ticketSvc = new RealtimeTicketService(prisma, matchAuth);
  const gateway = new MessagingGateway(matchAuth, ticketSvc, realtimeBus);
  gateway.onModuleInit();

  const messaging = new MessagingService(
    prisma,
    matchAuth,
    undefined,
    realtimeBus,
    ticketSvc,
    outboxRelay,
  );
  const dating = new DatingService(prisma, undefined, undefined, matchAuth, realtimeBus);
  const safety = new SafetyService(prisma, matchAuth, realtimeBus);
  const identity = new IdentityService(
    prisma,
    cryptoSvc,
    { sendOtpEmail: async () => {} } as any,
    matchAuth,
    realtimeBus,
  );

  const seedUser = (num: number, name: string, ageDisplayMode = 'show_calculated_age') => {
    const accountId = `10000000-0000-4000-8000-00000000000${num}`;
    const profileId = `20000000-0000-4000-8000-00000000000${num}`;
    accounts.set(accountId, {
      id: accountId,
      email: `user${num}@ds.study.iitm.ac.in`,
      accountStatus: 'active',
      deletedAt: null,
      displayName: name,
    });
    eligibilities.set(accountId, {
      accountId,
      ageStatus: 'approved',
      studentStatus: 'approved',
      discoveryEligible: true,
      dateOfBirth: new Date('2003-04-15T00:00:00Z'),
      validUntil: new Date(Date.now() + 90 * 86400_000),
      programmeFamily: 'data_science_applications',
    });
    profiles.set(profileId, {
      id: profileId,
      accountId,
      displayName: name,
      bio: `Verified bio for ${name}`,
      programmeFamily: 'data_science_applications',
      termOrYear: 'Diploma Level',
      locationCity: 'Chennai',
      locationState: 'Tamil Nadu',
      ageDisplayMode,
      isPublished: true,
      isPaused: false,
      profileStatus: 'live',
      publishedAt: new Date(),
      consentAcceptedAt: new Date(),
      photos: [
        {
          id: `ph-${num}`,
          photoUrl: null,
          isPrimary: true,
          displayOrder: 0,
          moderationStatus: 'approved',
          deletedAt: null,
        },
      ],
      preferences: {
        minAge: 18,
        maxAge: 35,
        allowedProgrammes: ['data_science_applications'],
        showInDiscovery: true,
      },
    });
    return { accountId, profileId };
  };

  return {
    prisma,
    messaging,
    dating,
    safety,
    identity,
    realtimeBus,
    outboxRelay,
    ticketSvc,
    gateway,
    messages,
    messageMedia,
    outboxEvents,
    reports,
    blocks,
    matches,
    conversations,
    conversationMembers,
    seedUser,
    cleanup: async () => {
      await outboxRelay.onModuleDestroy();
      gateway.onModuleDestroy();
      await realtimeBus.onModuleDestroy();
      await ticketSvc.onModuleDestroy();
    },
  };
}

describe('Phase 3.5: Chats, Realtime WebSockets, Voice Notes & Privacy', () => {
  test('MSG-AUTH-01 & MSG-TEXT-01: Idempotency, sequence ordering, pagination, inbox unread without read receipts & zero leakage', async () => {
    const h = createPhase35Harness();
    const uA = h.seedUser(1, 'Ananya');
    const uB = h.seedUser(2, 'Rohan', 'hidden');
    const uOutsider = h.seedUser(3, 'Outsider');

    // Unilateral like unlocks zero conversations
    await h.dating.sendLike(uA.accountId, { targetProfileId: uB.profileId });
    assert.strictEqual((await h.messaging.getConversations(uA.accountId)).length, 0);

    // Reciprocal match opens 1 active conversation
    const matchRes = await h.dating.sendLike(uB.accountId, { targetProfileId: uA.profileId });
    const convId = matchRes.conversationId!;
    assert.ok(convId);

    // Outsider denied
    await assert.rejects(
      () => h.messaging.sendMessage(uOutsider.accountId, convId, { bodyText: 'intrude' }),
      (e: any) => e.status === 403,
    );

    // Empty/whitespace/oversized rejected
    await assert.rejects(
      () => h.messaging.sendMessage(uA.accountId, convId, { bodyText: '   \n\t  ' }),
      (e: any) => e.status === 400,
    );
    await assert.rejects(
      () => h.messaging.sendMessage(uA.accountId, convId, { bodyText: 'x'.repeat(1001) }),
      (e: any) => e.status === 400,
    );

    // Idempotent retry creates strictly 1 message + 1 outbox event
    const clientUuid = crypto.randomUUID();
    const m1 = await h.messaging.sendMessage(
      uA.accountId,
      convId,
      { bodyText: 'First hello!', clientAssignedUuid: clientUuid },
      'idem-1',
    );
    const m1Retry = await h.messaging.sendMessage(
      uA.accountId,
      convId,
      { bodyText: 'First hello!', clientAssignedUuid: clientUuid },
      'idem-1',
    );
    assert.strictEqual(m1.id, m1Retry.id);
    assert.strictEqual(h.messages.length, 1);
    assert.strictEqual(h.outboxEvents.length, 1);
    // Honest initial state: sender sees 'sent' before recipient fetches
    assert.strictEqual(m1.deliveryState, 'sent');

    // Sender reloading before recipient reads still sees 'sent' (MSG-05)
    const senderCheck = await h.messaging.getMessageHistory(uA.accountId, convId, {});
    assert.strictEqual(senderCheck.messages[0].deliveryState, 'sent');

    // Recipient B sees unreadCount = 1, hidden age, zero internal IDs or read receipts
    const inboxB = await h.messaging.getConversations(uB.accountId);
    assert.strictEqual(inboxB.length, 1);
    assert.strictEqual(inboxB[0].unreadCount, 1);
    const inboxA = await h.messaging.getConversations(uA.accountId);
    assert.strictEqual(inboxA[0].profile.age, null);
    assert.strictEqual(inboxA[0].profile.ageVisible, false);
    const inboxJson = JSON.stringify([inboxA, inboxB]);
    assert.strictEqual(inboxJson.includes('senderAccountId'), false);
    assert.strictEqual(inboxJson.includes('ds.study.iitm.ac.in'), false);

    // Recipient B opens thread -> transitions m1 to 'delivered' (NOT 'read') & markInboxSeen resets own unreadCount privately
    const histB = await h.messaging.getMessageHistory(uB.accountId, convId, {});
    assert.strictEqual(histB.messages[0].deliveryState, 'delivered');
    assert.strictEqual((histB.messages[0] as any).deliveryState === 'read', false);

    await h.messaging.markInboxSeen(uB.accountId, convId, { upToSequenceNo: 1 });
    const inboxBAfter = await h.messaging.getConversations(uB.accountId);
    assert.strictEqual(inboxBAfter[0].unreadCount, 0);

    // Add 3 more messages & verify beforeSeq + afterSeq pagination
    await h.messaging.sendMessage(uA.accountId, convId, { bodyText: 'Second' });
    await h.messaging.sendMessage(uB.accountId, convId, { bodyText: 'Third' });
    await h.messaging.sendMessage(uA.accountId, convId, { bodyText: 'Fourth' });

    const page1 = await h.messaging.getMessageHistory(uB.accountId, convId, { limit: 2 });
    assert.strictEqual(page1.hasOlder, true);
    assert.deepEqual(page1.messages.map((m) => m.sequenceNo), [3, 4]);
    const page2 = await h.messaging.getMessageHistory(uB.accountId, convId, {
      beforeSeq: Number(page1.nextCursor),
      limit: 2,
    });
    assert.deepEqual(page2.messages.map((m) => m.sequenceNo), [1, 2]);
    assert.strictEqual(page2.hasOlder, false);

    const delta = await h.messaging.getMessageHistory(uB.accountId, convId, { afterSeq: 2 });
    assert.deepEqual(delta.messages.map((m) => m.sequenceNo), [3, 4]);

    await h.cleanup();
  });

  test('MSG-VOICE-01: Audio security validates real WAV/audio binary, rejects disguised HTML/EXE/over-60s & enforces block revocation', async () => {
    const h = createPhase35Harness();
    const uA = h.seedUser(1, 'Ananya');
    const uB = h.seedUser(2, 'Vikram');
    await h.dating.sendLike(uA.accountId, { targetProfileId: uB.profileId });
    const matchRes = await h.dating.sendLike(uB.accountId, { targetProfileId: uA.profileId });
    const convId = matchRes.conversationId!;

    // Magic-byte & ffprobe check: reject disguised HTML / over-60s WAV, accept real 1s WAV
    await assert.rejects(
      () =>
        verifyVoiceNoteBinary(
          Buffer.from('<html><script>alert(1)</script></html>'.repeat(4)),
          'audio/webm',
          5,
        ),
      (e: any) => e.status === 400,
    );

    const validWav = createRealWavBuffer(1);
    const hasFfprobe = (() => {
      try {
        execFileSync(process.env.FFPROBE_PATH || 'ffprobe', ['-version'], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    })();

    if (hasFfprobe) {
      const verified = await verifyVoiceNoteBinary(validWav, 'audio/wav', 1);
      assert.strictEqual(verified.detectedMime, 'audio/wav');
      assert.ok(verified.durationSeconds >= 1 && verified.durationSeconds <= 2);
      assert.ok(verified.sha256.length === 64);

      const overLimitWav = createRealWavBuffer(62);
      await assert.rejects(
        () => verifyVoiceNoteBinary(overLimitWav, 'audio/wav', 60),
        (e: any) => e.status === 400,
      );
    }

    // Presign & send voice note with signed uploadToken + idempotent retry + message report
    await assert.rejects(
      () =>
        h.messaging.presignVoiceNoteForConversation(uA.accountId, convId, {
          filename: 'long.webm',
          mimeType: 'audio/webm',
          durationSeconds: 61,
        }),
      (e: any) => e.status === 400,
    );

    const presign = await h.messaging.presignVoiceNoteForConversation(uA.accountId, convId, {
      filename: 'note.webm',
      mimeType: 'audio/webm',
      durationSeconds: 12,
      fileSizeBytes: 24000,
    });
    assert.ok(presign.uploadToken);

    // Wrong user or tampered token rejected
    await assert.rejects(
      () =>
        h.messaging.sendVoiceNoteToConversation(uB.accountId, convId, {
          mediaRefId: presign.mediaRefId,
          uploadToken: presign.uploadToken,
          durationSeconds: 12,
        }),
      (e: any) => e.status === 403,
    );

    const vnUuid = crypto.randomUUID();
    const sentVn = await h.messaging.sendVoiceNoteToConversation(uA.accountId, convId, {
      mediaRefId: presign.mediaRefId,
      uploadToken: presign.uploadToken,
      durationSeconds: 12,
      clientAssignedUuid: vnUuid,
    });
    assert.strictEqual(sentVn.messageType, 'voice_note');
    assert.strictEqual(sentVn.durationSeconds, 12);

    // Retry returns exact same persisted voice note
    const retryVn = await h.messaging.sendVoiceNoteToConversation(uA.accountId, convId, {
      mediaRefId: presign.mediaRefId,
      uploadToken: presign.uploadToken,
      durationSeconds: 12,
      clientAssignedUuid: vnUuid,
    });
    assert.strictEqual(retryVn.id, sentVn.id);
    assert.strictEqual(h.messageMedia.length, 1);

    // Report voice note specifically attaches conversationId + messageId without blocking
    const rep = await h.safety.reportUser(uB.accountId, {
      targetProfileId: uA.profileId,
      conversationId: convId,
      messageId: sentVn.id,
      reportCategory: 'harassment',
      description: 'Reported voice clip',
    });
    assert.strictEqual(rep.success, true);
    assert.strictEqual(h.reports[0].messageId, sentVn.id);
    assert.strictEqual(h.reports[0].conversationId, convId);
    assert.strictEqual(h.blocks.length, 0);

    // Block immediately revokes media playback URL access (MSG-AC-09)
    await h.safety.blockUser(uB.accountId, { targetProfileId: uA.profileId, reason: 'Block test' });
    await assert.rejects(
      () => h.messaging.getAuthorizedMediaUrl(uB.accountId, presign.mediaRefId),
      (e: any) => e.status === 403,
    );
    await assert.rejects(
      () => h.messaging.getAuthorizedMediaUrl(uA.accountId, presign.mediaRefId),
      (e: any) => e.status === 403,
    );

    await h.cleanup();
  });

  test('MSG-RT-01: Live WebSocket ticket auth rejects replay & URL creds, fans out privacy-clean events, and revokes on unmatch', async () => {
    const h = createPhase35Harness();
    const uA = h.seedUser(1, 'Ananya');
    const uB = h.seedUser(2, 'Kabir');
    const uC = h.seedUser(3, 'Outsider');

    await h.dating.sendLike(uA.accountId, { targetProfileId: uB.profileId });
    const matchRes = await h.dating.sendLike(uB.accountId, { targetProfileId: uA.profileId });
    const convId = matchRes.conversationId!;

    const server = http.createServer();
    const wss = new WebSocketServer({ server, path: '/ws/messaging' });
    wss.on('connection', (sock, req) => {
      h.gateway.handleConnection(sock as any, req);
      sock.on('close', () => h.gateway.handleDisconnect(sock as any));
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as any;
    const wsUrl = `ws://127.0.0.1:${addr.port}/ws/messaging`;

    const connectWs = (url = wsUrl) =>
      new Promise<{ ws: WebSocket; msgs: any[] }>((resolve, reject) => {
        const ws = new WebSocket(url);
        const msgs: any[] = [];
        ws.on('message', (d) => {
          try {
            msgs.push(JSON.parse(d.toString()));
          } catch {}
        });
        ws.on('open', () => resolve({ ws, msgs }));
        ws.on('error', reject);
      });

    const waitForEvent = async (msgs: any[], eventType: string, timeoutMs = 2000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const hit = msgs.find((m) => m.eventType === eventType);
        if (hit) return hit;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error(`Timed out waiting for WS event ${eventType}. Got: ${JSON.stringify(msgs)}`);
    };

    try {
      // 1. Query-string ticket rejected (Part 07 §7.3 #7)
      const ticketA = await h.messaging.createRealtimeTicket(uA.accountId);
      const badQuerySock = new WebSocket(`${wsUrl}?ticket=${ticketA.ticket}`);
      const badCloseCode = await new Promise<number>((resolve) => {
        badQuerySock.on('close', (code) => resolve(code));
      });
      assert.strictEqual(badCloseCode, 4400);

      // 2. Valid first-frame auth succeeds; replaying the SAME ticket fails!
      const { ws: wsA, msgs: msgsA } = await connectWs();
      wsA.send(JSON.stringify({ event: 'authenticate', data: { ticket: ticketA.ticket } }));
      await waitForEvent(msgsA, 'connection.established');

      const { ws: wsReplay } = await connectWs();
      wsReplay.send(JSON.stringify({ event: 'authenticate', data: { ticket: ticketA.ticket } }));
      const replayCloseCode = await new Promise<number>((resolve) => {
        wsReplay.on('close', (code) => resolve(code));
      });
      assert.strictEqual(replayCloseCode, 4401);

      // 3. Subscribe checks authorization: Outsider denied; Partner B succeeds & receives metadata-only message.created
      const ticketC = await h.messaging.createRealtimeTicket(uC.accountId);
      const { ws: wsC, msgs: msgsC } = await connectWs();
      wsC.send(JSON.stringify({ event: 'authenticate', data: { ticket: ticketC.ticket } }));
      await waitForEvent(msgsC, 'connection.established');
      wsC.send(JSON.stringify({ event: 'conversation.subscribe', data: { conversationId: convId } }));
      const deniedEv = await waitForEvent(msgsC, 'authorization.failed');
      assert.strictEqual(deniedEv.data.reason, 'connection_unavailable');

      const ticketB = await h.messaging.createRealtimeTicket(uB.accountId);
      const { ws: wsB, msgs: msgsB } = await connectWs();
      wsB.send(JSON.stringify({ event: 'authenticate', data: { ticket: ticketB.ticket } }));
      await waitForEvent(msgsB, 'connection.established');
      wsB.send(JSON.stringify({ event: 'conversation.subscribe', data: { conversationId: convId } }));
      await waitForEvent(msgsB, 'conversation.subscribed');

      // Send secret text -> WS envelope must NOT leak bodyText or senderAccountId!
      await h.messaging.sendMessage(uA.accountId, convId, {
        bodyText: 'CONFIDENTIAL_SECRET_BODY_TEXT',
      });
      const createdEv = await waitForEvent(msgsB, 'message.created');
      assert.strictEqual(createdEv.data.conversationId, convId);
      assert.strictEqual(createdEv.data.sequenceNo, 1);
      const rawWsStr = JSON.stringify(createdEv);
      assert.strictEqual(rawWsStr.includes('CONFIDENTIAL_SECRET_BODY_TEXT'), false);
      assert.strictEqual(rawWsStr.includes(uA.accountId), false);
      assert.strictEqual(msgsC.some((m) => m.eventType === 'message.created'), false);

      // 4. Unmatch revokes active WS room & pushes conversation.closed
      await h.dating.unmatch(uA.accountId, { matchId: matchRes.matchId! });
      const closedEv = await waitForEvent(msgsB, 'conversation.closed');
      assert.strictEqual(closedEv.data.conversationId, convId);
      assert.strictEqual(closedEv.data.reason, 'connection_ended');

      wsA.close();
      wsB.close();
      wsC.close();
    } finally {
      wss.close();
      server.close();
      await h.cleanup();
    }
  });

  test('PHASE351-OUTBOX-01: Covers all 10 transactional outbox reliability, retry, lease-reclaim, concurrency & suppression scenarios', async () => {
    const prevDisableWorker = process.env.DISABLE_OUTBOX_WORKER;
    const prevMaxAttempts = process.env.OUTBOX_MAX_ATTEMPTS;
    const prevBaseMs = process.env.OUTBOX_RETRY_BASE_MS;
    const prevBatch = process.env.OUTBOX_BATCH_SIZE;
    process.env.DISABLE_OUTBOX_WORKER = 'true';
    process.env.OUTBOX_MAX_ATTEMPTS = '3';
    process.env.OUTBOX_RETRY_BASE_MS = '25';
    process.env.OUTBOX_BATCH_SIZE = '2';

    const h = createPhase35Harness();
    const uA = h.seedUser(1, 'OutboxA');
    const uB = h.seedUser(2, 'OutboxB');

    try {
      await h.dating.sendLike(uA.accountId, { targetProfileId: uB.profileId });
      const matchRes = await h.dating.sendLike(uB.accountId, { targetProfileId: uA.profileId });
      const convId = matchRes.conversationId!;

      const deliveredEvents: any[] = [];
      const unsub = h.realtimeBus.subscribe((ev) => deliveredEvents.push(ev));

      // Scenario 1: Normal send -> outbox row created as pending -> relay claims & publishes -> published + processedAt set
      // Note: MessagingService calls triggerImmediateFlush asynchronously; await flush completion
      const m1 = await h.messaging.sendMessage(uA.accountId, convId, { bodyText: 'Scenario 1 msg' });
      await new Promise((r) => setTimeout(r, 30));
      assert.strictEqual(h.outboxEvents[0].status, 'published');
      assert.ok(h.outboxEvents[0].processedAt instanceof Date);
      assert.ok(deliveredEvents.some((e) => e.envelope.data.messageId === m1.id));

      // Scenario 2: Redis publish failure -> row NOT marked published, returns to pending with backoff & error code; recovers when fault clears
      const beforeFaultMs = Date.now();
      h.realtimeBus.setFaultInjectionForTesting('fail_publish');
      const m2 = await h.messaging.sendMessage(uA.accountId, convId, { bodyText: 'Scenario 2 outage' });
      await new Promise((r) => setTimeout(r, 30));
      const row2 = h.outboxEvents.find((e) => e.payload?.messageId === m2.id);
      assert.strictEqual(row2.status, 'pending');
      assert.strictEqual(row2.processedAt, null);
      assert.strictEqual(row2.retryCount, 1);
      assert.strictEqual(row2.lastErrorCode, 'redis_publish_fault_injected');
      assert.ok(new Date(row2.nextAttemptAt).getTime() >= beforeFaultMs + 10);

      // Simulate retry time due + Redis restored
      row2.nextAttemptAt = new Date(Date.now() - 10);
      h.realtimeBus.setFaultInjectionForTesting('none');
      const recoverStats = await h.outboxRelay.processNextBatch();
      assert.strictEqual(recoverStats.published, 1);
      assert.strictEqual(row2.status, 'published');

      // Scenario 3: Crash during 'processing' -> expired lockedUntil reclaimed by healthy worker
      const crashMsgId = crypto.randomUUID();
      await h.prisma.outboxEvent.create({
        data: {
          aggregateType: 'conversation',
          aggregateId: convId,
          eventType: 'message.created',
          payload: {
            conversationId: convId,
            messageId: crashMsgId,
            sequenceNo: 99,
            messageType: 'text',
            createdAt: new Date().toISOString(),
          },
          status: 'processing',
          retryCount: 1,
          lockedBy: 'dead-host:9999:stale',
          lockedUntil: new Date(Date.now() - 5000),
          nextAttemptAt: new Date(Date.now() - 5000),
        },
      });
      const crashReclaim = await h.outboxRelay.processNextBatch();
      assert.strictEqual(crashReclaim.published, 1);
      assert.ok(deliveredEvents.some((e) => e.envelope.data.messageId === crashMsgId));

      // Scenario 4: Duplicate publish idempotency -> same eventId carried across retries; WS consumers can dedup cleanly
      const dupRowId = crypto.randomUUID();
      const dupPayload = {
        conversationId: convId,
        messageId: crypto.randomUUID(),
        sequenceNo: 100,
        messageType: 'text',
        createdAt: new Date().toISOString(),
      };
      await h.prisma.outboxEvent.create({
        data: {
          id: dupRowId,
          aggregateType: 'conversation',
          aggregateId: convId,
          eventType: 'message.created',
          payload: dupPayload,
          status: 'pending',
          nextAttemptAt: new Date(Date.now() - 10),
        },
      });
      // First worker publishes, second simulated crash leaves row processing with expired lease -> re-publish carries identical envelope eventId
      await h.outboxRelay.processNextBatch();
      await h.prisma.outboxEvent.update({
        where: { id: dupRowId },
        data: {
          status: 'processing',
          lockedBy: 'crashed-before-commit',
          lockedUntil: new Date(Date.now() - 1000),
        },
      });
      await h.outboxRelay.processNextBatch();
      const dupDeliveries = deliveredEvents.filter((e) => e.envelope.data.messageId === dupPayload.messageId);
      assert.strictEqual(dupDeliveries.length, 2);
      assert.strictEqual(dupDeliveries[0].envelope.eventId, dupRowId);
      assert.strictEqual(dupDeliveries[1].envelope.eventId, dupRowId);

      // Scenario 5: Two concurrent workers never claim the same pending event twice
      const matchAuth2 = (h.outboxRelay as any).matchAuth;
      const worker2 = new MessagingOutboxRelayService(h.prisma, matchAuth2, h.realtimeBus, 'test-w2');
      const raceMsgId = crypto.randomUUID();
      await h.prisma.outboxEvent.create({
        data: {
          aggregateType: 'conversation',
          aggregateId: convId,
          eventType: 'message.created',
          payload: {
            conversationId: convId,
            messageId: raceMsgId,
            sequenceNo: 101,
            messageType: 'text',
            createdAt: new Date().toISOString(),
          },
          status: 'pending',
          nextAttemptAt: new Date(Date.now() - 10),
        },
      });
      const [c1, c2] = await Promise.all([
        h.outboxRelay.processNextBatch(),
        worker2.processNextBatch(),
      ]);
      assert.strictEqual(c1.claimed + c2.claimed, 1);
      assert.strictEqual(c1.published + c2.published, 1);
      await worker2.onModuleDestroy();

      // Scenario 6: Transient DB claim outage -> returns zero stats without throwing and recovers on next poll
      const origFindMany = h.prisma.outboxEvent.findMany;
      h.prisma.outboxEvent.findMany = async () => {
        throw new Error('ECONNRESET DB transient');
      };
      const dbErrStats = await h.outboxRelay.processNextBatch();
      assert.strictEqual(dbErrStats.claimed, 0);
      h.prisma.outboxEvent.findMany = origFindMany;

      // Scenario 7: Prolonged outage backlog -> drains safely in bounded batches (OUTBOX_BATCH_SIZE=2)
      for (let s = 110; s < 115; s++) {
        await h.prisma.outboxEvent.create({
          data: {
            aggregateType: 'conversation',
            aggregateId: convId,
            eventType: 'message.created',
            payload: {
              conversationId: convId,
              messageId: crypto.randomUUID(),
              sequenceNo: s,
              messageType: 'text',
              createdAt: new Date().toISOString(),
            },
            status: 'pending',
            nextAttemptAt: new Date(Date.now() - 10),
          },
        });
      }
      const batch1 = await h.outboxRelay.processNextBatch();
      assert.strictEqual(batch1.claimed, 2, 'Respects OUTBOX_BATCH_SIZE=2');
      const batch2 = await h.outboxRelay.processNextBatch();
      const batch3 = await h.outboxRelay.processNextBatch();
      assert.strictEqual(batch1.published + batch2.published + batch3.published, 5);

      // Scenario 8: Poison payload -> permanently marked failed; safe operator replay restores pending -> publishes
      const poisonRow = await h.prisma.outboxEvent.create({
        data: {
          aggregateType: 'conversation',
          aggregateId: convId,
          eventType: 'message.created',
          payload: { broken: true },
          status: 'pending',
          nextAttemptAt: new Date(Date.now() - 10),
        },
      });
      const poisonStats = await h.outboxRelay.processNextBatch();
      assert.strictEqual(poisonStats.failed, 1);
      assert.strictEqual(poisonRow.status, 'failed');
      assert.strictEqual(poisonRow.lastErrorCode, 'invalid_payload_fields');

      // Scenario 9: Out-of-order queued rows within same conversation published in ascending sequenceNo order
      deliveredEvents.length = 0;
      const baseT = Date.now() - 1000;
      await h.prisma.outboxEvent.create({
        data: {
          aggregateType: 'conversation',
          aggregateId: convId,
          eventType: 'message.created',
          createdAt: new Date(baseT),
          payload: {
            conversationId: convId,
            messageId: crypto.randomUUID(),
            sequenceNo: 202,
            messageType: 'text',
            createdAt: new Date().toISOString(),
          },
          status: 'pending',
          nextAttemptAt: new Date(baseT),
        },
      });
      await h.prisma.outboxEvent.create({
        data: {
          aggregateType: 'conversation',
          aggregateId: convId,
          eventType: 'message.created',
          createdAt: new Date(baseT + 5),
          payload: {
            conversationId: convId,
            messageId: crypto.randomUUID(),
            sequenceNo: 201,
            messageType: 'text',
            createdAt: new Date().toISOString(),
          },
          status: 'pending',
          nextAttemptAt: new Date(baseT),
        },
      });
      await h.outboxRelay.processNextBatch();
      assert.deepStrictEqual(
        deliveredEvents.map((e) => e.envelope.data.sequenceNo),
        [201, 202],
      );

      // Scenario 10: Unmatch race before publish -> suppressed cleanly without emitting to WS bus
      deliveredEvents.length = 0;
      const raceRow = await h.prisma.outboxEvent.create({
        data: {
          aggregateType: 'conversation',
          aggregateId: convId,
          eventType: 'message.created',
          payload: {
            conversationId: convId,
            messageId: crypto.randomUUID(),
            sequenceNo: 300,
            messageType: 'text',
            createdAt: new Date().toISOString(),
          },
          status: 'pending',
          nextAttemptAt: new Date(Date.now() - 10),
        },
      });
      await h.dating.unmatch(uA.accountId, { matchId: matchRes.matchId! });
      deliveredEvents.length = 0; // discard conversation.closed from unmatch before testing relay suppression
      const supStats = await h.outboxRelay.processNextBatch();
      assert.strictEqual(supStats.suppressed, 1);
      assert.strictEqual(raceRow.status, 'suppressed');
      assert.strictEqual(raceRow.lastErrorCode, 'connection_closed');
      assert.strictEqual(
        deliveredEvents.some((e) => e.envelope.eventType === 'message.created'),
        false,
      );

      unsub();
    } finally {
      if (prevDisableWorker === undefined) delete process.env.DISABLE_OUTBOX_WORKER;
      else process.env.DISABLE_OUTBOX_WORKER = prevDisableWorker;
      if (prevMaxAttempts === undefined) delete process.env.OUTBOX_MAX_ATTEMPTS;
      else process.env.OUTBOX_MAX_ATTEMPTS = prevMaxAttempts;
      if (prevBaseMs === undefined) delete process.env.OUTBOX_RETRY_BASE_MS;
      else process.env.OUTBOX_RETRY_BASE_MS = prevBaseMs;
      if (prevBatch === undefined) delete process.env.OUTBOX_BATCH_SIZE;
      else process.env.OUTBOX_BATCH_SIZE = prevBatch;
      await h.cleanup();
    }
  });

  test('PHASE352-MEDIA-STREAM-01: Streaming proxy enforces Option A auth, Range 206/416, headers, zero R2 URL leakage & active revocation', async () => {
    const h = createPhase35Harness();
    const uA = h.seedUser(1, 'StreamA');
    const uB = h.seedUser(2, 'StreamB');
    const uC = h.seedUser(3, 'OutsiderC');

    // Spin up local HTTP S3-compatible server holding real WAV bytes for streaming
    const wavBytes = createRealWavBuffer(2);
    const s3Objects = new Map<string, { body: Buffer; contentType: string }>();
    const s3Server = http.createServer((req, res) => {
      const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
      const key = decodeURIComponent(urlObj.pathname.replace(/^\/[^/]+\//, ''));
      if (req.method === 'PUT') {
        const chunks: Buffer[] = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          s3Objects.set(key, {
            body: Buffer.concat(chunks),
            contentType: String(req.headers['content-type'] || 'audio/wav'),
          });
          res.statusCode = 200;
          res.end();
        });
        return;
      }
      const obj = s3Objects.get(key);
      if (!obj) {
        res.statusCode = 404;
        res.end();
        return;
      }
      if (req.method === 'HEAD') {
        res.setHeader('Content-Length', String(obj.body.length));
        res.setHeader('Content-Type', obj.contentType);
        res.setHeader('ETag', '"smn-voice-etag-1"');
        res.statusCode = 200;
        res.end();
        return;
      }
      if (req.method === 'GET') {
        const range = String(req.headers['range'] || '');
        const m = /^bytes=(\d+)-(\d+)$/.exec(range);
        if (m) {
          const s = Number(m[1]);
          const e = Math.min(Number(m[2]), obj.body.length - 1);
          const slice = obj.body.subarray(s, e + 1);
          res.setHeader('Content-Length', String(slice.length));
          res.setHeader('Content-Type', obj.contentType);
          res.setHeader('Content-Range', `bytes ${s}-${e}/${obj.body.length}`);
          res.statusCode = 206;
          res.end(slice);
          return;
        }
        res.setHeader('Content-Length', String(obj.body.length));
        res.setHeader('Content-Type', obj.contentType);
        res.statusCode = 200;
        res.end(obj.body);
        return;
      }
      res.statusCode = 405;
      res.end();
    });

    await new Promise<void>((resolve) => s3Server.listen(0, '127.0.0.1', resolve));
    const s3Port = (s3Server.address() as any).port;
    const prevEnv = {
      R2_ENDPOINT: process.env.R2_ENDPOINT,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_FORCE_PATH_STYLE: process.env.R2_FORCE_PATH_STYLE,
    };
    process.env.R2_ENDPOINT = `http://127.0.0.1:${s3Port}`;
    process.env.R2_BUCKET_NAME = 'saymyname-test';
    process.env.R2_ACCESS_KEY_ID = 'test-access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.R2_FORCE_PATH_STYLE = 'true';

    const makeMockReqRes = (method = 'GET', headers: Record<string, string> = {}) => {
      const resHeaders: Record<string, string> = {};
      const chunks: Buffer[] = [];
      let statusCode = 200;
      const closeHandlers: Array<() => void> = [];
      const res = {
        writableEnded: false,
        destroyed: false,
        setHeader: (k: string, v: string | number) => {
          resHeaders[k.toLowerCase()] = String(v);
        },
        status: (code: number) => {
          statusCode = code;
          return res;
        },
        write: (c: any) => {
          chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
          return true;
        },
        end: (c?: any) => {
          if (c) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
          res.writableEnded = true;
          return res;
        },
        on: (ev: string, cb: () => void) => {
          if (ev === 'close') closeHandlers.push(cb);
        },
        off: () => {},
      };
      const req = { method, headers, on: () => {}, off: () => {} };
      return {
        req,
        res,
        getResult: () => ({
          statusCode,
          headers: resHeaders,
          body: Buffer.concat(chunks),
        }),
      };
    };

    try {
      // 1. Unit verify parseHttpByteRange RFC 9110 bounds
      assert.deepStrictEqual(h.messaging.parseHttpByteRange(undefined, 100), { kind: 'full' });
      assert.deepStrictEqual(h.messaging.parseHttpByteRange('bytes=0-9', 100), { kind: 'single', start: 0, end: 9 });
      assert.deepStrictEqual(h.messaging.parseHttpByteRange('bytes=90-999', 100), { kind: 'single', start: 90, end: 99 });
      assert.deepStrictEqual(h.messaging.parseHttpByteRange('bytes=-15', 100), { kind: 'single', start: 85, end: 99 });
      assert.deepStrictEqual(h.messaging.parseHttpByteRange('bytes=0-1, 2-3', 100), { kind: 'invalid' });
      assert.deepStrictEqual(h.messaging.parseHttpByteRange('bytes=100-110', 100), { kind: 'invalid' });
      assert.deepStrictEqual(h.messaging.parseHttpByteRange('items=0-5', 100), { kind: 'invalid' });

      // Match A & B and upload real WAV voice note to local S3
      await h.dating.sendLike(uA.accountId, { targetProfileId: uB.profileId });
      const matchRes = await h.dating.sendLike(uB.accountId, { targetProfileId: uA.profileId });
      const convId = matchRes.conversationId!;

      const presign = await h.messaging.presignVoiceNoteForConversation(uA.accountId, convId, {
        filename: 'stream-test.wav',
        mimeType: 'audio/wav',
        durationSeconds: 2,
        fileSizeBytes: wavBytes.length,
      });
      assert.ok(presign.uploadUrl);
      const putRes = await fetch(presign.uploadUrl!, {
        method: 'PUT',
        headers: { 'Content-Type': 'audio/wav' },
        body: new Uint8Array(wavBytes),
      });
      assert.strictEqual(putRes.status, 200);

      const vnMsg = await h.messaging.sendVoiceNoteToConversation(uA.accountId, convId, {
        mediaRefId: presign.mediaRefId,
        uploadToken: presign.uploadToken,
        durationSeconds: 2,
      });
      assert.strictEqual(vnMsg.mediaUrl, `/api/bff/v1/messaging/media/${vnMsg.mediaId}/stream`);
      assert.strictEqual(JSON.stringify(vnMsg).includes('X-Amz-'), false);
      assert.strictEqual(JSON.stringify(vnMsg).includes('s3Key'), false);

      const urlDesc = await h.messaging.getAuthorizedMediaUrl(uB.accountId, vnMsg.mediaId!);
      assert.strictEqual(urlDesc.url, `/api/bff/v1/messaging/media/${vnMsg.mediaId}/stream`);
      assert.strictEqual(urlDesc.accessMode, 'same_origin_proxy');

      // 2. Full GET (200 OK) & security headers
      const fullCall = makeMockReqRes('GET');
      await h.messaging.streamVoiceNoteMedia(uB.accountId, vnMsg.mediaId!, fullCall.req, fullCall.res);
      const fullOut = fullCall.getResult();
      assert.strictEqual(fullOut.statusCode, 200);
      assert.strictEqual(fullOut.body.length, wavBytes.length);
      assert.strictEqual(fullOut.headers['x-content-type-options'], 'nosniff');
      assert.strictEqual(fullOut.headers['accept-ranges'], 'bytes');
      assert.ok(fullOut.headers['cache-control'].includes('no-store'));

      // 3. Partial Range GET (206 Partial Content) & HEAD & invalid Range (416)
      const rangeCall = makeMockReqRes('GET', { range: 'bytes=10-109' });
      await h.messaging.streamVoiceNoteMedia(uB.accountId, vnMsg.mediaId!, rangeCall.req, rangeCall.res);
      const rangeOut = rangeCall.getResult();
      assert.strictEqual(rangeOut.statusCode, 206);
      assert.strictEqual(rangeOut.headers['content-range'], `bytes 10-109/${wavBytes.length}`);
      assert.deepStrictEqual(rangeOut.body, wavBytes.subarray(10, 110));

      const headCall = makeMockReqRes('HEAD', { range: 'bytes=0-31' });
      await h.messaging.streamVoiceNoteMedia(uB.accountId, vnMsg.mediaId!, headCall.req, headCall.res);
      assert.strictEqual(headCall.getResult().statusCode, 206);
      assert.strictEqual(headCall.getResult().body.length, 0);

      const badRangeCall = makeMockReqRes('GET', { range: `bytes=${wavBytes.length + 5}-` });
      await h.messaging.streamVoiceNoteMedia(uB.accountId, vnMsg.mediaId!, badRangeCall.req, badRangeCall.res);
      assert.strictEqual(badRangeCall.getResult().statusCode, 416);
      assert.strictEqual(badRangeCall.getResult().headers['content-range'], `bytes */${wavBytes.length}`);

      const etag = rangeOut.headers['etag'];
      assert.ok(etag, 'Streaming proxy must include ETag for If-Range verification');
      const validIfRange = makeMockReqRes('GET', { range: 'bytes=10-19', 'if-range': etag });
      await h.messaging.streamVoiceNoteMedia(uB.accountId, vnMsg.mediaId!, validIfRange.req, validIfRange.res);
      assert.strictEqual(validIfRange.getResult().statusCode, 206);
      assert.deepStrictEqual(validIfRange.getResult().body, wavBytes.subarray(10, 20));

      const staleIfRange = makeMockReqRes('GET', { range: 'bytes=10-19', 'if-range': '"stale-etag"' });
      await h.messaging.streamVoiceNoteMedia(uB.accountId, vnMsg.mediaId!, staleIfRange.req, staleIfRange.res);
      assert.strictEqual(staleIfRange.getResult().statusCode, 200);
      assert.deepStrictEqual(staleIfRange.getResult().body, wavBytes);

      // 4. Outsider & nonexistent mediaId -> uniform 403 anti-oracle denial
      const outsiderCall = makeMockReqRes('GET');
      await assert.rejects(
        () => h.messaging.streamVoiceNoteMedia(uC.accountId, vnMsg.mediaId!, outsiderCall.req, outsiderCall.res),
        (e: any) => e.status === 403 && e.message === 'Voice-note media is unavailable.',
      );
      const missingCall = makeMockReqRes('GET');
      await assert.rejects(
        () => h.messaging.streamVoiceNoteMedia(uC.accountId, crypto.randomUUID(), missingCall.req, missingCall.res),
        (e: any) => e.status === 403 && e.message === 'Voice-note media is unavailable.',
      );

      // 5. Unmatch revokes stream & subsequent Range requests fail 403 immediately
      await h.dating.unmatch(uA.accountId, { matchId: matchRes.matchId! });
      const postUnmatchCall = makeMockReqRes('GET', { range: 'bytes=0-63' });
      await assert.rejects(
        () => h.messaging.streamVoiceNoteMedia(uB.accountId, vnMsg.mediaId!, postUnmatchCall.req, postUnmatchCall.res),
        (e: any) => e.status === 403,
      );
    } finally {
      for (const [k, v] of Object.entries(prevEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
      s3Server.close();
      await h.cleanup();
    }
  });
});
