import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as os from 'os';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeEventBusService } from '../realtime/realtime-event-bus.service';
import {
  CallingProviderUnavailableError,
  LiveKitProviderAdapter,
} from './livekit-provider.adapter';

export interface ClaimedCallEvictionRow {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: any;
  retryCount: number;
  createdAt: Date;
}

export interface CallEvictionFlushStats {
  claimed: number;
  completed: number;
  retried: number;
  failed: number;
}

export interface CallReconciliationStats {
  expiredInvites: number;
  closedStrandedCalls: number;
  requeuedPendingEvictions: number;
}

class PermanentCallEvictionPayloadError extends Error {
  constructor(public readonly errorCode: string) {
    super(errorCode);
    this.name = 'PermanentCallEvictionPayloadError';
  }
}

@Injectable()
export class CallEvictionRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CallEvictionRelayService.name);
  readonly workerId: string;

  private pollTimer: NodeJS.Timeout | null = null;
  private reconcileTimer: NodeJS.Timeout | null = null;
  private unsubscribeBus: (() => void) | null = null;
  private isStopping = false;
  private activeCyclePromise: Promise<CallEvictionFlushStats> | null = null;
  private flushRequestedWhileBusy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly livekitProvider: LiveKitProviderAdapter,
    @Optional() private readonly realtimeEventBus?: RealtimeEventBusService,
    @Optional() workerSuffix?: string,
  ) {
    const suffix = workerSuffix || crypto.randomBytes(4).toString('hex');
    this.workerId = `${os.hostname().slice(0, 24)}:${process.pid}:call:${suffix}`;
  }

  private getPollIntervalMs(): number {
    const raw = Number(process.env.CALL_EVICTION_POLL_INTERVAL_MS);
    return Number.isFinite(raw) && raw >= 50 && raw <= 60_000 ? Math.floor(raw) : 1000;
  }

  private getReconcileIntervalMs(): number {
    const raw = Number(process.env.CALL_RECONCILE_INTERVAL_MS);
    return Number.isFinite(raw) && raw >= 200 && raw <= 300_000 ? Math.floor(raw) : 15_000;
  }

  private getLeaseDurationMs(): number {
    const raw = Number(process.env.CALL_EVICTION_LEASE_MS);
    return Number.isFinite(raw) && raw >= 200 && raw <= 120_000 ? Math.floor(raw) : 15_000;
  }

  private getBatchSize(): number {
    const raw = Number(process.env.CALL_EVICTION_BATCH_SIZE);
    return Number.isFinite(raw) && raw >= 1 && raw <= 100 ? Math.floor(raw) : 25;
  }

  private getMaxAttempts(): number {
    const raw = Number(process.env.CALL_EVICTION_MAX_ATTEMPTS);
    return Number.isFinite(raw) && raw >= 1 && raw <= 30 ? Math.floor(raw) : 10;
  }

  private getBaseBackoffMs(): number {
    const raw = Number(process.env.CALL_EVICTION_RETRY_BASE_MS);
    return Number.isFinite(raw) && raw >= 20 && raw <= 30_000 ? Math.floor(raw) : 500;
  }

  private getMaxBackoffMs(): number {
    const raw = Number(process.env.CALL_EVICTION_RETRY_MAX_MS);
    return Number.isFinite(raw) && raw >= 100 && raw <= 300_000 ? Math.floor(raw) : 30_000;
  }

  onModuleInit() {
    this.isStopping = false;
    if (this.realtimeEventBus) {
      this.unsubscribeBus = this.realtimeEventBus.subscribe((msg) => {
        if (
          msg.kind === 'match_ended' ||
          msg.kind === 'account_revoked' ||
          msg.kind === 'call_eviction_queued'
        ) {
          void this.triggerImmediateFlush().catch(() => null);
        }
      });
    }

    if (process.env.DISABLE_CALL_EVICTION_WORKER === 'true') {
      return;
    }

    const intervalMs = this.getPollIntervalMs();
    this.pollTimer = setInterval(() => {
      void this.processNextBatch().catch(() => null);
    }, intervalMs);
    this.pollTimer.unref?.();

    const reconcileMs = this.getReconcileIntervalMs();
    this.reconcileTimer = setInterval(() => {
      void this.runReconciliationSweep().catch(() => null);
    }, reconcileMs);
    this.reconcileTimer.unref?.();
  }

  async onModuleDestroy() {
    this.isStopping = true;
    if (this.unsubscribeBus) {
      this.unsubscribeBus();
      this.unsubscribeBus = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.reconcileTimer) {
      clearInterval(this.reconcileTimer);
      this.reconcileTimer = null;
    }
    if (this.activeCyclePromise) {
      await this.activeCyclePromise.catch(() => null);
    }
  }

  triggerImmediateFlush(): Promise<CallEvictionFlushStats> {
    if (this.isStopping) {
      return Promise.resolve({ claimed: 0, completed: 0, retried: 0, failed: 0 });
    }
    if (this.activeCyclePromise) {
      this.flushRequestedWhileBusy = true;
      return this.activeCyclePromise;
    }
    return this.processNextBatch();
  }

  async processNextBatch(): Promise<CallEvictionFlushStats> {
    if (this.isStopping) {
      return { claimed: 0, completed: 0, retried: 0, failed: 0 };
    }
    if (this.activeCyclePromise) {
      return this.activeCyclePromise;
    }

    const cycle = this.runBatchCycle();
    this.activeCyclePromise = cycle;
    try {
      const stats = await cycle;
      if (this.flushRequestedWhileBusy && !this.isStopping) {
        this.flushRequestedWhileBusy = false;
        setImmediate(() => {
          void this.processNextBatch().catch(() => null);
        });
      }
      return stats;
    } finally {
      this.activeCyclePromise = null;
    }
  }

  private computeNextBackoffMs(retryCount: number): number {
    const base = this.getBaseBackoffMs();
    const max = this.getMaxBackoffMs();
    const exp = Math.min(20, Math.max(0, retryCount - 1));
    return Math.min(max, base * Math.pow(2, exp));
  }

  private async runBatchCycle(): Promise<CallEvictionFlushStats> {
    const stats: CallEvictionFlushStats = {
      claimed: 0,
      completed: 0,
      retried: 0,
      failed: 0,
    };

    let claimedRows: ClaimedCallEvictionRow[] = [];
    try {
      claimedRows = await this.claimPendingOrExpiredBatch(
        this.getBatchSize(),
        this.getLeaseDurationMs(),
      );
    } catch {
      return stats;
    }

    stats.claimed = claimedRows.length;
    for (const row of claimedRows) {
      if (this.isStopping) break;
      const outcome = await this.evictSingleJob(row);
      if (outcome === 'completed') stats.completed++;
      else if (outcome === 'retried') stats.retried++;
      else if (outcome === 'failed') stats.failed++;
    }

    return stats;
  }

  async claimPendingOrExpiredBatch(
    batchSize: number,
    leaseDurationMs: number,
  ): Promise<ClaimedCallEvictionRow[]> {
    const prismaAny = this.prisma as any;

    if (
      typeof prismaAny?.$transaction === 'function' &&
      typeof prismaAny?.$queryRawUnsafe === 'function'
    ) {
      const rows = await prismaAny.$transaction(async (tx: any) => {
        return tx.$queryRawUnsafe(
          `
          WITH candidate AS (
            SELECT id
            FROM platform.outbox_events
            WHERE aggregate_type = 'call_session'
              AND event_type = 'call.evict'
              AND (
                (status = 'pending' AND next_attempt_at <= NOW())
                OR (status = 'processing' AND locked_until IS NOT NULL AND locked_until <= NOW())
              )
            ORDER BY created_at ASC
            LIMIT $1
            FOR UPDATE SKIP LOCKED
          )
          UPDATE platform.outbox_events AS oe
          SET status = 'processing',
              locked_by = $2,
              locked_until = NOW() + ($3 * INTERVAL '1 millisecond'),
              retry_count = oe.retry_count + 1
          FROM candidate
          WHERE oe.id = candidate.id
          RETURNING
            oe.id,
            oe.aggregate_type AS "aggregateType",
            oe.aggregate_id AS "aggregateId",
            oe.event_type AS "eventType",
            oe.payload,
            oe.retry_count AS "retryCount",
            oe.created_at AS "createdAt"
          `,
          batchSize,
          this.workerId,
          leaseDurationMs,
        );
      });
      return Array.isArray(rows) ? rows : [];
    }

    if (typeof prismaAny?.outboxEvent?.findMany === 'function') {
      const now = new Date();
      const candidates = await prismaAny.outboxEvent.findMany({
        where: {
          aggregateType: 'call_session',
          eventType: 'call.evict',
          OR: [
            { status: 'pending', nextAttemptAt: { lte: now } },
            { status: 'processing', lockedUntil: { lte: now } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
      });

      const claimed: ClaimedCallEvictionRow[] = [];
      const leaseExpiry = new Date(Date.now() + leaseDurationMs);
      for (const cand of candidates || []) {
        if (cand.aggregateType !== 'call_session' || cand.eventType !== 'call.evict') {
          continue;
        }
        const prevRetryCount = Number(cand.retryCount ?? 0);
        const nextRetryCount = prevRetryCount + 1;
        const createdAtVal =
          cand.createdAt instanceof Date ? cand.createdAt : new Date(cand.createdAt);
        const res = await prismaAny.outboxEvent.updateMany({
          where: {
            id: cand.id,
            status: cand.status,
            retryCount: cand.retryCount ?? 0,
          },
          data: {
            status: 'processing',
            lockedBy: this.workerId,
            lockedUntil: leaseExpiry,
            retryCount: nextRetryCount,
          },
        });
        if (Number(res?.count || 0) === 1) {
          claimed.push({
            id: cand.id,
            aggregateType: cand.aggregateType,
            aggregateId: cand.aggregateId,
            eventType: cand.eventType,
            payload: cand.payload,
            retryCount: nextRetryCount,
            createdAt: createdAtVal,
          });
        }
      }
      return claimed;
    }

    return [];
  }

  private validatePayload(row: ClaimedCallEvictionRow): {
    callSessionId: string;
    livekitRoomId: string;
    participantAccountIds: string[];
    revokeTokenTs: number;
  } {
    const p = row.payload;
    if (!p || typeof p !== 'object') {
      throw new PermanentCallEvictionPayloadError('invalid_call_evict_empty');
    }
    const callSessionId = String(p.callSessionId || row.aggregateId || '').trim();
    const livekitRoomId = String(p.livekitRoomId || '').trim();
    const participantAccountIds = Array.isArray(p.participantAccountIds)
      ? p.participantAccountIds.map((x: any) => String(x || '').trim()).filter(Boolean)
      : [];
    const revokeTokenTs = Number(p.revokeTokenTs || Math.floor(Date.now() / 1000));

    if (!callSessionId || !livekitRoomId) {
      throw new PermanentCallEvictionPayloadError('invalid_call_evict_fields');
    }
    return { callSessionId, livekitRoomId, participantAccountIds, revokeTokenTs };
  }

  private async evictSingleJob(
    row: ClaimedCallEvictionRow,
  ): Promise<'completed' | 'retried' | 'failed'> {
    const prismaAny = this.prisma as any;
    const now = new Date();
    let callSessionIdForUpdate = row.aggregateId;

    try {
      const payload = this.validatePayload(row);
      callSessionIdForUpdate = payload.callSessionId;

      if (!this.livekitProvider.isConfigured()) {
        throw new CallingProviderUnavailableError('livekit_unconfigured');
      }

      const evictRes = await this.livekitProvider.evictSession({
        roomId: payload.livekitRoomId,
        callSessionId: payload.callSessionId,
        participantAccountIds: payload.participantAccountIds,
        revokeTokenTs: payload.revokeTokenTs,
      });

      const remaining = await this.livekitProvider.listParticipants(payload.livekitRoomId);
      if (remaining.length > 0) {
        throw new CallingProviderUnavailableError('livekit_participants_still_present');
      }

      const finalEvictionStatus =
        evictRes.outcome === 'evicted' ? 'completed' : 'already_absent';

      await prismaAny.outboxEvent
        .updateMany({
          where: { id: row.id, lockedBy: this.workerId },
          data: {
            status: 'published',
            processedAt: now,
            lockedBy: null,
            lockedUntil: null,
            lastErrorCode: null,
          },
        })
        .catch(() => null);

      if (typeof prismaAny?.callSession?.update === 'function') {
        await prismaAny.callSession
          .update({
            where: { id: payload.callSessionId },
            data: {
              evictionStatus: finalEvictionStatus,
              evictedAt: now,
              evictionAttempts: row.retryCount,
              lastEvictionError: null,
            },
          })
          .catch(() => null);
      }

      if (process.env.NODE_ENV !== 'test' || process.env.OUTBOX_VERBOSE_LOGS === 'true') {
        this.logger.log(
          JSON.stringify({
            component: 'CallEvictionRelay',
            workerId: this.workerId,
            eventId: row.id,
            callSessionId: payload.callSessionId,
            attempt: row.retryCount,
            status: finalEvictionStatus,
          }),
        );
      }

      return 'completed';
    } catch (err: any) {
      const isPermanent = err instanceof PermanentCallEvictionPayloadError;
      const maxAttempts = this.getMaxAttempts();
      const errorCode =
        err instanceof PermanentCallEvictionPayloadError
          ? err.errorCode
          : err instanceof CallingProviderUnavailableError
            ? 'calling_provider_unavailable'
            : String(err?.code || 'eviction_transient_error').slice(0, 64);

      const exhaust = isPermanent || row.retryCount >= maxAttempts;

      if (exhaust) {
        await prismaAny.outboxEvent
          .updateMany({
            where: { id: row.id, lockedBy: this.workerId },
            data: {
              status: 'failed',
              lastErrorCode: errorCode,
              lastErrorAt: now,
              lockedBy: null,
              lockedUntil: null,
            },
          })
          .catch(() => null);

        if (callSessionIdForUpdate && typeof prismaAny?.callSession?.update === 'function') {
          await prismaAny.callSession
            .update({
              where: { id: callSessionIdForUpdate },
              data: {
                evictionStatus: 'failed',
                evictionAttempts: row.retryCount,
                lastEvictionError: errorCode,
              },
            })
            .catch(() => null);
        }
        this.logger.warn(
          JSON.stringify({
            component: 'CallEvictionRelay',
            workerId: this.workerId,
            eventId: row.id,
            callSessionId: callSessionIdForUpdate,
            attempt: row.retryCount,
            status: 'failed',
            errorCode,
          }),
        );
        return 'failed';
      }

      const nextDelayMs = this.computeNextBackoffMs(row.retryCount);
      const nextAttemptAt = new Date(Date.now() + nextDelayMs);

      await prismaAny.outboxEvent
        .updateMany({
          where: { id: row.id, lockedBy: this.workerId },
          data: {
            status: 'pending',
            nextAttemptAt,
            lastErrorCode: errorCode,
            lastErrorAt: now,
            lockedBy: null,
            lockedUntil: null,
          },
        })
        .catch(() => null);

      if (callSessionIdForUpdate && typeof prismaAny?.callSession?.update === 'function') {
        await prismaAny.callSession
          .update({
            where: { id: callSessionIdForUpdate },
            data: {
              evictionStatus: 'retrying',
              evictionAttempts: row.retryCount,
              lastEvictionError: errorCode,
            },
          })
          .catch(() => null);
      }

      return 'retried';
    }
  }

  /**
   * Bounded background reconciliation sweep:
   * 1) Marks expired un-answered invitations as missed and schedules cleanup.
   * 2) Closes any non-terminal CallSessions whose Match or Conversation is already closed/ended.
   * 3) Ensures any terminal CallSession still awaiting SFU eviction has an active outbox job.
   */
  async runReconciliationSweep(batchLimit = 25): Promise<CallReconciliationStats> {
    const prismaAny = this.prisma as any;
    const stats: CallReconciliationStats = {
      expiredInvites: 0,
      closedStrandedCalls: 0,
      requeuedPendingEvictions: 0,
    };

    if (typeof prismaAny?.callSession?.findMany !== 'function') {
      return stats;
    }

    const now = new Date();

    // 1. Expired invites
    const expiredInvites = await prismaAny.callSession
      .findMany({
        where: {
          callStatus: { in: ['inviting', 'initiated', 'ringing'] },
          expiresAt: { lte: now },
        },
        take: batchLimit,
      })
      .catch(() => []);

    for (const cs of expiredInvites || []) {
      await prismaAny.callSession
        .update({
          where: { id: cs.id },
          data: {
            callStatus: 'missed',
            endedAt: now,
            endedReason: 'invite_timeout',
            evictionStatus: 'pending',
          },
        })
        .catch(() => null);
      await this.enqueueEvictionIfMissing(cs, 'invite_timeout', now);
      this.realtimeEventBus?.publishConversationEvent(
        cs.conversationId,
        'call.ended',
        {
          callSessionId: cs.id,
          conversationId: cs.conversationId,
          status: 'missed',
          callType: 'audio',
          endedReason: 'invite_timeout',
          expiresAt: cs.expiresAt ? new Date(cs.expiresAt).toISOString() : null,
          occurredAt: now.toISOString(),
        },
        { recipientAccountIds: [cs.callerId, cs.receiverId].filter(Boolean) },
      );
      stats.expiredInvites++;
    }

    // 2. Non-terminal calls on already-closed matches/conversations
    const nonTerminalWithConv = await prismaAny.callSession
      .findMany({
        where: {
          callStatus: {
            in: [
              'inviting',
              'initiated',
              'ringing',
              'accepted',
              'connecting',
              'active',
              'reconnecting',
            ],
          },
        },
        include: {
          conversation: {
            include: { match: true },
          },
        },
        take: batchLimit,
      })
      .catch(() => []);

    for (const cs of nonTerminalWithConv || []) {
      const convClosed = cs.conversation?.status === 'closed';
      const matchEnded = cs.conversation?.match && cs.conversation.match.status !== 'active';
      if (convClosed || matchEnded) {
        await prismaAny.callSession
          .update({
            where: { id: cs.id },
            data: {
              callStatus: 'ended',
              endedAt: now,
              endedReason: 'match_inactive',
              evictionStatus: 'pending',
            },
          })
          .catch(() => null);
        await this.enqueueEvictionIfMissing(cs, 'match_inactive', now);
        stats.closedStrandedCalls++;
      }
    }

    // 3. Stranded terminal calls still in pending/retrying without an open outbox job
    const pendingEvictions = await prismaAny.callSession
      .findMany({
        where: {
          callStatus: { in: ['ended', 'rejected', 'missed', 'failed'] },
          evictionStatus: { in: ['pending', 'retrying'] },
        },
        take: batchLimit,
      })
      .catch(() => []);

    for (const cs of pendingEvictions || []) {
      const inserted = await this.enqueueEvictionIfMissing(cs, cs.endedReason || 'reconcile', now);
      if (inserted) {
        stats.requeuedPendingEvictions++;
      }
    }

    if (
      stats.expiredInvites > 0 ||
      stats.closedStrandedCalls > 0 ||
      stats.requeuedPendingEvictions > 0
    ) {
      await this.triggerImmediateFlush().catch(() => null);
    }

    return stats;
  }

  private async enqueueEvictionIfMissing(
    cs: any,
    reason: string,
    now: Date,
  ): Promise<boolean> {
    const prismaAny = this.prisma as any;
    if (
      !cs?.id ||
      !cs?.livekitRoomId ||
      typeof prismaAny?.outboxEvent?.create !== 'function'
    ) {
      return false;
    }

    if (typeof prismaAny?.outboxEvent?.findFirst === 'function') {
      const existing = await prismaAny.outboxEvent
        .findFirst({
          where: {
            aggregateType: 'call_session',
            aggregateId: cs.id,
            eventType: 'call.evict',
            status: { in: ['pending', 'processing'] },
          },
        })
        .catch(() => null);
      if (existing) {
        return false;
      }
    }

    await prismaAny.outboxEvent
      .create({
        data: {
          aggregateType: 'call_session',
          aggregateId: cs.id,
          eventType: 'call.evict',
          status: 'pending',
          payload: {
            callSessionId: cs.id,
            conversationId: cs.conversationId,
            livekitRoomId: cs.livekitRoomId,
            participantAccountIds: [cs.callerId, cs.receiverId].filter(Boolean),
            reason,
            revokeTokenTs: Math.floor(now.getTime() / 1000),
          },
        },
      })
      .catch(() => null);

    return true;
  }
}
