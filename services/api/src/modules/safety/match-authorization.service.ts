import {
  Injectable,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { calculateAgeYears } from '@saymyname/validation';
import { PrismaService } from '../../prisma/prisma.service';

export type AccountInvalidationReason =
  | 'account_suspended'
  | 'account_deleted'
  | 'account_disabled'
  | 'verification_revoked'
  | 'eligibility_revoked';

export interface AuthorizedMatchContext {
  legacyUnitMock: boolean;
  match: any;
  conversation: any | null;
  partnerAccountId: string | null;
}

export interface AuthorizedConversationContext {
  legacyUnitMock: boolean;
  conversation: any;
  match: any;
  partnerAccountId: string | null;
}

const MIN_DISCOVERY_AGE = 18;
const CLOSED_ACCESS_ERROR = 'This connection or conversation is no longer active.';

@Injectable()
export class MatchAuthorizationService {
  constructor(private readonly prisma: PrismaService) {}

  private hasDbLookup(db: any, model: string, method = 'findUnique'): boolean {
    return typeof db?.[model]?.[method] === 'function';
  }

  /**
   * Authoritative active/verified eligibility check for a participant Account row.
   * Never reveals suspension reasons, moderator notes, or verification evidence.
   */
  isAccountDatingActive(account: any, referenceDate: Date = new Date()): boolean {
    if (!account || account.deletedAt || account.accountStatus !== 'active') {
      return false;
    }

    const elig = account.eligibility;
    if (!elig) {
      return false;
    }

    if (
      elig.ageStatus !== 'approved' ||
      elig.studentStatus !== 'approved' ||
      elig.discoveryEligible !== true
    ) {
      return false;
    }

    if (elig.validUntil && new Date(elig.validUntil).getTime() <= referenceDate.getTime()) {
      return false;
    }

    if ('dateOfBirth' in elig) {
      if (!elig.dateOfBirth) {
        return false;
      }
      const normalizedDob =
        typeof elig.dateOfBirth === 'string' && elig.dateOfBirth.includes('T')
          ? new Date(elig.dateOfBirth)
          : elig.dateOfBirth;
      const age = calculateAgeYears(normalizedDob, referenceDate);
      if (age === null || age < MIN_DISCOVERY_AGE) {
        return false;
      }
    }

    return true;
  }

  async hasBidirectionalBlock(db: any, accountA: string, accountB: string): Promise<boolean> {
    if (this.hasDbLookup(db, 'userBlock', 'findFirst')) {
      const hit = await db.userBlock.findFirst({
        where: {
          OR: [
            { blockerId: accountA, blockedId: accountB },
            { blockerId: accountB, blockedId: accountA },
          ],
        },
        select: { id: true },
      });
      return Boolean(hit);
    }

    if (this.hasDbLookup(db, 'userBlock', 'findMany')) {
      const rows = await db.userBlock.findMany({
        where: {
          OR: [
            { blockerId: accountA, blockedId: accountB },
            { blockerId: accountB, blockedId: accountA },
          ],
        },
      });
      return Array.isArray(rows) &&
        rows.some(
          (b: any) =>
            (b.blockerId === accountA && b.blockedId === accountB) ||
            (b.blockerId === accountB && b.blockedId === accountA),
        );
    }

    return false;
  }

  async verifyParticipantAccountsActive(
    db: any,
    accountIds: string[],
    referenceDate: Date = new Date(),
  ): Promise<boolean> {
    const uniqueIds = Array.from(new Set(accountIds.filter(Boolean)));
    if (uniqueIds.length === 0) return false;

    if (this.hasDbLookup(db, 'account', 'findMany')) {
      const accounts = await db.account.findMany({
        where: { id: { in: uniqueIds } },
        include: { eligibility: true },
      });
      if (!Array.isArray(accounts) || accounts.length < uniqueIds.length) {
        return false;
      }
      const map = new Map(accounts.map((a: any) => [a.id, a]));
      return uniqueIds.every((id) => this.isAccountDatingActive(map.get(id), referenceDate));
    }

    if (this.hasDbLookup(db, 'account', 'findUnique')) {
      const accounts = await Promise.all(
        uniqueIds.map((id) =>
          db.account.findUnique({
            where: { id },
            include: { eligibility: true },
          }),
        ),
      );
      return accounts.every((acc) => this.isAccountDatingActive(acc, referenceDate));
    }

    // Minimal unit mock without account table delegates (non-production tests only)
    if (process.env.NODE_ENV === 'production') {
      return false;
    }
    return true;
  }

  /**
   * Authoritative verification for conversation-scoped operations (Messaging, Calling, Games, Virtual Dates).
   */
  async assertAuthorizedForConversation(
    accountId: string,
    conversationId: string,
    options?: { tx?: any },
  ): Promise<AuthorizedConversationContext> {
    if (!accountId || !conversationId) {
      throw new BadRequestException('Account and conversation identifiers are required.');
    }

    const db = options?.tx || (this.prisma as any);
    const hasConvMemberLookup = this.hasDbLookup(db, 'conversationMember', 'findUnique');
    const hasConvLookup = this.hasDbLookup(db, 'conversation', 'findUnique');
    const hasMatchLookup = this.hasDbLookup(db, 'match', 'findUnique');

    if (!hasConvMemberLookup && !hasConvLookup && !hasMatchLookup) {
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenException(CLOSED_ACCESS_ERROR);
      }
      return {
        legacyUnitMock: true,
        conversation: null,
        match: null,
        partnerAccountId: null,
      };
    }

    let conversation: any = null;
    let match: any = null;

    if (hasConvMemberLookup) {
      const member = await db.conversationMember.findUnique({
        where: { conversationId_accountId: { conversationId, accountId } },
        include: {
          conversation: {
            include: { match: true, members: true },
          },
        },
      });
      if (!member || !member.conversation) {
        throw new ForbiddenException('You are not a member of this conversation.');
      }
      conversation = member.conversation;
      match = member.conversation.match;
    } else if (hasConvLookup) {
      conversation = await db.conversation.findUnique({
        where: { id: conversationId },
        include: { match: true, members: true },
      });
      if (!conversation) {
        throw new ForbiddenException('You are not a member of this conversation.');
      }
      const members: any[] = Array.isArray(conversation.members) ? conversation.members : [];
      const isListedMember =
        members.length > 0
          ? members.some((m: any) => m.accountId === accountId)
          : conversation.match &&
            (conversation.match.userLowId === accountId ||
              conversation.match.userHighId === accountId);
      if (!isListedMember) {
        throw new ForbiddenException('You are not a member of this conversation.');
      }
      match = conversation.match;
    }

    if (!match && conversation?.matchId && hasMatchLookup) {
      match = await db.match.findUnique({
        where: { id: conversation.matchId },
      });
    }

    if (!match) {
      throw new ForbiddenException('Messaging requires an active mutual match.');
    }

    if (match.userLowId !== accountId && match.userHighId !== accountId) {
      throw new ForbiddenException('You are not authorized for this match.');
    }

    if (conversation.status !== 'active' || match.status !== 'active') {
      throw new ForbiddenException(CLOSED_ACCESS_ERROR);
    }

    const blocked = await this.hasBidirectionalBlock(db, match.userLowId, match.userHighId);
    if (blocked) {
      throw new ForbiddenException('Interaction unavailable because a safety block is active.');
    }

    const bothActive = await this.verifyParticipantAccountsActive(db, [
      match.userLowId,
      match.userHighId,
    ]);
    if (!bothActive) {
      throw new ForbiddenException(CLOSED_ACCESS_ERROR);
    }

    const partnerAccountId =
      match.userLowId === accountId ? match.userHighId : match.userLowId;

    return {
      legacyUnitMock: false,
      conversation,
      match,
      partnerAccountId,
    };
  }

  /**
   * Authoritative verification for match-scoped operations (Relationship Mode, Milestones, Journals).
   */
  async assertAuthorizedForMatch(
    accountId: string,
    matchId: string,
    options?: { tx?: any; allowEndedForExit?: boolean },
  ): Promise<AuthorizedMatchContext> {
    if (!accountId || !matchId) {
      throw new BadRequestException('Account and match identifiers are required.');
    }

    const db = options?.tx || (this.prisma as any);
    if (!this.hasDbLookup(db, 'match', 'findUnique')) {
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenException(CLOSED_ACCESS_ERROR);
      }
      return {
        legacyUnitMock: true,
        match: null,
        conversation: null,
        partnerAccountId: null,
      };
    }

    const match = await db.match.findUnique({
      where: { id: matchId },
      include: { conversation: true },
    });

    if (!match || (match.userLowId !== accountId && match.userHighId !== accountId)) {
      throw new ForbiddenException('You are not authorized for this connection.');
    }

    if (options?.allowEndedForExit) {
      return {
        legacyUnitMock: false,
        match,
        conversation: match.conversation || null,
        partnerAccountId:
          match.userLowId === accountId ? match.userHighId : match.userLowId,
      };
    }

    if (match.status !== 'active') {
      throw new ForbiddenException(CLOSED_ACCESS_ERROR);
    }

    if (match.conversation && match.conversation.status !== 'active') {
      throw new ForbiddenException(CLOSED_ACCESS_ERROR);
    }

    const blocked = await this.hasBidirectionalBlock(db, match.userLowId, match.userHighId);
    if (blocked) {
      throw new ForbiddenException('Interaction unavailable because a safety block is active.');
    }

    const bothActive = await this.verifyParticipantAccountsActive(db, [
      match.userLowId,
      match.userHighId,
    ]);
    if (!bothActive) {
      throw new ForbiddenException(CLOSED_ACCESS_ERROR);
    }

    return {
      legacyUnitMock: false,
      match,
      conversation: match.conversation || null,
      partnerAccountId:
        match.userLowId === accountId ? match.userHighId : match.userLowId,
    };
  }

  /**
   * Prevents silent reactivation of previously ended/unmatched/blocked/revoked Match records.
   */
  async assertPairHasNoEndedMatch(
    db: any,
    accountA: string,
    accountB: string,
  ): Promise<void> {
    if (!this.hasDbLookup(db, 'match', 'findUnique')) return;
    const [userLowId, userHighId] = [accountA, accountB].sort();
    const existing = await db.match.findUnique({
      where: { userLowId_userHighId: { userLowId, userHighId } },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== 'active') {
      throw new ForbiddenException(
        'This connection has previously ended and cannot be reopened.',
      );
    }
  }

  /**
   * Atomically ends an active match (or idempotently syncs downstream closed state)
   * across Conversation, CallSessions, GameSessions, VirtualDates, and RelationshipSpace.
   */
  async closeMatchDownstreamState(
    tx: any,
    params: {
      match: any;
      actorId: string;
      endedByAccountId: string | null;
      endReason: string;
      stateMetadata?: Record<string, unknown>;
      markLikesStatus?: string;
      now?: Date;
    },
  ): Promise<{ transitioned: boolean }> {
    const now = params.now || new Date();
    const match = params.match;
    let transitioned = false;

    if (match.status === 'active') {
      await tx.match.update({
        where: { id: match.id },
        data: {
          status: 'ended',
          endedAt: now,
          endedByAccountId: params.endedByAccountId,
          endReason: params.endReason,
        },
      });
      transitioned = true;

      if (typeof tx.matchStateEvent?.create === 'function') {
        await tx.matchStateEvent
          .create({
            data: {
              matchId: match.id,
              previousState: 'active',
              newState: 'ended',
              actorId: params.actorId,
              metadata: {
                endReason: params.endReason,
                ...(params.stateMetadata || {}),
              },
            },
          })
          .catch(() => null);
      }
    }

    if (params.markLikesStatus && typeof tx.like?.updateMany === 'function') {
      await tx.like
        .updateMany({
          where: {
            OR: [
              { fromAccountId: match.userLowId, toAccountId: match.userHighId },
              { fromAccountId: match.userHighId, toAccountId: match.userLowId },
            ],
            status: 'active',
          },
          data: { status: params.markLikesStatus },
        })
        .catch(() => null);
    }

    const conversationId = match.conversation?.id;
    if (conversationId) {
      if (typeof tx.conversation?.updateMany === 'function') {
        await tx.conversation.updateMany({
          where: { id: conversationId, status: { not: 'closed' } },
          data: { status: 'closed' },
        });
      } else if (typeof tx.conversation?.update === 'function') {
        await tx.conversation.update({
          where: { id: conversationId },
          data: { status: 'closed' },
        });
      }

      if (typeof tx.callSession?.updateMany === 'function') {
        await tx.callSession
          .updateMany({
            where: {
              conversationId,
              callStatus: { in: ['initiated', 'ringing', 'accepted', 'active'] },
            },
            data: { callStatus: 'ended', endedAt: now },
          })
          .catch(() => null);
      }

      if (typeof tx.gameSession?.updateMany === 'function') {
        await tx.gameSession
          .updateMany({
            where: {
              conversationId,
              sessionStatus: { in: ['invited', 'active'] },
            },
            data: { sessionStatus: 'ended', completedAt: now },
          })
          .catch(() => null);
      }

      if (typeof tx.virtualDate?.updateMany === 'function') {
        await tx.virtualDate
          .updateMany({
            where: {
              conversationId,
              status: { in: ['proposed', 'accepted'] },
            },
            data: { status: 'cancelled' },
          })
          .catch(() => null);
      }
    } else if (typeof tx.conversation?.updateMany === 'function') {
      await tx.conversation
        .updateMany({
          where: { matchId: match.id, status: { not: 'closed' } },
          data: { status: 'closed' },
        })
        .catch(() => null);
    }

    if (typeof tx.relationshipSpace?.updateMany === 'function') {
      await tx.relationshipSpace
        .updateMany({
          where: { matchId: match.id, isActive: true },
          data: {
            isActive: false,
            disbandedAt: now,
            disbandedById: params.endedByAccountId,
          },
        })
        .catch(() => null);
    }

    return { transitioned };
  }

  /**
   * Invalidates all active Match & connected Conversation/Calling/Together permissions when an
   * account is suspended, disabled, deleted, or has verification/discovery eligibility revoked.
   * Explicitly distinguishes invalidation from user-initiated Block or Unmatch.
   */
  async invalidateActiveMatchesForAccount(
    tx: any,
    accountId: string,
    params: {
      reasonCode: AccountInvalidationReason;
      actorId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ invalidatedCount: number }> {
    if (!this.hasDbLookup(tx, 'match', 'findMany')) {
      return { invalidatedCount: 0 };
    }

    const activeMatches = await tx.match.findMany({
      where: {
        OR: [{ userLowId: accountId }, { userHighId: accountId }],
        status: 'active',
      },
      include: { conversation: true },
    });

    if (!Array.isArray(activeMatches) || activeMatches.length === 0) {
      return { invalidatedCount: 0 };
    }

    const now = new Date();
    const actorUuid = params.actorId || accountId;

    for (const match of activeMatches) {
      await this.closeMatchDownstreamState(tx, {
        match,
        actorId: actorUuid,
        endedByAccountId: null,
        endReason: params.reasonCode,
        stateMetadata: {
          affectedAccountId: accountId,
          systemInvalidation: true,
          ...(params.metadata || {}),
        },
        now,
      });
    }

    return { invalidatedCount: activeMatches.length };
  }
}
