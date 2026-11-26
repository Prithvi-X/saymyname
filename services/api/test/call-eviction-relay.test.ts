import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import * as crypto from 'crypto';
import { CallEvictionRelayService } from '../src/modules/calling/call-eviction-relay.service';
import {
  CallingProviderUnavailableError,
  LiveKitProviderAdapter,
} from '../src/modules/calling/livekit-provider.adapter';
import { MessagingOutboxRelayService } from '../src/modules/realtime/messaging-outbox-relay.service';
import { RealtimeEventBusService } from '../src/modules/realtime/realtime-event-bus.service';
import { MatchAuthorizationService } from '../src/modules/safety/match-authorization.service';

function createEvictionTestStore() {
  const outboxEvents: any[] = [];
  const callSessions: any[] = [];
  const conversations: any[] = [];
  const matches: any[] = [];

  const prisma: any = {
    outboxEvent: {
      findMany: async ({ where }: any) =>
        outboxEvents.filter((e) => {
          if (where?.aggregateType && e.aggregateType !== where.aggregateType) return false;
          if (where?.eventType && e.eventType !== where.eventType) return false;
          if (where?.OR) {
            return where.OR.some((branch: any) => {
              if (branch.status && e.status !== branch.status) return false;
              if (branch.nextAttemptAt?.lte && new Date(e.nextAttemptAt) > branch.nextAttemptAt.lte) {
                return false;
              }
              if (
                branch.lockedUntil?.lte &&
                (!e.lockedUntil || new Date(e.lockedUntil) > branch.lockedUntil.lte)
              ) {
                return false;
              }
              return true;
            });
          }
          return true;
        }),
      findFirst: async ({ where }: any) =>
        outboxEvents.find(
          (e) =>
            (!where?.aggregateType || e.aggregateType === where.aggregateType) &&
            (!where?.aggregateId || e.aggregateId === where.aggregateId) &&
            (!where?.eventType || e.eventType === where.eventType) &&
            (!where?.status?.in || where.status.in.includes(e.status)),
        ) ?? null,
      create: async ({ data }: any) => {
        const row = {
          id: crypto.randomUUID(),
          retryCount: 0,
          nextAttemptAt: new Date(),
          lockedBy: null,
          lockedUntil: null,
          lastErrorCode: null,
          lastErrorAt: null,
          createdAt: new Date(),
          processedAt: null,
          ...data,
        };
        outboxEvents.push(row);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const e of outboxEvents) {
          if (
            (!where?.id || e.id === where.id) &&
            (!where?.status || e.status === where.status) &&
            (where?.retryCount === undefined || e.retryCount === where.retryCount) &&
            (where?.lockedBy === undefined || e.lockedBy === where.lockedBy)
          ) {
            Object.assign(e, data);
            count++;
          }
        }
        return { count };
      },
    },
    callSession: {
      findMany: async ({ where }: any) =>
        callSessions
          .filter((cs) => {
            if (where?.conversationId && cs.conversationId !== where.conversationId) return false;
            if (where?.callStatus?.in && !where.callStatus.in.includes(cs.callStatus)) return false;
            if (where?.evictionStatus?.in && !where.evictionStatus.in.includes(cs.evictionStatus)) {
              return false;
            }
            if (
              where?.expiresAt?.lte &&
              (!cs.expiresAt || new Date(cs.expiresAt) > where.expiresAt.lte)
            ) {
              return false;
            }
            return true;
          })
          .map((cs) => {
            const conv = conversations.find((c) => c.id === cs.conversationId);
            const match = conv ? matches.find((m) => m.id === conv.matchId) : null;
            return {
              ...cs,
              conversation: conv ? { ...conv, match } : null,
            };
          }),
      update: async ({ where, data }: any) => {
        const cs = callSessions.find((x) => x.id === where.id);
        if (cs) Object.assign(cs, data);
        return cs;
      },
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const cs of callSessions) {
          if (
            (!where?.conversationId || cs.conversationId === where.conversationId) &&
            (!where?.callStatus?.in || where.callStatus.in.includes(cs.callStatus))
          ) {
            Object.assign(cs, data);
            count++;
          }
        }
        return { count };
      },
    },
    match: {
      update: async ({ where, data }: any) => {
        const m = matches.find((x) => x.id === where.id);
        if (m) Object.assign(m, data);
        return m;
      },
    },
    conversation: {
      updateMany: async ({ where, data }: any) => {
        let count = 0;
        for (const c of conversations) {
          if (
            (!where?.id || c.id === where.id) &&
            (!where?.status?.not || c.status !== where.status.not)
          ) {
            Object.assign(c, data);
            count++;
          }
        }
        return { count };
      },
    },
  };

  return { prisma, outboxEvents, callSessions, conversations, matches };
}

describe('Phase 4.1 MATCH-22 Durable SFU Eviction Relay & Reconciliation', () => {
  it('enqueues call.evict atomically on match termination and isolates from MessagingOutboxRelay', async () => {
    const store = createEvictionTestStore();
    const matchId = crypto.randomUUID();
    const convId = crypto.randomUUID();
    const callId = crypto.randomUUID();
    const match = {
      id: matchId,
      userLowId: 'u-low',
      userHighId: 'u-high',
      status: 'active',
      conversation: { id: convId, matchId, status: 'active' },
    };
    store.matches.push(match);
    store.conversations.push(match.conversation);
    store.callSessions.push({
      id: callId,
      conversationId: convId,
      callerId: 'u-low',
      receiverId: 'u-high',
      callStatus: 'active',
      livekitRoomId: 'smn_call_room_m22',
      evictionStatus: 'not_required',
    });

    const matchAuth = new MatchAuthorizationService(store.prisma);
    await matchAuth.closeMatchDownstreamState(store.prisma, {
      match,
      actorId: 'u-low',
      endedByAccountId: 'u-low',
      endReason: 'unmatched',
    });

    assert.equal(store.callSessions[0].callStatus, 'ended');
    assert.equal(store.callSessions[0].evictionStatus, 'pending');
    assert.equal(store.outboxEvents.length, 1);
    assert.equal(store.outboxEvents[0].aggregateType, 'call_session');
    assert.equal(store.outboxEvents[0].eventType, 'call.evict');

    // MessagingOutboxRelay MUST NOT claim call.evict rows
    const eventBus = new RealtimeEventBusService();
    const msgRelay = new MessagingOutboxRelayService(store.prisma, matchAuth, eventBus, 'msg-w1');
    const msgStats = await msgRelay.processNextBatch();
    assert.equal(msgStats.claimed, 0);
    await eventBus.onModuleDestroy();
  });

  it('retries with backoff during transient SFU outage, then evicts and marks completed on recovery', async () => {
    const store = createEvictionTestStore();
    const callId = crypto.randomUUID();
    store.callSessions.push({
      id: callId,
      conversationId: crypto.randomUUID(),
      callerId: 'u-1',
      receiverId: 'u-2',
      callStatus: 'ended',
      livekitRoomId: 'smn_call_room_retry',
      evictionStatus: 'pending',
      evictionAttempts: 0,
    });
    store.outboxEvents.push({
      id: crypto.randomUUID(),
      aggregateType: 'call_session',
      aggregateId: callId,
      eventType: 'call.evict',
      status: 'pending',
      retryCount: 0,
      nextAttemptAt: new Date(Date.now() - 1000),
      createdAt: new Date(),
      payload: {
        callSessionId: callId,
        livekitRoomId: 'smn_call_room_retry',
        participantAccountIds: ['u-1', 'u-2'],
        revokeTokenTs: Math.floor(Date.now() / 1000),
      },
    });

    let outage = true;
    const removedCalls: string[] = [];
    const adapter = new LiveKitProviderAdapter();
    (adapter as any).isConfigured = () => true;
    (adapter as any).evictSession = async ({ roomId }: any) => {
      if (outage) {
        throw new CallingProviderUnavailableError('Simulated LiveKit SFU outage');
      }
      removedCalls.push(roomId);
      return { outcome: 'evicted', participantIdentities: ['p1', 'p2'], roomDeleted: 'deleted' };
    };
    (adapter as any).listParticipants = async () => [];

    const prevMax = process.env.CALL_EVICTION_MAX_ATTEMPTS;
    const prevBase = process.env.CALL_EVICTION_RETRY_BASE_MS;
    process.env.CALL_EVICTION_MAX_ATTEMPTS = '3';
    process.env.CALL_EVICTION_RETRY_BASE_MS = '20';

    try {
      const relay = new CallEvictionRelayService(store.prisma, adapter, undefined, 'w1');

      const first = await relay.processNextBatch();
      assert.equal(first.claimed, 1);
      assert.equal(first.retried, 1);
      assert.equal(store.callSessions[0].evictionStatus, 'retrying');
      assert.equal(store.callSessions[0].evictionAttempts, 1);
      assert.equal(store.outboxEvents[0].status, 'pending');

      // Simulate recovery once nextAttemptAt passes
      outage = false;
      store.outboxEvents[0].nextAttemptAt = new Date(Date.now() - 10);
      const second = await relay.processNextBatch();
      assert.equal(second.claimed, 1);
      assert.equal(second.completed, 1);
      assert.equal(removedCalls[0], 'smn_call_room_retry');
      assert.equal(store.callSessions[0].evictionStatus, 'completed');
      assert.equal(store.callSessions[0].evictionAttempts, 2);
      assert.equal(store.outboxEvents[0].status, 'published');
    } finally {
      process.env.CALL_EVICTION_MAX_ATTEMPTS = prevMax;
      process.env.CALL_EVICTION_RETRY_BASE_MS = prevBase;
    }
  });

  it('reclaims expired worker leases and reconciles expired invites, stranded calls, and pending evictions', async () => {
    const store = createEvictionTestStore();
    const expiredCallId = crypto.randomUUID();
    const strandedCallId = crypto.randomUUID();
    const abandonedJobCallId = crypto.randomUUID();

    const closedConvId = crypto.randomUUID();
    const endedMatchId = crypto.randomUUID();
    store.matches.push({ id: endedMatchId, status: 'ended' });
    store.conversations.push({ id: closedConvId, matchId: endedMatchId, status: 'closed' });

    store.callSessions.push(
      {
        id: expiredCallId,
        conversationId: crypto.randomUUID(),
        callerId: 'u1',
        receiverId: 'u2',
        callStatus: 'ringing',
        expiresAt: new Date(Date.now() - 5000),
        livekitRoomId: 'smn_room_expired',
        evictionStatus: 'not_required',
      },
      {
        id: strandedCallId,
        conversationId: closedConvId,
        callerId: 'u1',
        receiverId: 'u2',
        callStatus: 'active',
        livekitRoomId: 'smn_room_stranded',
        evictionStatus: 'not_required',
      },
      {
        id: abandonedJobCallId,
        conversationId: crypto.randomUUID(),
        callerId: 'u1',
        receiverId: 'u2',
        callStatus: 'ended',
        livekitRoomId: 'smn_room_lease_lost',
        evictionStatus: 'retrying',
      },
    );

    // Simulate worker-1 crash mid-lease
    store.outboxEvents.push({
      id: crypto.randomUUID(),
      aggregateType: 'call_session',
      aggregateId: abandonedJobCallId,
      eventType: 'call.evict',
      status: 'processing',
      lockedBy: 'crashed-worker-1',
      lockedUntil: new Date(Date.now() - 2000),
      retryCount: 1,
      nextAttemptAt: new Date(Date.now() - 5000),
      createdAt: new Date(Date.now() - 5000),
      payload: {
        callSessionId: abandonedJobCallId,
        livekitRoomId: 'smn_room_lease_lost',
        participantAccountIds: ['u1', 'u2'],
        revokeTokenTs: Math.floor(Date.now() / 1000),
      },
    });

    const adapter = new LiveKitProviderAdapter();
    const deletedRooms: string[] = [];
    (adapter as any).isConfigured = () => true;
    (adapter as any).evictSession = async ({ roomId }: any) => {
      deletedRooms.push(roomId);
      return { outcome: 'already_absent', participantIdentities: [], roomDeleted: 'already_absent' };
    };
    (adapter as any).listParticipants = async () => [];

    const relay = new CallEvictionRelayService(store.prisma, adapter, undefined, 'w2');
    const sweep = await relay.runReconciliationSweep();

    assert.equal(sweep.expiredInvites, 1);
    assert.equal(sweep.closedStrandedCalls, 1);
    assert.equal(store.callSessions.find((c) => c.id === expiredCallId).callStatus, 'missed');
    assert.equal(store.callSessions.find((c) => c.id === strandedCallId).callStatus, 'ended');
    assert.ok(deletedRooms.includes('smn_room_expired'));
    assert.ok(deletedRooms.includes('smn_room_stranded'));
    assert.ok(deletedRooms.includes('smn_room_lease_lost'));
    assert.equal(store.callSessions.find((c) => c.id === abandonedJobCallId).evictionStatus, 'already_absent');
  });
});
