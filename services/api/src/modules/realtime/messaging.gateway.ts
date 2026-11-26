import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import type { IncomingMessage } from 'http';
import * as crypto from 'crypto';
import WebSocket from 'ws';
import type { WebSocketEventEnvelope } from '@saymyname/contracts';
import { MatchAuthorizationService } from '../safety/match-authorization.service';
import { RealtimeTicketService } from './realtime-ticket.service';
import { RealtimeEventBusService } from './realtime-event-bus.service';
import {
  InternalRealtimeBusMessage,
  WS_HANDSHAKE_TIMEOUT_MS,
} from './realtime.types';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_WS_FRAME_BYTES = 8192;

interface ClientSocketState {
  authenticated: boolean;
  accountId: string | null;
  subscriptions: Set<string>;
  authTimer: NodeJS.Timeout | null;
}

@WebSocketGateway({ path: '/ws/messaging' })
export class MessagingGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  private readonly logger = new Logger(MessagingGateway.name);
  private readonly clients = new Map<WebSocket, ClientSocketState>();
  private readonly accountSockets = new Map<string, Set<WebSocket>>();
  private readonly conversationRooms = new Map<string, Set<WebSocket>>();
  private unsubscribeBus: (() => void) | null = null;

  constructor(
    private readonly matchAuth: MatchAuthorizationService,
    private readonly ticketService: RealtimeTicketService,
    private readonly eventBus: RealtimeEventBusService,
  ) {}

  onModuleInit() {
    this.unsubscribeBus = this.eventBus.subscribe((msg) => {
      this.handleBusMessage(msg);
    });
  }

  onModuleDestroy() {
    if (this.unsubscribeBus) {
      this.unsubscribeBus();
      this.unsubscribeBus = null;
    }
    for (const [socket, state] of this.clients.entries()) {
      if (state.authTimer) clearTimeout(state.authTimer);
      try {
        socket.close(1001, 'Server shutting down');
      } catch {}
    }
    this.clients.clear();
    this.accountSockets.clear();
    this.conversationRooms.clear();
  }

  handleConnection(client: WebSocket, req?: IncomingMessage) {
    // Reject credentials/tickets passed via URL query strings (Part 07 §7.3 #7)
    const rawUrl = req?.url || '';
    if (/([?&])(ticket|token|accessToken|jwt)=/i.test(rawUrl)) {
      this.sendEnvelope(client, 'authorization.failed', {
        reason: 'credentials_in_url_forbidden',
      });
      client.close(4400, 'Tickets must be sent via authenticate frame');
      return;
    }

    const authTimer = setTimeout(() => {
      const current = this.clients.get(client);
      if (current && !current.authenticated) {
        this.sendEnvelope(client, 'authorization.failed', {
          reason: 'authentication_timeout',
        });
        client.close(4401, 'Authentication timeout');
      }
    }, WS_HANDSHAKE_TIMEOUT_MS);
    authTimer.unref?.();

    const state: ClientSocketState = {
      authenticated: false,
      accountId: null,
      subscriptions: new Set(),
      authTimer,
    };
    this.clients.set(client, state);

    client.on('message', (data) => {
      void this.onSocketMessage(client, data);
    });
  }

  handleDisconnect(client: WebSocket) {
    const state = this.clients.get(client);
    if (!state) return;
    if (state.authTimer) clearTimeout(state.authTimer);

    if (state.accountId) {
      const set = this.accountSockets.get(state.accountId);
      if (set) {
        set.delete(client);
        if (set.size === 0) this.accountSockets.delete(state.accountId);
      }
    }

    for (const convId of state.subscriptions) {
      const room = this.conversationRooms.get(convId);
      if (room) {
        room.delete(client);
        if (room.size === 0) this.conversationRooms.delete(convId);
      }
    }

    state.subscriptions.clear();
    this.clients.delete(client);
  }

  private async onSocketMessage(client: WebSocket, raw: WebSocket.RawData) {
    const state = this.clients.get(client);
    if (!state) return;

    const rawText = typeof raw === 'string' ? raw : raw.toString('utf8');
    if (Buffer.byteLength(rawText, 'utf8') > MAX_WS_FRAME_BYTES) {
      this.sendEnvelope(client, 'authorization.failed', {
        reason: 'frame_too_large',
      });
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return;
    }

    const eventName = String(parsed?.event || parsed?.eventType || '').trim();
    const payload = parsed?.data ?? parsed?.payload ?? {};

    if (eventName === 'authenticate') {
      if (state.authenticated) return;
      const ticket = payload?.ticket;
      const verified = await this.ticketService.consumeTicket(ticket);
      if (!verified) {
        this.sendEnvelope(client, 'authorization.failed', {
          reason: 'invalid_or_expired_ticket',
        });
        client.close(4401, 'Unauthorized');
        return;
      }

      if (state.authTimer) {
        clearTimeout(state.authTimer);
        state.authTimer = null;
      }
      state.authenticated = true;
      state.accountId = verified.accountId;

      if (!this.accountSockets.has(verified.accountId)) {
        this.accountSockets.set(verified.accountId, new Set());
      }
      this.accountSockets.get(verified.accountId)!.add(client);

      this.sendEnvelope(
        client,
        'connection.established',
        { heartbeatMs: 25000 },
        { type: 'session', id: crypto.randomUUID() },
      );
      return;
    }

    if (!state.authenticated || !state.accountId) {
      this.sendEnvelope(client, 'authorization.failed', {
        reason: 'unauthenticated',
      });
      client.close(4401, 'Authentication required');
      return;
    }

    if (eventName === 'ping') {
      this.sendEnvelope(client, 'pong', {});
      return;
    }

    if (eventName === 'conversation.subscribe') {
      const conversationId = String(payload?.conversationId || '').trim();
      if (!UUID_PATTERN.test(conversationId)) {
        this.sendEnvelope(
          client,
          'authorization.failed',
          { conversationId, reason: 'connection_unavailable' },
          { type: 'conversation', id: conversationId },
        );
        return;
      }

      try {
        await this.matchAuth.assertAuthorizedForConversation(
          state.accountId,
          conversationId,
        );
      } catch {
        this.leaveRoom(client, state, conversationId);
        this.sendEnvelope(
          client,
          'authorization.failed',
          { conversationId, reason: 'connection_unavailable' },
          { type: 'conversation', id: conversationId },
        );
        return;
      }

      if (!this.conversationRooms.has(conversationId)) {
        this.conversationRooms.set(conversationId, new Set());
      }
      this.conversationRooms.get(conversationId)!.add(client);
      state.subscriptions.add(conversationId);

      this.sendEnvelope(
        client,
        'conversation.subscribed',
        { conversationId },
        { type: 'conversation', id: conversationId },
      );
      return;
    }

    if (eventName === 'conversation.unsubscribe') {
      const conversationId = String(payload?.conversationId || '').trim();
      if (conversationId) {
        this.leaveRoom(client, state, conversationId);
        this.sendEnvelope(
          client,
          'conversation.unsubscribed',
          { conversationId },
          { type: 'conversation', id: conversationId },
        );
      }
    }
  }

  private leaveRoom(client: WebSocket, state: ClientSocketState, conversationId: string) {
    state.subscriptions.delete(conversationId);
    const room = this.conversationRooms.get(conversationId);
    if (room) {
      room.delete(client);
      if (room.size === 0) this.conversationRooms.delete(conversationId);
    }
  }

  private handleBusMessage(msg: InternalRealtimeBusMessage) {
    if (msg.kind === 'conversation_event') {
      const deliveredTo = new Set<WebSocket>();
      const room = this.conversationRooms.get(msg.conversationId);
      if (room) {
        for (const sock of room) {
          if (!deliveredTo.has(sock)) {
            deliveredTo.add(sock);
            this.sendRawEnvelope(sock, msg.envelope);
          }
        }
      }
      if (Array.isArray(msg.recipientAccountIds)) {
        for (const accId of msg.recipientAccountIds) {
          const socks = this.accountSockets.get(accId);
          if (!socks) continue;
          for (const sock of socks) {
            if (!deliveredTo.has(sock)) {
              deliveredTo.add(sock);
              this.sendRawEnvelope(sock, msg.envelope);
            }
          }
        }
      }
      return;
    }

    if (msg.kind === 'match_ended') {
      const notified = new Set<WebSocket>();
      const room = this.conversationRooms.get(msg.conversationId);
      const affected = new Set<WebSocket>();

      if (room) {
        for (const sock of room) affected.add(sock);
      }
      for (const accId of msg.participantAccountIds) {
        const socks = this.accountSockets.get(accId);
        if (socks) {
          for (const sock of socks) affected.add(sock);
        }
      }

      for (const sock of affected) {
        const st = this.clients.get(sock);
        if (st) {
          this.leaveRoom(sock, st, msg.conversationId);
        }
        if (!notified.has(sock)) {
          notified.add(sock);
          this.sendEnvelope(
            sock,
            'conversation.closed',
            {
              conversationId: msg.conversationId,
              reason: msg.reason,
            },
            { type: 'conversation', id: msg.conversationId },
          );
        }
      }
      this.conversationRooms.delete(msg.conversationId);
      return;
    }

    if (msg.kind === 'account_revoked') {
      const socks = this.accountSockets.get(msg.accountId);
      if (!socks) return;
      for (const sock of Array.from(socks)) {
        this.sendEnvelope(
          sock,
          'access.revoked',
          { reason: 'account_unavailable' },
          { type: 'account', id: msg.accountId },
        );
        try {
          sock.close(4403, 'Access revoked');
        } catch {}
      }
    }
  }

  private sendEnvelope<T>(
    client: WebSocket,
    eventType: WebSocketEventEnvelope<T>['eventType'],
    data: T,
    aggregate?: WebSocketEventEnvelope<T>['aggregate'],
  ) {
    this.sendRawEnvelope(client, {
      eventId: crypto.randomUUID(),
      eventType,
      schemaVersion: 1,
      occurredAt: new Date().toISOString(),
      ...(aggregate ? { aggregate } : {}),
      data,
    });
  }

  private sendRawEnvelope(client: WebSocket, envelope: WebSocketEventEnvelope<any>) {
    if (client.readyState !== WebSocket.OPEN) return;
    try {
      client.send(JSON.stringify(envelope));
    } catch {
      this.logger.debug('Skipped send on closing WebSocket client');
    }
  }
}
