import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  ServiceUnavailableException,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import {
  calculateAgeYears,
  isPrivateIdentifierLike,
  MAX_TEXT_MESSAGE_LENGTH,
  VOICE_NOTE_MAX_DURATION_SEC,
} from '@saymyname/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchAuthorizationService } from '../safety/match-authorization.service';
import { ProfilesService } from '../profiles/profiles.service';
import { readLimitedS3Body } from '../profiles/image-security';
import { RealtimeEventBusService } from '../realtime/realtime-event-bus.service';
import { RealtimeTicketService } from '../realtime/realtime-ticket.service';
import { MessagingOutboxRelayService } from '../realtime/messaging-outbox-relay.service';
import {
  extensionForVoiceNoteMime,
  getAllowedVoiceNoteMimes,
  getMaxVoiceNoteBytes,
  normalizeVoiceNoteMime,
  verifyVoiceNoteBinary,
} from './audio-security';
import {
  MessagesQueryDto,
  MessagingVoiceNotePresignDto,
  SendMessageDto,
  SendMessagingVoiceNoteDto,
  SequenceAckDto,
} from './dto/messaging.dto';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_UPLOAD_TOKEN_SECRET = 'dev-synthetic-access-secret-do-not-use-in-prod';

interface VerifiedUploadToken {
  accountId: string;
  conversationId: string;
  mediaRefId: string;
  s3Key: string;
  mimeType: string;
  claimedDurationSeconds: number;
  maxBytes: number;
  expMs: number;
}

@Injectable()
export class MessagingService {
  private readonly matchAuth: MatchAuthorizationService;
  private readonly uploadTokenSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() matchAuthService?: MatchAuthorizationService,
    @Optional() private readonly profilesService?: ProfilesService,
    @Optional() private readonly realtimeBus?: RealtimeEventBusService,
    @Optional() private readonly realtimeTicketService?: RealtimeTicketService,
    @Optional() private readonly outboxRelay?: MessagingOutboxRelayService,
  ) {
    this.matchAuth = matchAuthService ?? new MatchAuthorizationService(this.prisma);
    const configured =
      process.env.VOICE_UPLOAD_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET;
    this.uploadTokenSecret = configured || DEFAULT_UPLOAD_TOKEN_SECRET;
  }

  private async runInTx<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const prismaAny = this.prisma as any;
    if (typeof prismaAny?.$transaction === 'function') {
      return prismaAny.$transaction((tx: any) => fn(tx));
    }
    return fn(prismaAny);
  }

  private wrapStorageFailure(err: any): never {
    if (
      err instanceof BadRequestException ||
      err instanceof NotFoundException ||
      err instanceof ForbiddenException ||
      err instanceof ConflictException ||
      err instanceof ServiceUnavailableException
    ) {
      throw err;
    }
    throw new ServiceUnavailableException('Messaging service is temporarily unavailable.');
  }

  private createR2Client(): { client: S3Client; bucket: string } | null {
    const bucket = process.env.R2_BUCKET_NAME;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const endpoint =
      process.env.R2_ENDPOINT ||
      (process.env.R2_ACCOUNT_ID
        ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
        : undefined);

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      return null;
    }

    let isCloudflareR2Host = false;
    try {
      isCloudflareR2Host = /(?:^|\.)r2\.cloudflarestorage\.com$/i.test(
        new URL(endpoint).hostname,
      );
    } catch {
      isCloudflareR2Host = false;
    }
    const forcePathStyle =
      !isCloudflareR2Host && process.env.R2_FORCE_PATH_STYLE === 'true';

    return {
      bucket,
      client: new S3Client({
        region: 'auto',
        endpoint,
        ...(forcePathStyle ? { forcePathStyle: true } : {}),
        credentials: { accessKeyId, secretAccessKey },
      }),
    };
  }

  private signUploadToken(payload: VerifiedUploadToken): string {
    const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.uploadTokenSecret)
      .update(encoded)
      .digest('base64url');
    return `${encoded}.${sig}`;
  }

  private verifyUploadToken(
    token: string,
    expected: { accountId: string; conversationId: string; mediaRefId: string },
  ): VerifiedUploadToken {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
      throw new BadRequestException('Invalid voice-note upload token.');
    }
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) {
      throw new BadRequestException('Malformed voice-note upload token.');
    }

    const expectedSig = crypto
      .createHmac('sha256', this.uploadTokenSecret)
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new ForbiddenException('Voice-note upload token signature is invalid.');
    }

    let parsed: VerifiedUploadToken;
    try {
      parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Voice-note upload token payload is unreadable.');
    }

    if (
      !parsed ||
      parsed.accountId !== expected.accountId ||
      parsed.conversationId !== expected.conversationId ||
      parsed.mediaRefId !== expected.mediaRefId ||
      !parsed.s3Key ||
      parsed.s3Key.includes('..') ||
      parsed.expMs <= Date.now()
    ) {
      throw new ForbiddenException('Voice-note upload token expired or mismatched.');
    }

    return parsed;
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
      this.wrapStorageFailure(err);
    }
  }

  private async lockConversationRow(tx: any, conversationId: string): Promise<void> {
    if (typeof tx?.$queryRaw !== 'function' || !UUID_PATTERN.test(conversationId)) {
      return;
    }
    await tx.$queryRaw`
      SELECT id::text AS id
      FROM messaging.conversations
      WHERE id = ${conversationId}::uuid
      FOR UPDATE
    `;
  }

  private sanitizeDisplayName(raw?: string | null): string {
    if (!raw || isPrivateIdentifierLike(raw)) return 'Verified Member';
    return raw.trim();
  }

  private async toSanitizedPartnerSummary(
    profile: any | null,
    fallbackId: string,
    referenceDate: Date = new Date(),
  ) {
    if (!profile) {
      return {
        profileId: fallbackId,
        displayName: 'Verified Member',
        age: null,
        ageVisible: false,
        programmeFamily: 'data_science_applications',
        termOrYear: null,
        locationCity: null,
        locationState: null,
        intention: null,
        bio: null,
        interests: [],
        photos: [],
        promptAnswers: [],
        isVerified: true,
      };
    }

    const hydrated = this.profilesService
      ? await this.profilesService.hydrateProfileMedia(profile)
      : profile;

    const approvedPhotos = (hydrated.photos || [])
      .filter(
        (p: any) =>
          !p.deletedAt &&
          (p.moderationStatus === undefined || p.moderationStatus === 'approved'),
      )
      .sort((a: any, b: any) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((p: any, idx: number) => ({
        id: p.id,
        photoUrl: p.photoUrl ?? null,
        displayOrder: typeof p.displayOrder === 'number' ? p.displayOrder : idx,
        isPrimary: Boolean(p.isPrimary),
      }));

    let verifiedAge: number | null = null;
    const dob = profile.account?.eligibility?.dateOfBirth;
    if (dob) {
      const calc = calculateAgeYears(dob, referenceDate);
      if (calc !== null && calc >= 18) verifiedAge = calc;
    }
    const hideAge = profile.ageDisplayMode === 'hidden';
    const exposedAge = !hideAge && verifiedAge !== null ? verifiedAge : null;

    const interests = (profile.interests || [])
      .map((i: any) => i?.interest?.name || i?.name)
      .filter((n: unknown): n is string => typeof n === 'string' && n.trim().length > 0);

    const promptAnswers = (profile.promptAnswers || []).map((pa: any) => ({
      id: pa.id,
      promptId: pa.promptId,
      promptText: pa?.prompt?.promptText || pa?.promptText || '',
      answerText: pa.answerText,
    }));

    return {
      profileId: profile.id,
      displayName: this.sanitizeDisplayName(profile.displayName),
      age: exposedAge,
      ageVisible: !hideAge && exposedAge !== null,
      programmeFamily:
        profile.account?.eligibility?.programmeFamily ||
        profile.programmeFamily ||
        'data_science_applications',
      termOrYear: profile.termOrYear ?? null,
      locationCity: profile.locationCity ?? null,
      locationState: profile.locationState ?? null,
      intention: profile.intention ?? null,
      bio: profile.bio ?? null,
      interests,
      photos: approvedPhotos,
      promptAnswers,
      isVerified: Boolean(
        profile.account?.eligibility?.ageStatus === 'approved' &&
          profile.account?.eligibility?.studentStatus === 'approved',
      ),
    };
  }

  private async toSanitizedMessageDto(message: any, viewerAccountId: string) {
    const isOwn = message.senderAccountId === viewerAccountId;
    const media = message.media || null;
    const mediaId = media?.id ?? message.mediaRefId ?? null;
    // Phase 3.5.2 (Option A / ADR-023): Never expose raw S3/R2 signed URLs or storage keys to browsers.
    const proxyStreamUrl =
      message.messageType === 'voice_note' && mediaId
        ? `/api/bff/v1/messaging/media/${encodeURIComponent(mediaId)}/stream`
        : null;

    const deliveryState: 'sent' | 'delivered' =
      message.deliveryState === 'delivered' || message.deliveryState === 'read'
        ? 'delivered'
        : 'sent';

    return {
      id: message.id,
      conversationId: message.conversationId,
      sequenceNo: Number(message.sequenceNo),
      senderName: isOwn ? 'You' : undefined,
      isOwn,
      messageType: message.messageType || 'text',
      bodyText: message.bodyText ?? null,
      mediaId,
      mediaUrl: proxyStreamUrl,
      mimeType: media?.mediaType ?? null,
      durationSeconds: media?.durationSeconds ?? message.durationSeconds ?? null,
      fileSizeBytes: media?.fileSizeBytes ?? null,
      deliveryState,
      createdAt:
        message.createdAt instanceof Date
          ? message.createdAt.toISOString()
          : message.createdAt,
      clientAssignedUuid: message.clientAssignedUuid ?? null,
    };
  }

  private async markIncomingDeliveredAndNotify(
    accountId: string,
    conversationId: string,
    rows: any[],
    partnerAccountId?: string | null,
  ) {
    const prismaAny = this.prisma as any;
    const incomingSent = rows.filter(
      (r) =>
        r &&
        r.senderAccountId !== accountId &&
        (r.deliveryState === 'sent' || !r.deliveredAt),
    );
    if (incomingSent.length === 0) return;

    const maxSeq = incomingSent.reduce((max, r) => {
      const seq = Number(r.sequenceNo);
      return seq > max ? seq : max;
    }, 0);

    const now = new Date();
    if (typeof prismaAny.message?.updateMany === 'function') {
      await prismaAny.message
        .updateMany({
          where: {
            conversationId,
            senderAccountId: { not: accountId },
            sequenceNo: { lte: BigInt(maxSeq) },
            deliveryState: 'sent',
          },
          data: {
            deliveryState: 'delivered',
            deliveredAt: now,
          },
        })
        .catch(() => null);
    }

    if (typeof prismaAny.conversationMember?.updateMany === 'function') {
      await prismaAny.conversationMember
        .updateMany({
          where: {
            conversationId,
            accountId,
            lastDeliveredSeq: { lt: BigInt(maxSeq) },
          },
          data: { lastDeliveredSeq: BigInt(maxSeq) },
        })
        .catch(() => null);
    }

    for (const r of incomingSent) {
      r.deliveryState = 'delivered';
      r.deliveredAt = now;
    }

    if (maxSeq > 0) {
      this.realtimeBus?.publishConversationEvent(
        conversationId,
        'message.delivered',
        { conversationId, upToSequenceNo: maxSeq },
        {
          recipientAccountIds: partnerAccountId ? [partnerAccountId, accountId] : [accountId],
          version: maxSeq,
        },
      );
    }
  }

  /**
   * 0. Issue single-use BFF-brokered WebSocket authentication ticket (Part 07 §7.3)
   */
  async createRealtimeTicket(accountId: string) {
    if (!this.realtimeTicketService) {
      throw new ServiceUnavailableException('Realtime messaging ticket service is unavailable.');
    }
    return this.realtimeTicketService.issueTicket(accountId);
  }

  /**
   * 1. List active conversations ordered deterministically with owner-only unread counts
   */
  async getConversations(accountId: string) {
    try {
      const prismaAny = this.prisma as any;
      const now = new Date();

      const members = await prismaAny.conversationMember.findMany({
        where: { accountId },
        include: {
          conversation: {
            include: {
              members: true,
              match: true,
              messages: {
                orderBy: { sequenceNo: 'desc' },
                take: 1,
                include: { media: true },
              },
            },
          },
        },
      });

      const eligibleEntries: Array<{
        member: any;
        conversation: any;
        match: any;
        partnerAccountId: string;
        lastMsg: any;
      }> = [];

      for (const m of members || []) {
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
        const bothActive = await this.matchAuth.verifyParticipantAccountsActive(
          this.prisma,
          [c.match.userLowId, c.match.userHighId],
          now,
        );
        if (!bothActive) {
          continue;
        }
        const partnerAccountId =
          c.match.userLowId === accountId ? c.match.userHighId : c.match.userLowId;
        eligibleEntries.push({
          member: m,
          conversation: c,
          match: c.match,
          partnerAccountId,
          lastMsg: c.messages?.[0] || null,
        });
      }

      const partnerIds = eligibleEntries.map((e) => e.partnerAccountId);
      const profileMap = new Map<string, any>();
      if (partnerIds.length > 0 && typeof prismaAny.profile?.findMany === 'function') {
        const profiles = await prismaAny.profile
          .findMany({
            where: { accountId: { in: partnerIds } },
            include: {
              account: { include: { eligibility: true } },
              photos: {
                where: { deletedAt: null, moderationStatus: 'approved' },
                orderBy: { displayOrder: 'asc' },
              },
              interests: { include: { interest: true } },
              promptAnswers: { include: { prompt: true } },
            },
          })
          .catch(() => []);
        for (const p of profiles || []) {
          profileMap.set(p.accountId, p);
        }
      }

      const summaries = await Promise.all(
        eligibleEntries.map(async (entry) => {
          const { member, conversation, match, partnerAccountId, lastMsg } = entry;
          const ownLastReadSeq = Number(member.lastReadSeq ?? 0);
          let unreadCount = 0;

          if (typeof prismaAny.message?.count === 'function') {
            unreadCount = await prismaAny.message
              .count({
                where: {
                  conversationId: conversation.id,
                  senderAccountId: { not: accountId },
                  sequenceNo: { gt: BigInt(ownLastReadSeq) },
                },
              })
              .catch(() => 0);
          }

          const lastMessageAtRaw =
            lastMsg?.createdAt || conversation.lastMessageAt || match.createdAt || conversation.createdAt;
          const lastMessageAtDate = lastMessageAtRaw ? new Date(lastMessageAtRaw) : now;
          const lastMessageAtIso = Number.isNaN(lastMessageAtDate.getTime())
            ? now.toISOString()
            : lastMessageAtDate.toISOString();

          const matchedAtRaw = match.createdAt || conversation.createdAt;
          const matchedAtDate = matchedAtRaw ? new Date(matchedAtRaw) : now;
          const matchedAtIso = Number.isNaN(matchedAtDate.getTime())
            ? now.toISOString()
            : matchedAtDate.toISOString();

          const previewText = !lastMsg
            ? null
            : lastMsg.messageType === 'voice_note'
              ? `Voice note (${Math.max(1, Number(lastMsg.media?.durationSeconds ?? 0))}s)`
              : lastMsg.bodyText || '';

          const profile = await this.toSanitizedPartnerSummary(
            profileMap.get(partnerAccountId) || null,
            match.id,
            now,
          );

          return {
            sortMs: Number.isNaN(lastMessageAtDate.getTime()) ? 0 : lastMessageAtDate.getTime(),
            payload: {
              conversationId: conversation.id,
              matchId: conversation.matchId,
              matchedAt: matchedAtIso,
              lastMessageAt: lastMessageAtIso,
              lastMessage: lastMsg
                ? {
                    id: lastMsg.id,
                    sequenceNo: Number(lastMsg.sequenceNo),
                    messageType: lastMsg.messageType || 'text',
                    bodyText: previewText,
                    previewText,
                    isOwn: lastMsg.senderAccountId === accountId,
                    createdAt:
                      lastMsg.createdAt instanceof Date
                        ? lastMsg.createdAt.toISOString()
                        : lastMsg.createdAt,
                  }
                : null,
              unreadCount,
              latestSequenceNo: lastMsg ? Number(lastMsg.sequenceNo) : 0,
              ownLastReadSeq,
              profile,
            },
          };
        }),
      );

      summaries.sort(
        (a, b) =>
          b.sortMs - a.sortMs ||
          b.payload.conversationId.localeCompare(a.payload.conversationId),
      );

      return summaries.map((s) => s.payload);
    } catch {
      throw new ServiceUnavailableException('Messaging service is temporarily unavailable.');
    }
  }

  /**
   * 2. Legacy-compatible chronological message list (used by existing integration specs)
   */
  async getMessages(accountId: string, conversationId: string, query?: MessagesQueryDto) {
    const history = await this.getMessageHistory(accountId, conversationId, query);
    return history.messages;
  }

  /**
   * 2b. Paginated message history with cursor navigation & incremental reconnect reconciliation
   */
  async getMessageHistory(
    accountId: string,
    conversationId: string,
    query: MessagesQueryDto = {},
  ) {
    const auth = await this.assertActiveMatchConversationMember(accountId, conversationId);
    const prismaAny = this.prisma as any;

    const limit = Math.max(1, Math.min(50, Number(query?.limit) || 30));
    const hasAfterSeq =
      query?.afterSeq !== undefined && query?.afterSeq !== null && !Number.isNaN(Number(query.afterSeq));
    const hasBeforeSeq =
      query?.beforeSeq !== undefined && query?.beforeSeq !== null && !Number.isNaN(Number(query.beforeSeq));

    let orderedRows: any[] = [];
    let hasOlder = false;

    if (hasAfterSeq) {
      const afterVal = BigInt(Math.max(0, Math.floor(Number(query.afterSeq))));
      const rows = await prismaAny.message.findMany({
        where: {
          conversationId,
          sequenceNo: { gt: afterVal },
        },
        include: { media: true },
        orderBy: { sequenceNo: 'asc' },
        take: limit,
      });
      orderedRows = rows || [];
      hasOlder = false;
    } else {
      const beforeVal = hasBeforeSeq
        ? BigInt(Math.max(1, Math.floor(Number(query.beforeSeq))))
        : undefined;
      const descRows = await prismaAny.message.findMany({
        where: {
          conversationId,
          ...(beforeVal !== undefined ? { sequenceNo: { lt: beforeVal } } : {}),
        },
        include: { media: true },
        orderBy: { sequenceNo: 'desc' },
        take: limit + 1,
      });

      const raw = descRows || [];
      // Compatibility with unit mocks whose findMany ignores orderBy/desc
      const sortedDesc = [...raw].sort(
        (a, b) => Number(b.sequenceNo) - Number(a.sequenceNo),
      );
      hasOlder = sortedDesc.length > limit;
      orderedRows = sortedDesc.slice(0, limit).reverse();
    }

    await this.markIncomingDeliveredAndNotify(
      accountId,
      conversationId,
      orderedRows,
      auth.partnerAccountId,
    );

    const messages = await Promise.all(
      orderedRows.map((m) => this.toSanitizedMessageDto(m, accountId)),
    );

    let ownLastReadSeq = 0;
    if (typeof prismaAny.conversationMember?.findUnique === 'function') {
      const mem = await prismaAny.conversationMember
        .findUnique({
          where: {
            conversationId_accountId: { conversationId, accountId },
          },
          select: { lastReadSeq: true },
        })
        .catch(() => null);
      ownLastReadSeq = Number(mem?.lastReadSeq ?? 0);
    }

    const latestRow =
      typeof prismaAny.message?.findFirst === 'function'
        ? await prismaAny.message
            .findFirst({
              where: { conversationId },
              orderBy: { sequenceNo: 'desc' },
              select: { sequenceNo: true },
            })
            .catch(() => null)
        : orderedRows[orderedRows.length - 1] || null;

    const latestSequenceNo = latestRow
      ? Number(latestRow.sequenceNo)
      : orderedRows.length > 0
        ? Number(orderedRows[orderedRows.length - 1].sequenceNo)
        : 0;

    return {
      messages,
      nextCursor: hasOlder && messages.length > 0 ? String(messages[0].sequenceNo) : null,
      hasOlder,
      latestSequenceNo,
      ownLastReadSeq,
      conversationStatus: 'active' as const,
    };
  }

  /**
   * 3. Send 1:1 text message (idempotent, serialized sequence allocation, transactional outbox + post-commit WS fan-out)
   */
  async sendMessage(
    accountId: string,
    conversationId: string,
    dto: SendMessageDto,
    idempotencyKey?: string,
  ) {
    const trimmed = dto.bodyText?.trim() || '';
    if (trimmed.length === 0) {
      throw new BadRequestException('Message body cannot be empty.');
    }
    if (trimmed.length > MAX_TEXT_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Message body exceeds ${MAX_TEXT_MESSAGE_LENGTH.toLocaleString()} characters limit.`,
      );
    }

    const cleanClientUuid = dto.clientAssignedUuid?.trim() || null;
    const cleanIdemKey = idempotencyKey?.trim() || null;

    try {
      let emitAfterCommit: {
        partnerAccountId: string | null;
        messageId: string;
        sequenceNo: number;
        createdAt: string;
        outboxCreated: boolean;
      } | null = null;

      const sanitized = await this.runInTx(async (tx) => {
        // Canonical lock hierarchy: dating.matches (FOR SHARE) before messaging.conversations (FOR UPDATE) to prevent unmatch/send deadlocks
        const auth = await this.assertActiveMatchConversationMember(
          accountId,
          conversationId,
          tx,
        );
        await this.lockConversationRow(tx, conversationId);

        // 1. Check clientAssignedUuid idempotency before creating
        if (cleanClientUuid && typeof tx.message?.findUnique === 'function') {
          const existingByUuid = await tx.message
            .findUnique({
              where: { clientAssignedUuid: cleanClientUuid },
              include: { media: true },
            })
            .catch(() => null);
          if (existingByUuid) {
            if (
              existingByUuid.senderAccountId !== accountId ||
              existingByUuid.conversationId !== conversationId
            ) {
              throw new ConflictException('Client message identifier belongs to another operation.');
            }
            return this.toSanitizedMessageDto(existingByUuid, accountId);
          }
        }

        const scopedKey = cleanIdemKey ? `${accountId}:msg:${conversationId}:${cleanIdemKey}` : null;
        const requestHash = crypto
          .createHash('sha256')
          .update(`msg:${accountId}:${conversationId}:${trimmed}`)
          .digest('hex');

        if (scopedKey && typeof tx.idempotencyRecord?.findUnique === 'function') {
          const cached = await tx.idempotencyRecord
            .findUnique({ where: { idempotencyKey: scopedKey } })
            .catch(() => null);
          if (cached) {
            if (cached.requestHash !== requestHash) {
              throw new ConflictException('Idempotency key reused with a different message body.');
            }
            return cached.responseBody;
          }
        }

        const lastMsg = await tx.message.findFirst({
          where: { conversationId },
          orderBy: { sequenceNo: 'desc' },
          select: { sequenceNo: true },
        });

        const nextSeqNum = (lastMsg ? Number(lastMsg.sequenceNo) : 0) + 1;
        const sequenceNo = BigInt(nextSeqNum);
        const now = new Date();

        const created = await tx.message.create({
          data: {
            conversationId,
            sequenceNo,
            senderAccountId: accountId,
            ...(cleanClientUuid ? { clientAssignedUuid: cleanClientUuid } : {}),
            messageType: 'text',
            bodyText: trimmed,
            deliveryState: 'sent',
          },
        });

        await tx.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: now },
        });

        if (typeof tx.conversationMember?.updateMany === 'function') {
          await tx.conversationMember
            .updateMany({
              where: { conversationId, accountId },
              data: {
                lastReadSeq: sequenceNo,
                lastDeliveredSeq: sequenceNo,
              },
            })
            .catch(() => null);
        }

        let outboxCreated = false;
        if (typeof tx.outboxEvent?.create === 'function') {
          await tx.outboxEvent.create({
            data: {
              aggregateType: 'conversation',
              aggregateId: conversationId,
              eventType: 'message.created',
              payload: {
                conversationId,
                messageId: created.id,
                sequenceNo: nextSeqNum,
                messageType: 'text',
                createdAt:
                  created.createdAt instanceof Date
                    ? created.createdAt.toISOString()
                    : now.toISOString(),
              },
              status: 'pending',
              retryCount: 0,
              nextAttemptAt: now,
              processedAt: null,
            },
          });
          outboxCreated = true;
        }

        const dtoOut = await this.toSanitizedMessageDto(created, accountId);

        if (scopedKey && typeof tx.idempotencyRecord?.create === 'function') {
          await tx.idempotencyRecord
            .create({
              data: {
                idempotencyKey: scopedKey,
                accountId,
                requestHash,
                responseStatus: 201,
                responseBody: dtoOut,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              },
            })
            .catch(() => null);
        }

        emitAfterCommit = {
          partnerAccountId: auth.partnerAccountId,
          messageId: created.id,
          sequenceNo: nextSeqNum,
          createdAt: dtoOut.createdAt,
          outboxCreated,
        };

        return dtoOut;
      });

      if (emitAfterCommit) {
        const ev = emitAfterCommit as {
          partnerAccountId: string | null;
          messageId: string;
          sequenceNo: number;
          createdAt: string;
          outboxCreated: boolean;
        };
        if (this.outboxRelay && ev.outboxCreated) {
          void this.outboxRelay.triggerImmediateFlush().catch(() => null);
        } else {
          const recipients = ev.partnerAccountId
            ? [ev.partnerAccountId, accountId]
            : [accountId];
          this.realtimeBus?.publishConversationEvent(
            conversationId,
            'message.created',
            {
              conversationId,
              messageId: ev.messageId,
              sequenceNo: ev.sequenceNo,
              messageType: 'text',
              createdAt: ev.createdAt,
            },
            { recipientAccountIds: recipients, version: ev.sequenceNo },
          );
        }
      }

      return sanitized;
    } catch (err) {
      this.wrapStorageFailure(err);
    }
  }

  /**
   * 4. Owner-only inbox unread cursor advancement (NEVER exposes read receipts to partner — D04-10, MSG-10)
   */
  async markInboxSeen(accountId: string, conversationId: string, dto: SequenceAckDto) {
    await this.assertActiveMatchConversationMember(accountId, conversationId);
    const prismaAny = this.prisma as any;

    const latestRow = await prismaAny.message
      .findFirst({
        where: { conversationId },
        orderBy: { sequenceNo: 'desc' },
        select: { id: true, sequenceNo: true },
      })
      .catch(() => null);

    const maxAvailableSeq = latestRow ? Number(latestRow.sequenceNo) : 0;
    const targetSeq = Math.min(maxAvailableSeq, Math.max(0, Math.floor(dto.upToSequenceNo)));

    const currentMember =
      typeof prismaAny.conversationMember?.findUnique === 'function'
        ? await prismaAny.conversationMember
            .findUnique({
              where: { conversationId_accountId: { conversationId, accountId } },
            })
            .catch(() => null)
        : null;

    const currentSeq = Number(currentMember?.lastReadSeq ?? 0);
    const nextSeq = Math.max(currentSeq, targetSeq);

    if (nextSeq > currentSeq && typeof prismaAny.conversationMember?.update === 'function') {
      await prismaAny.conversationMember
        .update({
          where: { conversationId_accountId: { conversationId, accountId } },
          data: {
            lastReadSeq: BigInt(nextSeq),
            lastDeliveredSeq: BigInt(
              Math.max(Number(currentMember?.lastDeliveredSeq ?? 0), nextSeq),
            ),
            ...(latestRow?.id ? { lastReadMessageId: latestRow.id } : {}),
          },
        })
        .catch(() => null);
    }

    const unreadCount =
      typeof prismaAny.message?.count === 'function'
        ? await prismaAny.message
            .count({
              where: {
                conversationId,
                senderAccountId: { not: accountId },
                sequenceNo: { gt: BigInt(nextSeq) },
              },
            })
            .catch(() => 0)
        : 0;

    return {
      conversationId,
      ownLastReadSeq: nextSeq,
      unreadCount,
    };
  }

  /**
   * 5. Recipient delivery acknowledgement (marks Sent -> Delivered truthfully; zero read status)
   */
  async ackDelivery(accountId: string, conversationId: string, dto: SequenceAckDto) {
    const auth = await this.assertActiveMatchConversationMember(accountId, conversationId);
    const prismaAny = this.prisma as any;
    const upToSeq = Math.max(0, Math.floor(dto.upToSequenceNo));
    const now = new Date();

    let updatedCount = 0;
    if (upToSeq > 0 && typeof prismaAny.message?.updateMany === 'function') {
      const res = await prismaAny.message
        .updateMany({
          where: {
            conversationId,
            senderAccountId: { not: accountId },
            sequenceNo: { lte: BigInt(upToSeq) },
            deliveryState: 'sent',
          },
          data: {
            deliveryState: 'delivered',
            deliveredAt: now,
          },
        })
        .catch(() => ({ count: 0 }));
      updatedCount = Number(res?.count || 0);
    }

    if (upToSeq > 0 && typeof prismaAny.conversationMember?.updateMany === 'function') {
      await prismaAny.conversationMember
        .updateMany({
          where: {
            conversationId,
            accountId,
            lastDeliveredSeq: { lt: BigInt(upToSeq) },
          },
          data: { lastDeliveredSeq: BigInt(upToSeq) },
        })
        .catch(() => null);
    }

    if (updatedCount > 0) {
      this.realtimeBus?.publishConversationEvent(
        conversationId,
        'message.delivered',
        { conversationId, upToSequenceNo: upToSeq },
        {
          recipientAccountIds: auth.partnerAccountId
            ? [auth.partnerAccountId, accountId]
            : [accountId],
          version: upToSeq,
        },
      );
    }

    return {
      conversationId,
      acknowledgedSeq: upToSeq,
      transitionedCount: updatedCount,
    };
  }

  /**
   * 6a. Presign Private R2 Upload URL for a Voice Note (conversation-authorized)
   */
  async presignVoiceNoteForConversation(
    accountId: string,
    conversationId: string,
    dto: MessagingVoiceNotePresignDto,
  ) {
    await this.assertActiveMatchConversationMember(accountId, conversationId);

    const allowed = getAllowedVoiceNoteMimes();
    const baseMime = (dto.mimeType || '').split(';')[0].trim().toLowerCase();
    if (!allowed.includes(baseMime as any)) {
      throw new BadRequestException(
        `Unsupported voice note format: ${dto.mimeType}. Allowed: WebM, Ogg, M4A/MP4, MP3, WAV, AAC.`,
      );
    }

    const maxBytes = getMaxVoiceNoteBytes();
    if (dto.fileSizeBytes && dto.fileSizeBytes > maxBytes) {
      throw new BadRequestException(
        `Voice note exceeds maximum size limit of ${Math.round(maxBytes / (1024 * 1024))} MB.`,
      );
    }
    if (dto.durationSeconds > VOICE_NOTE_MAX_DURATION_SEC || dto.durationSeconds < 1) {
      throw new BadRequestException(
        `Voice notes must be between 1 and ${VOICE_NOTE_MAX_DURATION_SEC} seconds (Doc 02 §4.3).`,
      );
    }

    const mediaRefId = crypto.randomUUID();
    const ext = extensionForVoiceNoteMime(normalizeVoiceNoteMime(baseMime));
    const s3Key = `voice_notes/${conversationId}/${mediaRefId}.${ext}`;

    const uploadToken = this.signUploadToken({
      accountId,
      conversationId,
      mediaRefId,
      s3Key,
      mimeType: baseMime,
      claimedDurationSeconds: dto.durationSeconds,
      maxBytes,
      expMs: Date.now() + 10 * 60 * 1000,
    });

    const r2 = this.createR2Client();
    if (!r2) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('Private audio storage is not configured.');
      }
      return {
        uploadUrl: null,
        adapterMode: 'local_stub_non_prod' as const,
        mediaRefId,
        uploadToken,
        expiresInSeconds: 300,
        maxBytes,
        maxDurationSeconds: VOICE_NOTE_MAX_DURATION_SEC,
      };
    }

    const command = new PutObjectCommand({
      Bucket: r2.bucket,
      Key: s3Key,
      ContentType: baseMime,
      ...(dto.fileSizeBytes ? { ContentLength: dto.fileSizeBytes } : {}),
    });

    let uploadUrl: string;
    try {
      uploadUrl = await getSignedUrl(r2.client, command, { expiresIn: 300 });
    } catch {
      throw new ServiceUnavailableException(
        'Could not prepare private voice-note upload slot. Please retry.',
      );
    }

    return {
      uploadUrl,
      adapterMode: 'r2_presigned_put' as const,
      mediaRefId,
      uploadToken,
      expiresInSeconds: 300,
      maxBytes,
      maxDurationSeconds: VOICE_NOTE_MAX_DURATION_SEC,
    };
  }

  /**
   * 6b. Server-Verify Uploaded Audio Bytes & Persist Voice-Note Message Atomically (MSG-15..23)
   */
  async sendVoiceNoteToConversation(
    accountId: string,
    conversationId: string,
    dto: SendMessagingVoiceNoteDto,
    idempotencyKey?: string,
  ) {
    const tokenData = this.verifyUploadToken(dto.uploadToken, {
      accountId,
      conversationId,
      mediaRefId: dto.mediaRefId,
    });

    await this.assertActiveMatchConversationMember(accountId, conversationId);

    const prismaAny = this.prisma as any;
    const cleanClientUuid = dto.clientAssignedUuid?.trim() || null;
    const cleanIdemKey = idempotencyKey?.trim() || null;

    // Short-circuit duplicate retries before fetching S3 again
    if (cleanClientUuid && typeof prismaAny.message?.findUnique === 'function') {
      const existingByUuid = await prismaAny.message
        .findUnique({
          where: { clientAssignedUuid: cleanClientUuid },
          include: { media: true },
        })
        .catch(() => null);
      if (existingByUuid) {
        if (
          existingByUuid.senderAccountId !== accountId ||
          existingByUuid.conversationId !== conversationId
        ) {
          throw new ConflictException('Client message identifier conflict.');
        }
        return this.toSanitizedMessageDto(existingByUuid, accountId);
      }
    }

    const r2 = this.createR2Client();
    let verifiedMime = normalizeVoiceNoteMime(tokenData.mimeType);
    let verifiedDurationSec = Math.max(
      1,
      Math.min(
        VOICE_NOTE_MAX_DURATION_SEC,
        Number(dto.durationSeconds || tokenData.claimedDurationSeconds || 1),
      ),
    );
    let verifiedBytes = 1024;
    let verifiedSha256: string | null = null;

    if (r2) {
      let rawBuffer: Buffer;
      try {
        const obj = await r2.client.send(
          new GetObjectCommand({ Bucket: r2.bucket, Key: tokenData.s3Key }),
        );
        if (obj.ContentLength && obj.ContentLength > tokenData.maxBytes) {
          await r2.client
            .send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: tokenData.s3Key }))
            .catch(() => null);
          throw new BadRequestException('Uploaded voice note exceeds maximum allowed file size.');
        }
        rawBuffer = await readLimitedS3Body(obj.Body, tokenData.maxBytes);
      } catch (err: any) {
        if (err instanceof BadRequestException) {
          throw err;
        }
        throw new NotFoundException('Uploaded voice note object was not found in private storage.');
      }

      try {
        const verified = await verifyVoiceNoteBinary(
          rawBuffer,
          tokenData.mimeType,
          dto.durationSeconds || tokenData.claimedDurationSeconds,
        );
        verifiedMime = verified.detectedMime;
        verifiedDurationSec = verified.durationSeconds;
        verifiedBytes = verified.sizeBytes;
        verifiedSha256 = verified.sha256;
      } catch (err) {
        await r2.client
          .send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: tokenData.s3Key }))
          .catch(() => null);
        throw err;
      }
    } else if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('Private audio storage is not configured.');
    }

    try {
      let emitAfterCommit: {
        partnerAccountId: string | null;
        messageId: string;
        sequenceNo: number;
        createdAt: string;
        outboxCreated: boolean;
      } | null = null;

      const sanitized = await this.runInTx(async (tx) => {
        // Re-check Match/Block/Account authorization before locking conversation row to keep matches -> conversations lock order
        const auth = await this.assertActiveMatchConversationMember(
          accountId,
          conversationId,
          tx,
        );
        await this.lockConversationRow(tx, conversationId);

        if (cleanClientUuid && typeof tx.message?.findUnique === 'function') {
          const existingByUuid = await tx.message
            .findUnique({
              where: { clientAssignedUuid: cleanClientUuid },
              include: { media: true },
            })
            .catch(() => null);
          if (existingByUuid) {
            return this.toSanitizedMessageDto(existingByUuid, accountId);
          }
        }

        const scopedKey = cleanIdemKey
          ? `${accountId}:vn:${conversationId}:${cleanIdemKey}`
          : null;
        const requestHash = crypto
          .createHash('sha256')
          .update(`vn:${accountId}:${conversationId}:${dto.mediaRefId}`)
          .digest('hex');

        if (scopedKey && typeof tx.idempotencyRecord?.findUnique === 'function') {
          const cached = await tx.idempotencyRecord
            .findUnique({ where: { idempotencyKey: scopedKey } })
            .catch(() => null);
          if (cached) {
            if (cached.requestHash !== requestHash) {
              throw new ConflictException('Idempotency key reused for a different voice note.');
            }
            return cached.responseBody;
          }
        }

        const lastMsg = await tx.message.findFirst({
          where: { conversationId },
          orderBy: { sequenceNo: 'desc' },
          select: { sequenceNo: true },
        });
        const nextSeqNum = (lastMsg ? Number(lastMsg.sequenceNo) : 0) + 1;
        const sequenceNo = BigInt(nextSeqNum);
        const now = new Date();

        const createdMessage = await tx.message.create({
          data: {
            conversationId,
            sequenceNo,
            senderAccountId: accountId,
            ...(cleanClientUuid ? { clientAssignedUuid: cleanClientUuid } : {}),
            messageType: 'voice_note',
            bodyText: null,
            mediaRefId: dto.mediaRefId,
            deliveryState: 'sent',
            media: {
              create: {
                id: dto.mediaRefId,
                mediaType: verifiedMime,
                durationSeconds: verifiedDurationSec,
                s3Key: tokenData.s3Key,
                fileSizeBytes: verifiedBytes,
                sha256: verifiedSha256,
                processingStatus: 'ready',
                uploaderAccountId: accountId,
              },
            },
          },
          include: { media: true },
        });

        await tx.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: now },
        });

        if (typeof tx.conversationMember?.updateMany === 'function') {
          await tx.conversationMember
            .updateMany({
              where: { conversationId, accountId },
              data: {
                lastReadSeq: sequenceNo,
                lastDeliveredSeq: sequenceNo,
              },
            })
            .catch(() => null);
        }

        let outboxCreated = false;
        if (typeof tx.outboxEvent?.create === 'function') {
          await tx.outboxEvent.create({
            data: {
              aggregateType: 'conversation',
              aggregateId: conversationId,
              eventType: 'message.created',
              payload: {
                conversationId,
                messageId: createdMessage.id,
                sequenceNo: nextSeqNum,
                messageType: 'voice_note',
                createdAt:
                  createdMessage.createdAt instanceof Date
                    ? createdMessage.createdAt.toISOString()
                    : now.toISOString(),
              },
              status: 'pending',
              retryCount: 0,
              nextAttemptAt: now,
              processedAt: null,
            },
          });
          outboxCreated = true;
        }

        const dtoOut = await this.toSanitizedMessageDto(createdMessage, accountId);

        if (scopedKey && typeof tx.idempotencyRecord?.create === 'function') {
          await tx.idempotencyRecord
            .create({
              data: {
                idempotencyKey: scopedKey,
                accountId,
                requestHash,
                responseStatus: 201,
                responseBody: dtoOut,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              },
            })
            .catch(() => null);
        }

        emitAfterCommit = {
          partnerAccountId: auth.partnerAccountId,
          messageId: createdMessage.id,
          sequenceNo: nextSeqNum,
          createdAt: dtoOut.createdAt,
          outboxCreated,
        };

        return dtoOut;
      });

      if (emitAfterCommit) {
        const ev = emitAfterCommit as {
          partnerAccountId: string | null;
          messageId: string;
          sequenceNo: number;
          createdAt: string;
          outboxCreated: boolean;
        };
        if (this.outboxRelay && ev.outboxCreated) {
          void this.outboxRelay.triggerImmediateFlush().catch(() => null);
        } else {
          const recipients = ev.partnerAccountId
            ? [ev.partnerAccountId, accountId]
            : [accountId];
          this.realtimeBus?.publishConversationEvent(
            conversationId,
            'message.created',
            {
              conversationId,
              messageId: ev.messageId,
              sequenceNo: ev.sequenceNo,
              messageType: 'voice_note',
              createdAt: ev.createdAt,
            },
            { recipientAccountIds: recipients, version: ev.sequenceNo },
          );
        }
      }

      return sanitized;
    } catch (err) {
      this.wrapStorageFailure(err);
    }
  }

  /**
   * 6c. Authorized Same-Origin Proxy Descriptor (Option A / ADR-023)
   */
  async getAuthorizedMediaUrl(accountId: string, mediaId: string) {
    const prismaAny = this.prisma as any;
    const media = await prismaAny.messageMedia.findUnique({
      where: { id: mediaId },
      include: { message: true },
    });

    if (!media || !media.message) {
      throw new ForbiddenException('Voice-note media is unavailable.');
    }

    try {
      await this.assertActiveMatchConversationMember(
        accountId,
        media.message.conversationId,
      );
    } catch {
      throw new ForbiddenException('Voice-note media is unavailable.');
    }

    return {
      mediaId: media.id,
      url: `/api/bff/v1/messaging/media/${encodeURIComponent(media.id)}/stream`,
      mimeType: media.mediaType,
      durationSeconds: media.durationSeconds ?? null,
      expiresInSeconds: null,
      accessMode: 'same_origin_proxy',
    };
  }

  /**
   * Parses an HTTP Range header (`bytes=start-end`, `bytes=start-`, or `bytes=-suffix`)
   * per RFC 9110 §14. Rejects multi-range or out-of-bounds specs fail-closed.
   */
  parseHttpByteRange(
    rangeHeader: string | undefined | null,
    totalSize: number,
  ):
    | { kind: 'full' }
    | { kind: 'single'; start: number; end: number }
    | { kind: 'invalid' } {
    if (!rangeHeader || !rangeHeader.trim()) {
      return { kind: 'full' };
    }
    const trimmed = rangeHeader.trim();
    if (!/^bytes=/i.test(trimmed)) {
      return { kind: 'invalid' };
    }
    const spec = trimmed.slice(6).trim();
    if (!spec || spec.includes(',')) {
      return { kind: 'invalid' };
    }
    const match = /^(\d*)-(\d*)$/.exec(spec);
    if (!match) {
      return { kind: 'invalid' };
    }
    const [, rawStart, rawEnd] = match;
    if (!rawStart && !rawEnd) {
      return { kind: 'invalid' };
    }

    if (!rawStart) {
      const suffix = Number(rawEnd);
      if (!Number.isInteger(suffix) || suffix <= 0 || totalSize <= 0) {
        return { kind: 'invalid' };
      }
      const start = Math.max(0, totalSize - suffix);
      return { kind: 'single', start, end: totalSize - 1 };
    }

    const start = Number(rawStart);
    if (!Number.isInteger(start) || start < 0 || start >= totalSize) {
      return { kind: 'invalid' };
    }
    if (!rawEnd) {
      return { kind: 'single', start, end: totalSize - 1 };
    }

    const parsedEnd = Number(rawEnd);
    if (!Number.isInteger(parsedEnd) || parsedEnd < start) {
      return { kind: 'invalid' };
    }
    const end = Math.min(parsedEnd, totalSize - 1);
    return { kind: 'single', start, end };
  }

  /**
   * 6d. Authenticated Streaming Proxy Endpoint Handler (Option A / ADR-023)
   * Streams private R2/S3 voice notes with HTTP Range support (`200`/`206`/`416`),
   * enforces MatchAuthorizationService on every request & seek, never leaks R2 URLs/keys,
   * and aborts active streams immediately on disconnect or live match/account revocation.
   */
  async streamVoiceNoteMedia(
    accountId: string,
    mediaId: string,
    req: {
      method?: string;
      headers?: Record<string, string | string[] | undefined>;
      on?: (ev: string, cb: () => void) => void;
      off?: (ev: string, cb: () => void) => void;
    },
    res: {
      status: (code: number) => any;
      setHeader: (name: string, value: string | number) => void;
      end: (chunk?: any) => void;
      write?: (chunk: any) => boolean;
      destroyed?: boolean;
      writableEnded?: boolean;
      on?: (ev: string, cb: () => void) => void;
      off?: (ev: string, cb: () => void) => void;
    },
  ): Promise<void> {
    if (!UUID_PATTERN.test(mediaId)) {
      throw new ForbiddenException('Voice-note media is unavailable.');
    }

    const prismaAny = this.prisma as any;
    const media = await prismaAny.messageMedia.findUnique({
      where: { id: mediaId },
      include: { message: true },
    });

    // Uniform 403 closes mediaId UUID existence enumeration oracle
    if (!media || !media.message) {
      throw new ForbiddenException('Voice-note media is unavailable.');
    }

    const conversationId = media.message.conversationId;
    try {
      await this.assertActiveMatchConversationMember(accountId, conversationId);
    } catch {
      throw new ForbiddenException('Voice-note media is unavailable.');
    }

    const r2 = this.createR2Client();
    if (!r2) {
      throw new ServiceUnavailableException('Private audio storage is not configured.');
    }

    let totalSize = Number(media.fileSizeBytes || 0);
    let detectedContentType = normalizeVoiceNoteMime(media.mediaType || 'audio/webm');
    let objectEtag: string | null = null;
    let objectLastModified: Date | null = null;

    try {
      const head = await r2.client.send(
        new HeadObjectCommand({ Bucket: r2.bucket, Key: media.s3Key }),
      );
      if (typeof head.ContentLength === 'number' && head.ContentLength > 0) {
        totalSize = head.ContentLength;
      }
      if (head.ContentType && head.ContentType.startsWith('audio/')) {
        detectedContentType = normalizeVoiceNoteMime(media.mediaType || head.ContentType);
      }
      if (head.ETag) objectEtag = head.ETag;
      if (head.LastModified) objectLastModified = new Date(head.LastModified);
    } catch {
      throw new ForbiddenException('Voice-note media is unavailable.');
    }

    if (!Number.isFinite(totalSize) || totalSize <= 0) {
      throw new ForbiddenException('Voice-note media is unavailable.');
    }

    const rawRangeHeader = Array.isArray(req.headers?.range)
      ? req.headers.range[0]
      : req.headers?.range;
    const rawIfRangeHeader = Array.isArray(req.headers?.['if-range'])
      ? req.headers['if-range'][0]
      : req.headers?.['if-range'];
    let parsedRange:
      | { kind: 'full' }
      | { kind: 'single'; start: number; end: number }
      | { kind: 'invalid' } = this.parseHttpByteRange(rawRangeHeader, totalSize);

    if (parsedRange.kind === 'single' && rawIfRangeHeader && String(rawIfRangeHeader).trim()) {
      const ifRangeVal = String(rawIfRangeHeader).trim();
      const matchesEtag = Boolean(
        objectEtag &&
          ifRangeVal.replace(/^W\//i, '') === String(objectEtag).replace(/^W\//i, ''),
      );
      const parsedDate = Date.parse(ifRangeVal);
      const matchesDate = Boolean(
        objectLastModified &&
          Number.isFinite(parsedDate) &&
          Math.floor(objectLastModified.getTime() / 1000) <= Math.floor(parsedDate / 1000),
      );
      if (!matchesEtag && !matchesDate) {
        parsedRange = { kind: 'full' };
      }
    }

    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Vary', 'Authorization');
    res.setHeader('Accept-Ranges', 'bytes');
    if (objectEtag) {
      res.setHeader('ETag', objectEtag);
    }
    if (objectLastModified) {
      res.setHeader('Last-Modified', objectLastModified.toUTCString());
    }

    if (parsedRange.kind === 'invalid') {
      res.setHeader('Content-Range', `bytes */${totalSize}`);
      res.status(416).end();
      return;
    }

    const isPartial = parsedRange.kind === 'single';
    const start = parsedRange.kind === 'single' ? parsedRange.start : 0;
    const end = parsedRange.kind === 'single' ? parsedRange.end : totalSize - 1;
    const contentLength = end - start + 1;
    const statusCode = isPartial ? 206 : 200;

    res.setHeader('Content-Type', detectedContentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Content-Length', String(contentLength));
    if (isPartial) {
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    }

    if (String(req.method || 'GET').toUpperCase() === 'HEAD') {
      res.status(statusCode).end();
      return;
    }

    const abortController = new AbortController();
    let s3BodyStream: Readable | null = null;
    let cleanedUp = false;

    const terminateStream = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      abortController.abort();
      if (s3BodyStream && !s3BodyStream.destroyed) {
        s3BodyStream.destroy();
      }
      if (!res.writableEnded && !res.destroyed) {
        res.end();
      }
    };

    const unsubRevoke = this.realtimeBus?.subscribe((ev) => {
      if (
        (ev.kind === 'match_ended' && ev.conversationId === conversationId) ||
        (ev.kind === 'account_revoked' && ev.accountId === accountId)
      ) {
        terminateStream();
      }
    });

    const onClientClose = () => {
      terminateStream();
    };
    req.on?.('close', onClientClose);
    res.on?.('close', onClientClose);

    try {
      const obj = await r2.client.send(
        new GetObjectCommand({
          Bucket: r2.bucket,
          Key: media.s3Key,
          ...(isPartial ? { Range: `bytes=${start}-${end}` } : {}),
        }),
        { abortSignal: abortController.signal },
      );

      await this.assertActiveMatchConversationMember(accountId, conversationId);

      if (!obj.Body) {
        res.status(403).end();
        return;
      }

      if (typeof (obj.Body as any).pipe === 'function') {
        s3BodyStream = obj.Body as Readable;
      } else if (typeof (obj.Body as any).transformToWebStream === 'function') {
        s3BodyStream = Readable.fromWeb((obj.Body as any).transformToWebStream());
      } else {
        const bytes = await (obj.Body as any).transformToByteArray();
        if (!cleanedUp && !res.writableEnded) {
          res.status(statusCode).end(Buffer.from(bytes));
        }
        return;
      }

      res.status(statusCode);
      await new Promise<void>((resolve) => {
        const finish = () => resolve();
        s3BodyStream!.on('data', (chunk: Buffer) => {
          if (cleanedUp || res.destroyed || res.writableEnded) {
            terminateStream();
            return;
          }
          const ok = res.write ? res.write(chunk) : true;
          if (!ok && s3BodyStream) {
            s3BodyStream.pause();
            res.on?.('drain', () => {
              s3BodyStream?.resume();
            });
          }
        });
        s3BodyStream!.once('end', () => {
          if (!res.writableEnded && !res.destroyed) {
            res.end();
          }
          finish();
        });
        s3BodyStream!.once('error', () => {
          terminateStream();
          finish();
        });
        s3BodyStream!.once('close', finish);
      });
    } catch {
      terminateStream();
    } finally {
      cleanedUp = true;
      unsubRevoke?.();
      req.off?.('close', onClientClose);
      res.off?.('close', onClientClose);
    }
  }
}
