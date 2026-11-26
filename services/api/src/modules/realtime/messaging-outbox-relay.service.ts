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
import { MatchAuthorizationService } from '../safety/match-authorization.service';
import {
  OutboxTransientPublishError,
  RealtimeEventBusService,
} from './realtime-event-bus.service';

export interface ClaimedOutboxRow {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: any;
  retryCount: number;
  createdAt: Date;
}

export interface OutboxFlushStats {
  claimed: number;
  published: number;
  retried: number;
  failed: number;
  suppressed: number;
}

class PermanentOutboxPayloadError extends Error {
  constructor(public readonly errorCode: string) {
    super(errorCode);
    this.name = 'PermanentOutboxPayloadError';
  }
}

@Injectable()
export class MessagingOutboxRelayService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MessagingOutboxRelayService.name);
  readonly workerId: string;

  private pollTimer: NodeJS.Timeout | null = null;
  private isStopping = false;
  private activeCyclePromise: Promise<OutboxFlushStats> | null = null;
  private flushRequestedWhileBusy = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly matchAuth: MatchAuthorizationService,
    private readonly eventBus: RealtimeEventBusService,
    @Optional() workerSuffix?: string,
  ) {
    const suffix = workerSuffix || crypto.randomBytes(4).toString('hex');
    this.workerId = `${os.hostname().slice(0, 24)}:${process.pid}:${suffix}`;
  }

  private getPollIntervalMs(): number {
    const raw = Number(process.env.OUTBOX_POLL_INTERVAL_MS);
    return Number.isFinite(raw) && raw >= 50 && raw <= 60_000 ? Math.floor(raw) : 1000;
  }

  private getLeaseDurationMs(): number {
    const raw = Number(process.env.OUTBOX_LEASE_MS);
    return Number.isFinite(raw) && raw >= 200 && raw <= 120_000 ? Math.floor(raw) : 15_000;
  }

  private getBatchSize(): number {
    const raw = Number(process.env.OUTBOX_BATCH_SIZE);
    return Number.isFinite(raw) && raw >= 1 && raw <= 100 ? Math.floor(raw) : 25;
  }

  private getMaxAttempts(): number {
    const raw = Number(process.env.OUTBOX_MAX_ATTEMPTS);
    return Number.isFinite(raw) && raw >= 1 && raw <= 20 ? Math.floor(raw) : 8;
  }

  private getBaseBackoffMs(): number {
    const raw = Number(process.env.OUTBOX_RETRY_BASE_MS);
    return Number.isFinite(raw) && raw >= 20 && raw <= 30_000 ? Math.floor(raw) : 1000;
  }

  private getMaxBackoffMs(): number {
    const raw = Number(process.env.OUTBOX_RETRY_MAX_MS);
    return Number.isFinite(raw) && raw >= 100 && raw <= 300_000 ? Math.floor(raw) : 60_000;
  }

  onModuleInit() {
    this.isStopping = false;
    if (process.env.DISABLE_OUTBOX_WORKER === 'true') {
      return;
    }
    const intervalMs = this.getPollIntervalMs();
    this.pollTimer = setInterval(() => {
      void this.processNextBatch().catch(() => null);
    }, intervalMs);
    this.pollTimer.unref?.();
  }

  async onModuleDestroy() {
    this.isStopping = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.activeCyclePromise) {
      await this.activeCyclePromise.catch(() => null);
    }
  }

  triggerImmediateFlush(): Promise<OutboxFlushStats> {
    if (this.isStopping) {
      return Promise.resolve({
        claimed: 0,
        published: 0,
        retried: 0,
        failed: 0,
        suppressed: 0,
      });
    }
    if (this.activeCyclePromise) {
      this.flushRequestedWhileBusy = true;
      return this.activeCyclePromise;
    }
    return this.processNextBatch();
  }

  async processNextBatch(): Promise<OutboxFlushStats> {
    if (this.isStopping) {
      return { claimed: 0, published: 0, retried: 0, failed: 0, suppressed: 0 };
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

  private async runBatchCycle(): Promise<OutboxFlushStats> {
    const stats: OutboxFlushStats = {
      claimed: 0,
      published: 0,
      retried: 0,
      failed: 0,
      suppressed: 0,
    };

    let claimedRows: ClaimedOutboxRow[] = [];
    try {
      claimedRows = await this.claimPendingOrExpiredBatch(
        this.getBatchSize(),
        this.getLeaseDurationMs(),
      );
    } catch (err: any) {
      this.logger.warn(
        JSON.stringify({
          component: 'OutboxRelay',
          workerId: this.workerId,
          status: 'claim_error',
          retryCategory: 'database_unavailable',
          message: String(err?.code || 'db_error').slice(0, 64),
        }),
      );
      return stats;
    }

    stats.claimed = claimedRows.length;
    if (claimedRows.length === 0) {
      return stats;
    }

    // Group and sort sequentially by conversation + sequenceNo to prevent worker-induced reordering
    const grouped = new Map<string, ClaimedOutboxRow[]>();
    for (const row of claimedRows) {
      const key = String(row.aggregateId || row.payload?.conversationId || 'unknown');
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    for (const rows of grouped.values()) {
      rows.sort((a, b) => {
        const seqA = Number(a.payload?.sequenceNo ?? 0);
        const seqB = Number(b.payload?.sequenceNo ?? 0);
        if (seqA !== seqB) return seqA - seqB;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      for (const row of rows) {
        if (this.isStopping) break;
        const outcome = await this.relaySingleEvent(row);
        if (outcome === 'published') stats.published++;
        else if (outcome === 'retried') stats.retried++;
        else if (outcome === 'failed') stats.failed++;
        else if (outcome === 'suppressed') stats.suppressed++;
      }
    }

    return stats;
  }

  async claimPendingOrExpiredBatch(
    batchSize: number,
    leaseDurationMs: number,
  ): Promise<ClaimedOutboxRow[]> {
    const prismaAny = this.prisma as any;

    // Production / PostgreSQL path: atomic row-level claim without holding lock across Redis I/O
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
            WHERE (status = 'pending' AND next_attempt_at <= NOW())
               OR (status = 'processing' AND locked_until IS NOT NULL AND locked_until <= NOW())
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

    // In-memory unit mock fallback (optimistic CAS via updateMany)
    if (typeof prismaAny?.outboxEvent?.findMany === 'function') {
      const now = new Date();
      const candidates = await prismaAny.outboxEvent.findMany({
        where: {
          OR: [
            { status: 'pending', nextAttemptAt: { lte: now } },
            { status: 'processing', lockedUntil: { lte: now } },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: batchSize,
      });

      const claimed: ClaimedOutboxRow[] = [];
      const leaseExpiry = new Date(Date.now() + leaseDurationMs);
      for (const cand of candidates || []) {
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
            retryCount: Number(cand.retryCount ?? 0) + 1,
          },
        });
        if (Number(res?.count || 0) === 1) {
          claimed.push({
            id: cand.id,
            aggregateType: cand.aggregateType,
            aggregateId: cand.aggregateId,
            eventType: cand.eventType,
            payload: cand.payload,
            retryCount: Number(cand.retryCount ?? 0) + 1,
            createdAt: cand.createdAt instanceof Date ? cand.createdAt : new Date(cand.createdAt),
          });
        }
      }
      return claimed;
    }

    return [];
  }

  private validateAndBuildEnvelopeData(row: ClaimedOutboxRow): {
    conversationId: string;
    messageId: string;
    sequenceNo: number;
    messageType: 'text' | 'voice_note';
    createdAt: string;
  } {
    const p = row.payload;
    if (!p || typeof p !== 'object') {
      throw new PermanentOutboxPayloadError('invalid_payload_empty');
    }
    const conversationId = String(p.conversationId || row.aggregateId || '').trim();
    const messageId = String(p.messageId || '').trim();
    const sequenceNo = Number(p.sequenceNo);
    const messageType = p.messageType === 'voice_note' ? 'voice_note' : p.messageType === 'text' ? 'text' : null;
    const createdAt = typeof p.createdAt === 'string' && p.createdAt ? p.createdAt : null;

    if (!conversationId || !messageId || !Number.isInteger(sequenceNo) || sequenceNo < 1 || !messageType || !createdAt) {
      throw new PermanentOutboxPayloadError('invalid_payload_fields');
    }

    return { conversationId, messageId, sequenceNo, messageType, createdAt };
  }

  private async resolveEligibleRecipients(
    conversationId: string,
  ): Promise<{ eligible: boolean; participantAccountIds: string[] }> {
    const prismaAny = this.prisma as any;
    if (typeof prismaAny?.conversation?.findUnique !== 'function') {
      return { eligible: true, participantAccountIds: [] };
    }

    const conv = await prismaAny.conversation.findUnique({
      where: { id: conversationId },
      include: { match: true },
    });

    const match = conv?.match || null;
    if (!conv || conv.status !== 'active' || !match || match.status !== 'active') {
      return { eligible: false, participantAccountIds: [] };
    }

    const participants = [match.userLowId, match.userHighId].filter(Boolean);
    const blocked = await this.matchAuth.hasBidirectionalBlock(
      this.prisma,
      match.userLowId,
      match.userHighId,
    );
    if (blocked) {
      return { eligible: false, participantAccountIds: [] };
    }

    const activeAccounts = await this.matchAuth.verifyParticipantAccountsActive(
      this.prisma,
      participants,
    );
    if (!activeAccounts) {
      return { eligible: false, participantAccountIds: [] };
    }

    return { eligible: true, participantAccountIds: participants };
  }

  private computeNextBackoffMs(attempt: number): number {
    const base = this.getBaseBackoffMs();
    const maxMs = this.getMaxBackoffMs();
    const exp = Math.min(maxMs, base * Math.pow(2, Math.max(0, attempt - 1)));
    const jitter = Math.floor(Math.random() * Math.max(10, Math.round(exp * 0.2)));
    return Math.min(maxMs, Math.floor(exp + jitter));
  }

  private async relaySingleEvent(
    row: ClaimedOutboxRow,
  ): Promise<'published' | 'retried' | 'failed' | 'suppressed'> {
    const startedAt = Date.now();
    const prismaAny = this.prisma as any;

    try {
      const eventData = this.validateAndBuildEnvelopeData(row);
      const { eligible, participantAccountIds } = await this.resolveEligibleRecipients(
        eventData.conversationId,
      );

      if (!eligible) {
        const now = new Date();
        await prismaAny.outboxEvent.updateMany({
          where: { id: row.id, lockedBy: this.workerId },
          data: {
            status: 'suppressed',
            lastErrorCode: 'connection_closed',
            lastErrorAt: now,
            processedAt: now,
            lockedBy: null,
            lockedUntil: null,
          },
        });
        this.logStructured({
          eventId: row.id,
          eventType: row.eventType,
          attempt: row.retryCount,
          status: 'suppressed',
          retryCategory: 'authorization_closed',
          durationMs: Date.now() - startedAt,
        });
        return 'suppressed';
      }

      await this.eventBus.publishConversationEventReliable(
        eventData.conversationId,
        row.eventType as any,
        eventData,
        {
          eventId: row.id,
          occurredAt: eventData.createdAt,
          version: eventData.sequenceNo,
          recipientAccountIds: participantAccountIds,
        },
      );

      const now = new Date();
      const updated = await prismaAny.outboxEvent.updateMany({
        where: { id: row.id, lockedBy: this.workerId },
        data: {
          status: 'published',
          processedAt: now,
          lockedBy: null,
          lockedUntil: null,
          lastErrorCode: null,
        },
      });

      if (Number(updated?.count || 0) === 0) {
        this.logger.warn(
          JSON.stringify({
            component: 'OutboxRelay',
            workerId: this.workerId,
            eventId: row.id,
            status: 'lease_lost_after_publish',
          }),
        );
      }

      this.logStructured({
        eventId: row.id,
        eventType: row.eventType,
        attempt: row.retryCount,
        status: 'published',
        durationMs: Date.now() - startedAt,
      });
      return 'published';
    } catch (err: any) {
      const now = new Date();
      const isPermanent = err instanceof PermanentOutboxPayloadError;
      const maxAttempts = this.getMaxAttempts();
      const errorCode =
        err instanceof OutboxTransientPublishError
          ? err.errorCode
          : err instanceof PermanentOutboxPayloadError
            ? err.errorCode
            : 'transient_relay_error';

      const exhaustRetry = isPermanent || row.retryCount >= maxAttempts;

      if (exhaustRetry) {
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

        this.logStructured({
          eventId: row.id,
          eventType: row.eventType,
          attempt: row.retryCount,
          status: 'failed',
          retryCategory: isPermanent ? 'permanent_payload' : 'retries_exhausted',
          errorCode,
          durationMs: Date.now() - startedAt,
        });
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

      this.logStructured({
        eventId: row.id,
        eventType: row.eventType,
        attempt: row.retryCount,
        status: 'pending',
        retryCategory: 'transient_retry',
        errorCode,
        nextAttemptAt: nextAttemptAt.toISOString(),
        durationMs: Date.now() - startedAt,
      });
      return 'retried';
    }
  }

  private logStructured(fields: {
    eventId: string;
    eventType: string;
    attempt: number;
    status: string;
    retryCategory?: string;
    errorCode?: string;
    nextAttemptAt?: string;
    durationMs: number;
  }) {
    if (process.env.NODE_ENV === 'test' && process.env.OUTBOX_VERBOSE_LOGS !== 'true') {
      return;
    }
    this.logger.log(
      JSON.stringify({
        component: 'OutboxRelay',
        workerId: this.workerId,
        ...fields,
      }),
    );
  }
}
