import type { WebSocketEventEnvelope } from '@saymyname/contracts';

export const REALTIME_REDIS_CHANNEL = 'smn:realtime:events:v1';
export const WS_TICKET_TTL_SECONDS = 45;
export const WS_HANDSHAKE_TIMEOUT_MS = 5000;

export type OutboxRelayStatus =
  | 'pending'
  | 'processing'
  | 'published'
  | 'failed'
  | 'suppressed';

export type InternalRealtimeBusMessage =
  | {
      kind: 'conversation_event';
      originInstanceId: string;
      conversationId: string;
      recipientAccountIds?: string[];
      envelope: WebSocketEventEnvelope<any>;
    }
  | {
      kind: 'match_ended';
      originInstanceId: string;
      conversationId: string;
      matchId?: string;
      participantAccountIds: string[];
      reason: 'connection_ended' | 'connection_unavailable';
    }
  | {
      kind: 'account_revoked';
      originInstanceId: string;
      accountId: string;
    }
  | {
      kind: 'call_eviction_queued';
      originInstanceId: string;
      callSessionId?: string;
    };
