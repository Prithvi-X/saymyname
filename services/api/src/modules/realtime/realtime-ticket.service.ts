import {
  Injectable,
  ForbiddenException,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchAuthorizationService } from '../safety/match-authorization.service';
import { WS_TICKET_TTL_SECONDS } from './realtime.types';

interface StoredTicketRecord {
  accountId: string;
  expiresAtMs: number;
}

@Injectable()
export class RealtimeTicketService implements OnModuleDestroy {
  private readonly logger = new Logger(RealtimeTicketService.name);
  private redis: Redis | null = null;
  private readonly memoryTickets = new Map<string, StoredTicketRecord>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly matchAuth: MatchAuthorizationService,
  ) {
    this.initRedisClient();
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

  private initRedisClient() {
    const url = this.resolveRedisUrl();
    if (!url) return;

    try {
      this.redis = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        retryStrategy: (times) => (times <= 3 ? Math.min(times * 250, 1000) : null),
      });
      this.redis.on('error', () => {
        // Logged sparingly without credentials; fallback ensures unit/offline resiliency
      });
    } catch {
      this.redis = null;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit().catch(() => null);
      this.redis = null;
    }
  }

  private hashTicket(ticket: string): string {
    return crypto.createHash('sha256').update(ticket, 'utf8').digest('hex');
  }

  private sweepExpiredMemoryTickets() {
    const now = Date.now();
    for (const [k, rec] of this.memoryTickets.entries()) {
      if (rec.expiresAtMs <= now) {
        this.memoryTickets.delete(k);
      }
    }
  }

  async issueTicket(accountId: string): Promise<{
    ticket: string;
    wsPath: string;
    expiresInSeconds: number;
  }> {
    const isActive = await this.matchAuth.verifyParticipantAccountsActive(
      this.prisma,
      [accountId],
    );
    if (!isActive) {
      throw new ForbiddenException(
        'Your account is currently not eligible for realtime messaging.',
      );
    }

    const ticket = `smn_wst_${crypto.randomBytes(24).toString('base64url')}`;
    const ticketHash = this.hashTicket(ticket);
    const payload: StoredTicketRecord = {
      accountId,
      expiresAtMs: Date.now() + WS_TICKET_TTL_SECONDS * 1000,
    };

    if (this.redis) {
      try {
        if (this.redis.status === 'wait') {
          await this.redis.connect();
        }
        await this.redis.set(
          `smn:wst:${ticketHash}`,
          JSON.stringify(payload),
          'PX',
          WS_TICKET_TTL_SECONDS * 1000,
        );
        return {
          ticket,
          wsPath: '/ws/messaging',
          expiresInSeconds: WS_TICKET_TTL_SECONDS,
        };
      } catch {
        this.logger.warn('Redis ticket write unavailable; falling back to single-instance ticket store.');
      }
    }

    this.sweepExpiredMemoryTickets();
    this.memoryTickets.set(ticketHash, payload);

    return {
      ticket,
      wsPath: '/ws/messaging',
      expiresInSeconds: WS_TICKET_TTL_SECONDS,
    };
  }

  async consumeTicket(ticket: unknown): Promise<{ accountId: string } | null> {
    if (typeof ticket !== 'string' || !ticket.startsWith('smn_wst_') || ticket.length > 160) {
      return null;
    }

    const ticketHash = this.hashTicket(ticket);
    let record: StoredTicketRecord | null = null;

    if (this.redis) {
      try {
        if (this.redis.status === 'wait') {
          await this.redis.connect();
        }
        const redisKey = `smn:wst:${ticketHash}`;
        let raw: string | null = null;
        if (typeof (this.redis as any).getdel === 'function') {
          raw = await (this.redis as any).getdel(redisKey);
        } else {
          const txRes = await this.redis.multi().get(redisKey).del(redisKey).exec();
          raw = (txRes?.[0]?.[1] as string | null) ?? null;
        }
        if (raw) {
          record = JSON.parse(raw);
        }
      } catch {
        // Fallback to memory store below if Redis became temporarily unreachable
      }
    }

    if (!record) {
      this.sweepExpiredMemoryTickets();
      const mem = this.memoryTickets.get(ticketHash) || null;
      if (mem) {
        // Atomic single-use deletion before returning
        this.memoryTickets.delete(ticketHash);
        record = mem;
      }
    }

    if (!record || !record.accountId || record.expiresAtMs <= Date.now()) {
      return null;
    }

    const stillEligible = await this.matchAuth.verifyParticipantAccountsActive(
      this.prisma,
      [record.accountId],
    );
    if (!stillEligible) {
      return null;
    }

    return { accountId: record.accountId };
  }
}
