import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto } from './dto/messaging.dto';
import { MatchAuthorizationService } from '../safety/match-authorization.service';

@Injectable()
export class MessagingService {
  private readonly matchAuth: MatchAuthorizationService;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() matchAuthService?: MatchAuthorizationService,
  ) {
    this.matchAuth = matchAuthService ?? new MatchAuthorizationService(this.prisma);
  }

  private async runInTx<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const prismaAny = this.prisma as any;
    if (typeof prismaAny?.$transaction === 'function') {
      return prismaAny.$transaction((tx: any) => fn(tx));
    }
    return fn(prismaAny);
  }

  private async assertActiveMatchConversationMember(
    accountId: string,
    conversationId: string,
    tx?: any,
  ) {
    try {
      return await this.matchAuth.assertAuthorizedForConversation(
        accountId,
        conversationId,
        tx ? { tx } : undefined,
      );
    } catch (err: any) {
      if (
        err instanceof ForbiddenException ||
        err instanceof BadRequestException
      ) {
        throw err;
      }
      throw new ServiceUnavailableException('Messaging service is temporarily unavailable.');
    }
  }

  /**
   * 1. Get all active conversations for user
   */
  async getConversations(accountId: string) {
    try {
      const members = await this.prisma.conversationMember.findMany({
        where: { accountId },
        include: {
          conversation: {
            include: {
              members: true,
              match: true,
              messages: {
                orderBy: { sequenceNo: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      const activeConversations: any[] = [];
      for (const m of members) {
        const c = m.conversation;
        if (c?.status !== 'active' || c?.match?.status !== 'active') {
          continue;
        }
        const blocked = await this.matchAuth.hasBidirectionalBlock(
          this.prisma,
          c.match.userLowId,
          c.match.userHighId,
        );
        if (blocked) {
          continue;
        }
        const bothActive = await this.matchAuth.verifyParticipantAccountsActive(this.prisma, [
          c.match.userLowId,
          c.match.userHighId,
        ]);
        if (!bothActive) {
          continue;
        }
        const lastMsg = c.messages?.[0] || null;
        activeConversations.push({
          conversationId: c.id,
          matchId: c.matchId,
          lastMessageAt: c.lastMessageAt || c.createdAt,
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                sequenceNo: Number(lastMsg.sequenceNo),
                bodyText: lastMsg.bodyText,
                isOwn: lastMsg.senderAccountId === accountId,
                createdAt: lastMsg.createdAt,
              }
            : null,
        });
      }

      return activeConversations;
    } catch {
      throw new ServiceUnavailableException('Messaging service is temporarily unavailable.');
    }
  }

  /**
   * 2. Get message history for a conversation
   */
  async getMessages(accountId: string, conversationId: string) {
    await this.assertActiveMatchConversationMember(accountId, conversationId);

    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { sequenceNo: 'asc' },
      take: 100,
    });

    return (rows || []).map((message: any) => ({
      id: message.id,
      conversationId: message.conversationId,
      sequenceNo: Number(message.sequenceNo),
      senderName: message.senderAccountId === accountId ? 'You' : undefined,
      isOwn: message.senderAccountId === accountId,
      messageType: message.messageType,
      bodyText: message.bodyText,
      mediaUrl: message.mediaUrl ?? null,
      durationSeconds: message.durationSeconds ?? null,
      deliveryState: message.deliveryState,
      createdAt: message.createdAt,
    }));
  }

  /**
   * 3. Send 1:1 message (atomically verified against active Match row lock)
   */
  async sendMessage(accountId: string, conversationId: string, dto: SendMessageDto) {
    if (!dto.bodyText || dto.bodyText.trim().length === 0) {
      throw new BadRequestException('Message body cannot be empty.');
    }
    if (dto.bodyText.length > 1000) {
      throw new BadRequestException('Message body exceeds 1,000 characters limit (Document 04 §6.1).');
    }

    return this.runInTx(async (tx) => {
      await this.assertActiveMatchConversationMember(accountId, conversationId, tx);

      const lastMsg = await tx.message.findFirst({
        where: { conversationId },
        orderBy: { sequenceNo: 'desc' },
        select: { sequenceNo: true },
      });

      const sequenceNo = BigInt((lastMsg ? Number(lastMsg.sequenceNo) : 0) + 1);

      const created = await tx.message.create({
        data: {
          conversationId,
          sequenceNo,
          senderAccountId: accountId,
          messageType: 'text',
          bodyText: dto.bodyText.trim(),
          deliveryState: 'delivered',
        },
      });

      await tx.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      return {
        id: created.id,
        conversationId,
        sequenceNo: Number(created.sequenceNo),
        senderName: 'You',
        isOwn: true,
        messageType: created.messageType,
        bodyText: created.bodyText,
        deliveryState: created.deliveryState,
        createdAt: created.createdAt,
      };
    });
  }
}
