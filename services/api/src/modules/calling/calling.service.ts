import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../identity/security/crypto.service';
import { MatchAuthorizationService } from '../safety/match-authorization.service';
import { RealtimeEventBusService } from '../realtime/realtime-event-bus.service';
import {
  CallStatus,
  CallSessionDto,
  CallInviteResponseDto,
  CallTokenResponseDto,
  CallRealtimeEventData,
} from '@saymyname/contracts';
import {
  CallInviteDto,
  CallRespondDto,
  CallStateTransitionDto,
} from './dto/calling.dto';
import {
  assertCallStatusTransition,
  isJoinableCallStatus,
  isTerminalCallStatus,
  NON_TERMINAL_CALL_STATUSES,
  normalizeCallStatus,
} from './calling-state-machine';
import {
  CallingProviderUnavailableError,
  LiveKitProviderAdapter,
} from './livekit-provider.adapter';
import * as crypto from 'crypto';

interface MockCallSession {
  id: string;
  conversationId: string;
  callerId: string;
  receiverId: string;
  callStatus: CallStatus;
  livekitRoomId: string;
  startedAt?: Date | null;
  expiresAt?: Date | null;
  endedAt?: Date | null;
  endedReason?: string | null;
  endedByAccountId?: string | null;
  durationSeconds?: number | null;
  evictionStatus?: string | null;
  createdAt: Date;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PENDING_INVITE_STATUSES = ['inviting', 'initiated', 'ringing'];
const NON_TERMINAL_STATUS_ARRAY = Array.from(NON_TERMINAL_CALL_STATUSES);

function resolveInviteTtlSeconds(): number {
  const raw = Number(process.env.CALL_INVITE_TTL_SECONDS || 45);
  if (!Number.isFinite(raw) || raw <= 0) return 45;
  return Math.min(90, Math.max(15, Math.floor(raw)));
}

@Injectable()
export class CallingService {
  private readonly mockCallSessions: Map<string, MockCallSession> = new Map();
  private readonly matchAuth: MatchAuthorizationService;
  private readonly livekitProvider: LiveKitProviderAdapter;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    @Optional() matchAuthService?: MatchAuthorizationService,
    @Optional() livekitProvider?: LiveKitProviderAdapter,
    @Optional() private readonly realtimeEventBus?: RealtimeEventBusService,
  ) {
    void this.cryptoService;
    this.matchAuth = matchAuthService ?? new MatchAuthorizationService(this.prisma);
    this.livekitProvider = livekitProvider ?? new LiveKitProviderAdapter();
  }

  private async runInTx<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const prismaAny = this.prisma as any;
    if (typeof prismaAny?.$transaction === 'function') {
      return prismaAny.$transaction((tx: any) => fn(tx));
    }
    return fn(prismaAny);
  }

  private hasDbCallSessions(db: any = this.prisma): boolean {
    return (
      typeof db?.callSession?.create === 'function' &&
      typeof db?.callSession?.findUnique === 'function'
    );
  }

  private async lockConversationForCall(tx: any, conversationId: string): Promise<void> {
    if (typeof tx?.$queryRaw !== 'function' || !UUID_PATTERN.test(conversationId)) {
      return;
    }
    await tx.$queryRaw`SELECT id::text AS id FROM messaging.conversations WHERE id = ${conversationId}::uuid FOR UPDATE`;
  }

  private mapToDto(session: any): CallSessionDto {
    return {
      id: session.id,
      conversationId: session.conversationId,
      callerId: session.callerId,
      receiverId: session.receiverId,
      callStatus: normalizeCallStatus(session.callStatus) as CallStatus,
      livekitRoomId: session.livekitRoomId,
      callType: 'audio',
      startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : null,
      expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : null,
      endedAt: session.endedAt ? new Date(session.endedAt).toISOString() : null,
      endedReason: session.endedReason ?? null,
      durationSeconds: session.durationSeconds ?? 0,
      evictionStatus: session.evictionStatus ?? 'not_required',
    };
  }

  private emitCallSignal(
    eventType: 'call.invited' | 'call.accepted' | 'call.state_changed' | 'call.ended',
    session: {
      id: string;
      conversationId: string;
      callerId: string;
      receiverId: string;
      callStatus: string;
      endedReason?: string | null;
      expiresAt?: Date | string | null;
    },
  ): void {
    if (!this.realtimeEventBus) return;
    const payload: CallRealtimeEventData = {
      callSessionId: session.id,
      conversationId: session.conversationId,
      status: normalizeCallStatus(session.callStatus),
      callType: 'audio',
      endedReason: session.endedReason ?? null,
      expiresAt: session.expiresAt ? new Date(session.expiresAt).toISOString() : null,
      occurredAt: new Date().toISOString(),
    };
    this.realtimeEventBus.publishConversationEvent(session.conversationId, eventType, payload, {
      recipientAccountIds: [session.callerId, session.receiverId],
    });
  }

  private async expireStaleInvitesInConversation(
    db: any,
    conversationId: string,
    now: Date,
  ): Promise<MockCallSession[]> {
    const expired: MockCallSession[] = [];
    if (this.hasDbCallSessions(db) && typeof db.callSession?.findMany === 'function') {
      const candidates = await db.callSession.findMany({
        where: {
          conversationId,
          callStatus: { in: PENDING_INVITE_STATUSES },
          expiresAt: { lte: now },
        },
      });
      for (const item of candidates) {
        if (typeof db.callSession?.update === 'function') {
          const updated = await db.callSession.update({
            where: { id: item.id },
            data: {
              callStatus: CallStatus.MISSED,
              endedAt: now,
              endedReason: 'invite_timeout',
              evictionStatus: 'completed',
              evictedAt: now,
            },
          });
          expired.push(updated);
        }
      }
      return expired;
    }

    for (const s of this.mockCallSessions.values()) {
      if (
        s.conversationId === conversationId &&
        PENDING_INVITE_STATUSES.includes(String(s.callStatus)) &&
        s.expiresAt &&
        new Date(s.expiresAt).getTime() <= now.getTime()
      ) {
        s.callStatus = CallStatus.MISSED;
        s.endedAt = now;
        s.endedReason = 'invite_timeout';
        s.evictionStatus = 'completed';
        expired.push(s);
      }
    }
    return expired;
  }

  private async markSessionFailedProviderUnavailable(sessionId: string): Promise<void> {
    const now = new Date();
    if (this.hasDbCallSessions() && typeof (this.prisma as any).callSession?.update === 'function') {
      await (this.prisma as any).callSession
        .update({
          where: { id: sessionId },
          data: {
            callStatus: CallStatus.FAILED,
            endedAt: now,
            endedReason: 'provider_unavailable',
          },
        })
        .catch(() => null);
      return;
    }
    const existing = this.mockCallSessions.get(sessionId);
    if (existing) {
      existing.callStatus = CallStatus.FAILED;
      existing.endedAt = now;
      existing.endedReason = 'provider_unavailable';
    }
  }

  private async markInviteExpiredSingle(session: MockCallSession, now: Date): Promise<void> {
    if (this.hasDbCallSessions() && typeof (this.prisma as any).callSession?.update === 'function') {
      await (this.prisma as any).callSession
        .update({
          where: { id: session.id },
          data: {
            callStatus: CallStatus.MISSED,
            endedAt: now,
            endedReason: 'invite_timeout',
            evictionStatus: 'completed',
            evictedAt: now,
          },
        })
        .catch(() => null);
    } else {
      session.callStatus = CallStatus.MISSED;
      session.endedAt = now;
      session.endedReason = 'invite_timeout';
      session.evictionStatus = 'completed';
    }
    this.emitCallSignal('call.ended', {
      ...session,
      callStatus: CallStatus.MISSED,
      endedReason: 'invite_timeout',
    });
    void this.livekitProvider.deleteRoom(session.livekitRoomId).catch(() => null);
  }

  private async loadCallSession(db: any, callId: string): Promise<MockCallSession | null> {
    if (this.hasDbCallSessions(db)) {
      return db.callSession.findUnique({ where: { id: callId } });
    }
    return this.mockCallSessions.get(callId) ?? null;
  }

  /**
   * Initiates a 1:1 audio-only call invitation after verifying active mutual match & eligibility.
   * Never issues a LiveKit room join token before explicit recipient acceptance.
   */
  async inviteCall(userId: string, dto: CallInviteDto): Promise<CallInviteResponseDto> {
    if (!this.livekitProvider.isConfigured()) {
      throw new CallingProviderUnavailableError(
        'Audio calling provider credentials are not configured.',
      );
    }

    const callSessionId = crypto.randomUUID();
    const livekitRoomId = `smn_call_${crypto.randomBytes(16).toString('hex')}`;
    const inviteTtlSeconds = resolveInviteTtlSeconds();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + inviteTtlSeconds * 1000);

    let expiredOutside: MockCallSession[] = [];

    const sessionRecord = await this.runInTx(async (tx) => {
      await this.lockConversationForCall(tx, dto.conversationId);

      const auth = await this.matchAuth.assertAuthorizedForConversation(
        userId,
        dto.conversationId,
        { tx },
      );

      let receiverId = auth.partnerAccountId || '';
      if (!receiverId && auth.legacyUnitMock) {
        receiverId =
          userId === 'a1111111-1111-1111-1111-111111111111'
            ? 'a2222222-2222-2222-2222-222222222222'
            : 'a1111111-1111-1111-1111-111111111111';
      }
      if (!receiverId || receiverId === userId) {
        throw new ForbiddenException('Call recipient could not be authorized for this match.');
      }

      expiredOutside = await this.expireStaleInvitesInConversation(tx, dto.conversationId, now);

      if (this.hasDbCallSessions(tx) && typeof tx?.callSession?.findFirst === 'function') {
        const activeExisting = await tx.callSession.findFirst({
          where: {
            conversationId: dto.conversationId,
            callStatus: { in: NON_TERMINAL_STATUS_ARRAY },
          },
        });
        if (activeExisting) {
          throw new ConflictException(
            'A call is already ringing or active in this conversation.',
          );
        }
      } else {
        const existingMock = Array.from(this.mockCallSessions.values()).find(
          (s) =>
            s.conversationId === dto.conversationId &&
            NON_TERMINAL_STATUS_ARRAY.includes(normalizeCallStatus(s.callStatus)),
        );
        if (existingMock) {
          throw new ConflictException(
            'A call is already ringing or active in this conversation.',
          );
        }
      }

      if (this.hasDbCallSessions(tx) && typeof tx?.callSession?.create === 'function') {
        const created = await tx.callSession.create({
          data: {
            id: callSessionId,
            conversationId: dto.conversationId,
            callerId: userId,
            receiverId,
            callStatus: CallStatus.INVITING,
            livekitRoomId,
            expiresAt,
            durationSeconds: 0,
            evictionStatus: 'not_required',
          },
        });
        return created as MockCallSession;
      }

      const mockRecord: MockCallSession = {
        id: callSessionId,
        conversationId: dto.conversationId,
        callerId: userId,
        receiverId,
        callStatus: CallStatus.INVITING,
        livekitRoomId,
        startedAt: null,
        expiresAt,
        endedAt: null,
        endedReason: null,
        endedByAccountId: null,
        durationSeconds: 0,
        evictionStatus: 'not_required',
        createdAt: now,
      };
      this.mockCallSessions.set(callSessionId, mockRecord);
      return mockRecord;
    });

    for (const exp of expiredOutside) {
      this.emitCallSignal('call.ended', exp);
    }

    try {
      await this.livekitProvider.ensureAudioRoom({
        roomId: livekitRoomId,
        emptyTimeoutSeconds: inviteTtlSeconds + 90,
        departureTimeoutSeconds: 30,
      });
    } catch (err) {
      await this.markSessionFailedProviderUnavailable(sessionRecord.id);
      if (err instanceof CallingProviderUnavailableError) {
        throw err;
      }
      throw new CallingProviderUnavailableError(
        'Audio calling service is temporarily unavailable.',
      );
    }

    this.emitCallSignal('call.invited', sessionRecord);

    return {
      callSession: this.mapToDto(sessionRecord),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Handles explicit call invitation responses: accept, decline, busy (recipient), or cancel (caller).
   * Issues a short-lived, audio-only LiveKit join token ONLY when accepted by the intended recipient.
   */
  async respondToCall(
    userId: string,
    callId: string,
    dto: CallRespondDto,
  ): Promise<CallTokenResponseDto> {
    const precheck = await this.loadCallSession(this.prisma, callId);
    if (!precheck) {
      throw new NotFoundException('Call session not found');
    }
    if (precheck.receiverId !== userId && precheck.callerId !== userId) {
      throw new ForbiddenException('You are not a participant in this call session');
    }

    const now = new Date();
    if (
      PENDING_INVITE_STATUSES.includes(normalizeCallStatus(precheck.callStatus)) &&
      precheck.expiresAt &&
      new Date(precheck.expiresAt).getTime() <= now.getTime()
    ) {
      await this.markInviteExpiredSingle(precheck, now);
      throw new ConflictException('Call invitation has expired.');
    }

    const txResult = await this.runInTx(async (tx) => {
      const dbMode = this.hasDbCallSessions(tx);
      const session = await this.loadCallSession(tx, callId);
      if (!session) {
        throw new NotFoundException('Call session not found');
      }
      if (session.receiverId !== userId && session.callerId !== userId) {
        throw new ForbiddenException('You are not a participant in this call session');
      }

      await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId, { tx });

      if (isTerminalCallStatus(session.callStatus)) {
        throw new ConflictException('Call invitation is no longer active.');
      }

      if (dto.action === 'accept') {
        if (session.receiverId !== userId) {
          throw new ForbiddenException('Only the invited recipient may accept this call.');
        }
        assertCallStatusTransition(session.callStatus, 'accepted');

        if (!this.livekitProvider.isConfigured()) {
          throw new CallingProviderUnavailableError(
            'Audio calling provider credentials are not configured.',
          );
        }

        const startedAt = new Date();
        if (dbMode && typeof tx.callSession?.update === 'function') {
          const updated = await tx.callSession.update({
            where: { id: session.id },
            data: { callStatus: CallStatus.ACCEPTED, startedAt },
          });
          return { kind: 'accepted' as const, session: updated };
        }
        session.callStatus = CallStatus.ACCEPTED;
        session.startedAt = startedAt;
        return { kind: 'accepted' as const, session };
      }

      if (dto.action === 'cancel') {
        if (session.callerId !== userId) {
          throw new ForbiddenException('Only the caller may cancel an unanswered invitation.');
        }
        if (!PENDING_INVITE_STATUSES.includes(normalizeCallStatus(session.callStatus))) {
          throw new ConflictException('Call has already been answered; use end call instead.');
        }

        const endedAt = new Date();
        if (dbMode && typeof tx.callSession?.update === 'function') {
          const updated = await tx.callSession.update({
            where: { id: session.id },
            data: {
              callStatus: CallStatus.ENDED,
              endedAt,
              endedReason: 'caller_cancelled',
              endedByAccountId: userId,
              durationSeconds: 0,
              evictionStatus: 'pending',
            },
          });
          return { kind: 'ended' as const, session: updated, status: CallStatus.ENDED };
        }
        session.callStatus = CallStatus.ENDED;
        session.endedAt = endedAt;
        session.endedReason = 'caller_cancelled';
        session.endedByAccountId = userId;
        session.durationSeconds = 0;
        session.evictionStatus = 'pending';
        return { kind: 'ended' as const, session, status: CallStatus.ENDED };
      }

      // decline / busy (recipient only)
      if (session.receiverId !== userId) {
        throw new ForbiddenException('Only the invited recipient may decline this call.');
      }
      assertCallStatusTransition(session.callStatus, 'rejected');

      const endedAt = new Date();
      const endedReason = dto.action === 'busy' ? 'recipient_busy' : 'declined';
      if (dbMode && typeof tx.callSession?.update === 'function') {
        const updated = await tx.callSession.update({
          where: { id: session.id },
          data: {
            callStatus: CallStatus.REJECTED,
            endedAt,
            endedReason,
            endedByAccountId: userId,
            evictionStatus: 'pending',
          },
        });
        return { kind: 'ended' as const, session: updated, status: CallStatus.REJECTED };
      }
      session.callStatus = CallStatus.REJECTED;
      session.endedAt = endedAt;
      session.endedReason = endedReason;
      session.endedByAccountId = userId;
      session.evictionStatus = 'pending';
      return { kind: 'ended' as const, session, status: CallStatus.REJECTED };
    });

    if (txResult.kind === 'ended') {
      void this.livekitProvider
        .evictSession({
          roomId: txResult.session.livekitRoomId,
          callSessionId: txResult.session.id,
          participantAccountIds: [txResult.session.callerId, txResult.session.receiverId],
        })
        .then(async (res) => {
          if (
            this.hasDbCallSessions() &&
            typeof (this.prisma as any).callSession?.update === 'function'
          ) {
            await (this.prisma as any).callSession
              .update({
                where: { id: txResult.session.id },
                data: { evictionStatus: res.outcome === 'evicted' ? 'completed' : 'already_absent', evictedAt: new Date() },
              })
              .catch(() => null);
          } else {
            txResult.session.evictionStatus = res.outcome === 'evicted' ? 'completed' : 'already_absent';
          }
        })
        .catch(() => null);

      this.emitCallSignal('call.ended', txResult.session);

      return {
        callSessionId: txResult.session.id,
        livekitRoomId: txResult.session.livekitRoomId,
        token: '',
        callStatus: txResult.status,
      };
    }

    try {
      await this.livekitProvider.ensureAudioRoom({
        roomId: txResult.session.livekitRoomId,
      });
      const issued = await this.livekitProvider.issueAudioJoinToken({
        roomId: txResult.session.livekitRoomId,
        callSessionId: txResult.session.id,
        accountId: userId,
      });

      this.emitCallSignal('call.accepted', txResult.session);

      return {
        callSessionId: txResult.session.id,
        livekitRoomId: txResult.session.livekitRoomId,
        token: issued.token,
        callStatus: CallStatus.ACCEPTED,
        livekitUrl: issued.livekitUrl,
        expiresAt: issued.expiresAt,
        participantIdentity: issued.participantIdentity,
      };
    } catch (err) {
      await this.markSessionFailedProviderUnavailable(txResult.session.id);
      this.emitCallSignal('call.ended', {
        ...txResult.session,
        callStatus: CallStatus.FAILED,
        endedReason: 'provider_unavailable',
      });
      if (err instanceof CallingProviderUnavailableError) {
        throw err;
      }
      throw new CallingProviderUnavailableError(
        'Audio calling provider failed while provisioning room join token.',
      );
    }
  }

  /**
   * Issues a fresh short-lived, audio-only join token for an accepted/active/reconnecting call.
   * Re-verifies participant membership, mutual match state, blocks, and account/verification eligibility.
   */
  async issueJoinToken(userId: string, callId: string): Promise<CallTokenResponseDto> {
    const session = await this.loadCallSession(this.prisma, callId);
    if (!session) {
      throw new NotFoundException('Call session not found');
    }
    if (session.callerId !== userId && session.receiverId !== userId) {
      throw new ForbiddenException('You are not a participant in this call session');
    }

    await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId);

    if (!isJoinableCallStatus(session.callStatus)) {
      throw new ConflictException(
        'Audio room tokens are only issued after the call has been accepted.',
      );
    }

    if (!this.livekitProvider.isConfigured()) {
      throw new CallingProviderUnavailableError(
        'Audio calling provider credentials are not configured.',
      );
    }

    await this.livekitProvider.ensureAudioRoom({
      roomId: session.livekitRoomId,
    });
    const issued = await this.livekitProvider.issueAudioJoinToken({
      roomId: session.livekitRoomId,
      callSessionId: session.id,
      accountId: userId,
    });

    return {
      callSessionId: session.id,
      livekitRoomId: session.livekitRoomId,
      token: issued.token,
      callStatus: normalizeCallStatus(session.callStatus) as CallStatus,
      livekitUrl: issued.livekitUrl,
      expiresAt: issued.expiresAt,
      participantIdentity: issued.participantIdentity,
    };
  }

  /**
   * Advances non-terminal call lifecycle state (ringing -> accepted -> connecting -> active <-> reconnecting).
   */
  async updateCallState(
    userId: string,
    callId: string,
    dto: CallStateTransitionDto,
  ): Promise<CallSessionDto> {
    const updated = await this.runInTx(async (tx) => {
      const dbMode = this.hasDbCallSessions(tx);
      const session = await this.loadCallSession(tx, callId);
      if (!session) {
        throw new NotFoundException('Call session not found');
      }
      if (session.callerId !== userId && session.receiverId !== userId) {
        throw new ForbiddenException('You are not a participant in this call session');
      }

      await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId, { tx });

      if (dto.state === 'ringing' && session.receiverId !== userId) {
        throw new ForbiddenException('Only the recipient device may confirm ringing state.');
      }

      assertCallStatusTransition(session.callStatus, dto.state);

      if (normalizeCallStatus(session.callStatus) === dto.state) {
        return session;
      }

      if (dbMode && typeof tx.callSession?.update === 'function') {
        return tx.callSession.update({
          where: { id: session.id },
          data: { callStatus: dto.state },
        });
      }

      session.callStatus = dto.state as CallStatus;
      return session;
    });

    this.emitCallSignal('call.state_changed', updated);
    return this.mapToDto(updated);
  }

  /**
   * Terminates active or ringing call, computes duration, broadcasts call.ended, and evicts SFU room.
   */
  async endCall(
    userId: string,
    callId: string,
  ): Promise<{ success: boolean; durationSeconds: number; callStatus: CallStatus }> {
    const dbMode = this.hasDbCallSessions();
    const session = await this.loadCallSession(this.prisma, callId);

    if (!session) {
      throw new NotFoundException('Call session not found');
    }

    if (session.callerId !== userId && session.receiverId !== userId) {
      throw new ForbiddenException('You are not a participant in this call session');
    }

    if (isTerminalCallStatus(session.callStatus)) {
      return {
        success: true,
        durationSeconds: session.durationSeconds ?? 0,
        callStatus: normalizeCallStatus(session.callStatus) as CallStatus,
      };
    }

    const endedAt = new Date();
    const durationSeconds = session.startedAt
      ? Math.max(1, Math.round((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000))
      : 0;
    const endedReason = session.startedAt
      ? 'hangup'
      : session.callerId === userId
        ? 'caller_cancelled'
        : 'ended';

    let updated: MockCallSession = session;
    if (dbMode && typeof (this.prisma as any).callSession?.update === 'function') {
      updated = await (this.prisma as any).callSession.update({
        where: { id: session.id },
        data: {
          callStatus: CallStatus.ENDED,
          endedAt,
          endedReason,
          endedByAccountId: userId,
          durationSeconds,
          evictionStatus: 'pending',
        },
      });
    } else {
      session.callStatus = CallStatus.ENDED;
      session.endedAt = endedAt;
      session.endedReason = endedReason;
      session.endedByAccountId = userId;
      session.durationSeconds = durationSeconds;
      session.evictionStatus = 'pending';
    }

    if (this.livekitProvider.isConfigured()) {
      await this.livekitProvider
        .evictSession({
          roomId: session.livekitRoomId,
          callSessionId: session.id,
          participantAccountIds: [session.callerId, session.receiverId],
        })
        .then(async (res) => {
          const evStatus = res.outcome === 'evicted' ? 'completed' : 'already_absent';
          if (dbMode && typeof (this.prisma as any).callSession?.update === 'function') {
            await (this.prisma as any).callSession
              .update({
                where: { id: session.id },
                data: { evictionStatus: evStatus, evictedAt: new Date() },
              })
              .catch(() => null);
          } else {
            updated.evictionStatus = evStatus;
          }
        })
        .catch(async () => {
          if (typeof (this.prisma as any).outboxEvent?.create === 'function') {
            await (this.prisma as any).outboxEvent
              .create({
                data: {
                  aggregateType: 'call_session',
                  aggregateId: session.id,
                  eventType: 'call.evict',
                  status: 'pending',
                  payload: {
                    callSessionId: session.id,
                    conversationId: session.conversationId,
                    livekitRoomId: session.livekitRoomId,
                    participantAccountIds: [session.callerId, session.receiverId],
                    reason: endedReason,
                    revokeTokenTs: Math.floor(endedAt.getTime() / 1000),
                  },
                },
              })
              .catch(() => null);
            this.realtimeEventBus?.notifyCallEvictionQueued(session.id);
          }
        });
    } else if (typeof (this.prisma as any).outboxEvent?.create === 'function') {
      await (this.prisma as any).outboxEvent
        .create({
          data: {
            aggregateType: 'call_session',
            aggregateId: session.id,
            eventType: 'call.evict',
            status: 'pending',
            payload: {
              callSessionId: session.id,
              conversationId: session.conversationId,
              livekitRoomId: session.livekitRoomId,
              participantAccountIds: [session.callerId, session.receiverId],
              reason: endedReason,
              revokeTokenTs: Math.floor(endedAt.getTime() / 1000),
            },
          },
        })
        .catch(() => null);
      this.realtimeEventBus?.notifyCallEvictionQueued(session.id);
    }

    this.emitCallSignal('call.ended', updated);

    return {
      success: true,
      durationSeconds,
      callStatus: CallStatus.ENDED,
    };
  }

  /**
   * Retrieves active or latest non-terminal call session in a conversation (if any).
   */
  async getActiveCallForConversation(
    userId: string,
    conversationId: string,
  ): Promise<{ activeCall: CallSessionDto | null }> {
    await this.matchAuth.assertAuthorizedForConversation(userId, conversationId);

    const now = new Date();
    const expired = await this.expireStaleInvitesInConversation(this.prisma, conversationId, now);
    for (const exp of expired) {
      this.emitCallSignal('call.ended', exp);
      if (this.livekitProvider.isConfigured()) {
        void this.livekitProvider.deleteRoom(exp.livekitRoomId).catch(() => null);
      }
    }

    if (this.hasDbCallSessions() && typeof (this.prisma as any).callSession?.findFirst === 'function') {
      const active = await (this.prisma as any).callSession.findFirst({
        where: {
          conversationId,
          callStatus: { in: NON_TERMINAL_STATUS_ARRAY },
        },
        orderBy: { createdAt: 'desc' },
      });
      return { activeCall: active ? this.mapToDto(active) : null };
    }

    const matches = Array.from(this.mockCallSessions.values())
      .filter(
        (s) =>
          s.conversationId === conversationId &&
          NON_TERMINAL_STATUS_ARRAY.includes(normalizeCallStatus(s.callStatus)),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return { activeCall: matches[0] ? this.mapToDto(matches[0]) : null };
  }

  /**
   * Retrieves call session status after participant & match authorization checks.
   */
  async getCallSession(userId: string, callId: string): Promise<CallSessionDto> {
    const session = await this.loadCallSession(this.prisma, callId);

    if (!session) {
      throw new NotFoundException('Call session not found');
    }

    if (session.callerId !== userId && session.receiverId !== userId) {
      throw new ForbiddenException('Not authorized to access this call session');
    }

    await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId);

    const now = new Date();
    if (
      PENDING_INVITE_STATUSES.includes(normalizeCallStatus(session.callStatus)) &&
      session.expiresAt &&
      new Date(session.expiresAt).getTime() <= now.getTime()
    ) {
      await this.markInviteExpiredSingle(session, now);
      const reloaded = await this.loadCallSession(this.prisma, callId);
      return this.mapToDto(reloaded ?? session);
    }

    return this.mapToDto(session);
  }
}
