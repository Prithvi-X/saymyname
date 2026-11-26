import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import type { WebSocketEventEnvelope } from '@saymyname/contracts';
import {
  InternalRealtimeBusMessage,
  REALTIME_REDIS_CHANNEL,
} from './realtime.types';

export type RealtimeListener = (msg: InternalRealtimeBusMessage) => void;
export type RealtimeBusFaultMode = 'none' | 'fail_publish';

export class OutboxTransientPublishError extends Error {
  constructor(
    public readonly errorCode: string,
    message?: string,
  ) {
    super(message || errorCode);
    this.name = 'OutboxTransientPublishError';
  }
}

@Injectable()
export class RealtimeEventBusService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeEventBusService.name);
  private readonly instanceId = crypto.randomUUID();
  private readonly localEmitter = new EventEmitter();
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private faultMode: RealtimeBusFaultMode = 'none';

  constructor() {
    this.localEmitter.setMaxListeners(100);
    this.initRedisPubSub();
  }

  setFaultInjectionForTesting(mode: RealtimeBusFaultMode) {
    if (process.env.NODE_ENV === 'production') return;
    this.faultMode = mode;
  }

  isRedisConfigured(): boolean {
    return this.resolveRedisUrl() !== null;
  }

  private resolveRedisUrl(): string | null {
    if (process.env.DISABLE_REDIS === 'true' || process.env.NODE_ENV === 'test') {
      return process.env.FORCE_TEST_REDIS === 'true'
        ? process.env.REDIS_URL || 'redis://127.0.0.1:6379'
        : null;
    }
    if (process.env.REDIS_URL && process.env.REDIS_URL.trim().length > 0) {
      return process.env.REDIS_URL.trim();
    }
    if (process.env.REDIS_HOST) {
      const port = process.env.REDIS_PORT || '6379';
      return `redis://${process.env.REDIS_HOST}:${port}`;
    }
    return null;
  }

  private initRedisPubSub() {
    const url = this.resolveRedisUrl();
    if (!url) return;

    try {
      const opts = {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        // Persistent bounded retry allows automatic recovery after transient Redis outages
        retryStrategy: (times: number) => Math.min(times * 400, 4000),
      };
      this.pubClient = new Redis(url, opts);
      this.subClient = new Redis(url, opts);
      this.pubClient.on('error', () => {});
      this.subClient.on('error', () => {});

      this.subClient.on('ready', () => {
        void this.subClient?.subscribe(REALTIME_REDIS_CHANNEL).catch(() => null);
      });

      this.subClient.on('message', (channel, raw) => {
        if (channel !== REALTIME_REDIS_CHANNEL) return;
        try {
          const parsed = JSON.parse(raw) as InternalRealtimeBusMessage;
          if (!parsed || parsed.originInstanceId === this.instanceId) {
            return;
          }
          this.localEmitter.emit('event', parsed);
        } catch {
          // Ignore malformed pubsub payload cleanly
        }
      });

      this.subClient
        .connect()
        .then(() => this.subClient?.subscribe(REALTIME_REDIS_CHANNEL))
        .catch(() => {
          this.logger.warn('Redis subscriber unavailable at startup; retrying in background.');
        });

      this.pubClient.connect().catch(() => {
        this.logger.warn('Redis publisher unavailable at startup; retrying in background.');
      });
    } catch {
      this.pubClient = null;
      this.subClient = null;
    }
  }

  async onModuleDestroy() {
    if (this.subClient) {
      await this.subClient.quit().catch(() => null);
      this.subClient = null;
    }
    if (this.pubClient) {
      await this.pubClient.quit().catch(() => null);
      this.pubClient = null;
    }
  }

  subscribe(listener: RealtimeListener): () => void {
    this.localEmitter.on('event', listener);
    return () => {
      this.localEmitter.off('event', listener);
    };
  }

  private async ensurePubClientReady(client: Redis): Promise<void> {
    if (client.status === 'ready') return;
    if (client.status === 'wait') {
      await Promise.race([
        client.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new OutboxTransientPublishError('redis_connect_timeout')), 1500),
        ),
      ]);
      if ((client.status as string) === 'ready') return;
    }
    // Briefly wait if ioredis is actively connecting/reconnecting
    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        cleanup();
        resolve();
      };
      const onErr = () => {
        cleanup();
        reject(new OutboxTransientPublishError('redis_unavailable'));
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new OutboxTransientPublishError('redis_unavailable'));
      }, 1500);
      const cleanup = () => {
        clearTimeout(timer);
        client.off('ready', onReady);
        client.off('error', onErr);
      };
      client.on('ready', onReady);
      client.on('error', onErr);
    });
  }

  private dispatch(msg: InternalRealtimeBusMessage) {
    this.localEmitter.emit('event', msg);
    if (this.pubClient) {
      const publish = async () => {
        if (!this.pubClient) return;
        await this.ensurePubClientReady(this.pubClient);
        await this.pubClient.publish(REALTIME_REDIS_CHANNEL, JSON.stringify(msg));
      };
      void publish().catch(() => null);
    }
  }

  /**
   * Reliable outbox publisher: awaits Redis PUBLISH confirmation when Redis is configured,
   * throwing OutboxTransientPublishError on connectivity/publish failures so the relay retries cleanly.
   */
  async publishEnvelopeReliable(msg: InternalRealtimeBusMessage): Promise<void> {
    if (this.faultMode === 'fail_publish') {
      throw new OutboxTransientPublishError('redis_publish_fault_injected');
    }

    if (this.pubClient) {
      try {
        await this.ensurePubClientReady(this.pubClient);
        await this.pubClient.publish(REALTIME_REDIS_CHANNEL, JSON.stringify(msg));
      } catch (err: any) {
        if (err instanceof OutboxTransientPublishError) throw err;
        throw new OutboxTransientPublishError('redis_publish_failed');
      }
    }

    this.localEmitter.emit('event', msg);
  }

  publishConversationEvent<T>(
    conversationId: string,
    eventType: WebSocketEventEnvelope<T>['eventType'],
    data: T,
    options?: { recipientAccountIds?: string[]; version?: number; eventId?: string },
  ) {
    const envelope: WebSocketEventEnvelope<T> = {
      eventId: options?.eventId || crypto.randomUUID(),
      eventType,
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregate: {
        type: 'conversation',
        id: conversationId,
        ...(typeof options?.version === 'number' ? { version: options.version } : {}),
      },
      data,
    };

    this.dispatch({
      kind: 'conversation_event',
      originInstanceId: this.instanceId,
      conversationId,
      recipientAccountIds: options?.recipientAccountIds,
      envelope,
    });
  }

  async publishConversationEventReliable<T>(
    conversationId: string,
    eventType: WebSocketEventEnvelope<T>['eventType'],
    data: T,
    options?: {
      recipientAccountIds?: string[];
      version?: number;
      eventId?: string;
      occurredAt?: string;
    },
  ): Promise<void> {
    const envelope: WebSocketEventEnvelope<T> = {
      eventId: options?.eventId || crypto.randomUUID(),
      eventType,
      schemaVersion: 1,
      occurredAt: options?.occurredAt || new Date().toISOString(),
      aggregate: {
        type: 'conversation',
        id: conversationId,
        ...(typeof options?.version === 'number' ? { version: options.version } : {}),
      },
      data,
    };

    await this.publishEnvelopeReliable({
      kind: 'conversation_event',
      originInstanceId: this.instanceId,
      conversationId,
      recipientAccountIds: options?.recipientAccountIds,
      envelope,
    });
  }

  publishMatchEnded(params: {
    matchId?: string;
    conversationId: string;
    participantAccountIds: string[];
    reason: 'connection_ended' | 'connection_unavailable';
  }) {
    this.dispatch({
      kind: 'match_ended',
      originInstanceId: this.instanceId,
      conversationId: params.conversationId,
      matchId: params.matchId,
      participantAccountIds: params.participantAccountIds,
      reason: params.reason,
    });
  }

  publishAccountRevoked(accountId: string) {
    this.dispatch({
      kind: 'account_revoked',
      originInstanceId: this.instanceId,
      accountId,
    });
  }

  notifyCallEvictionQueued(callSessionId?: string) {
    this.dispatch({
      kind: 'call_eviction_queued',
      originInstanceId: this.instanceId,
      callSessionId,
    });
  }
}
