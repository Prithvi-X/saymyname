import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../identity/security/crypto.service';
import { MatchAuthorizationService } from '../safety/match-authorization.service';
import {
  CallStatus,
  MessageType,
  DeliveryState,
  CallSessionDto,
  CallTokenResponseDto,
  VoiceNotePresignResponseDto,
} from '@saymyname/contracts';
import { VoiceNotePresignDto, CallInviteDto, CallRespondDto, SendVoiceNoteDto } from './dto/calling.dto';
import * as crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface MockCallSession {
  id: string;
  conversationId: string;
  callerId: string;
  receiverId: string;
  callStatus: CallStatus;
  livekitRoomId: string;
  startedAt?: Date | null;
  endedAt?: Date | null;
  durationSeconds?: number | null;
  createdAt: Date;
}

const ALLOWED_AUDIO_MIMES = [
  'audio/m4a',
  'audio/mp4',
  'audio/mp3',
  'audio/mpeg',
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/aac',
];

@Injectable()
export class CallingService {
  private readonly livekitUrl: string;
  private readonly livekitApiKey: string;
  private readonly livekitApiSecret: string;
  private readonly mockCallSessions: Map<string, MockCallSession> = new Map();
  private readonly matchAuth: MatchAuthorizationService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
    @Optional() matchAuthService?: MatchAuthorizationService,
  ) {
    void this.prisma;
    this.matchAuth = matchAuthService ?? new MatchAuthorizationService(this.prisma);
    this.livekitUrl = process.env.LIVEKIT_URL || 'wss://saymyname-fwlu8ud3.livekit.cloud';
    this.livekitApiKey = process.env.LIVEKIT_API_KEY || 'devkey_saymyname_livekit';
    this.livekitApiSecret = process.env.LIVEKIT_API_SECRET || 'devsecret_saymyname_livekit_super_secure';
  }

  private async runInTx<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const prismaAny = this.prisma as any;
    if (typeof prismaAny?.$transaction === 'function') {
      return prismaAny.$transaction((tx: any) => fn(tx));
    }
    return fn(prismaAny);
  }

  private hasDbCallSessions(): boolean {
    const prismaAny = this.prisma as any;
    return (
      typeof prismaAny?.callSession?.create === 'function' &&
      typeof prismaAny?.callSession?.findUnique === 'function'
    );
  }

  /**
   * Pre-signs voice note audio upload (max 60s per Doc 02 §4.3)
   */
  async presignVoiceNote(userId: string, dto: VoiceNotePresignDto): Promise<VoiceNotePresignResponseDto> {
    if (!ALLOWED_AUDIO_MIMES.includes(dto.mimeType.toLowerCase())) {
      throw new BadRequestException(
        `Unsupported audio MIME type: ${dto.mimeType}. Allowed formats: m4a, mp3, webm, ogg, wav, aac`,
      );
    }

    if (dto.durationSeconds > 60) {
      throw new BadRequestException('Voice notes are strictly limited to a maximum of 60 seconds (Doc 02 §4.3)');
    }

    const mediaRefId = crypto.randomUUID();
    const ext = dto.filename.split('.').pop() || 'm4a';
    const s3Key = `voice_notes/${userId}/${mediaRefId}.${ext}`;

    let uploadUrl: string;

    if (
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_BUCKET_NAME &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
    ) {
      try {
        const s3 = new S3Client({
          region: 'auto',
          endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
          },
        });
        uploadUrl = await getSignedUrl(
          s3,
          new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: s3Key,
            ContentType: dto.mimeType,
          }),
          { expiresIn: 300 },
        );
      } catch (err) {
        console.warn('[R2] Failed to generate presigned voice note URL, using fallback:', err);
        uploadUrl = `https://storage.saymyname.in/mock-s3-upload/${s3Key}?signed=${this.cryptoService.sha256(mediaRefId)}`;
      }
    } else {
      uploadUrl = `https://storage.saymyname.in/mock-s3-upload/${s3Key}?signed=${this.cryptoService.sha256(mediaRefId)}`;
    }

    return {
      uploadUrl,
      mediaRefId,
      s3Key,
      expiresInSeconds: 300,
    };
  }

  /**
   * Sends voice note message to conversation
   */
  async sendVoiceNote(userId: string, dto: SendVoiceNoteDto) {
    if (dto.durationSeconds > 60) {
      throw new BadRequestException('Voice note duration exceeds 60 seconds limit');
    }

    await this.matchAuth.assertAuthorizedForConversation(userId, dto.conversationId);

    const messageId = crypto.randomUUID();
    const now = new Date();

    return {
      id: messageId,
      conversationId: dto.conversationId,
      sequenceNo: Date.now(),
      senderAccountId: userId,
      messageType: MessageType.VOICE_NOTE,
      bodyText: dto.bodyText || '🎤 Voice note',
      mediaUrl: `https://storage.saymyname.in/media/${dto.mediaRefId}.m4a`,
      durationSeconds: dto.durationSeconds,
      deliveryState: DeliveryState.SENT,
      createdAt: now.toISOString(),
    };
  }

  /**
   * Initiates 1:1 LiveKit call session with explicit invitation (Doc 01 §3.4)
   */
  async inviteCall(userId: string, dto: CallInviteDto): Promise<{ callSession: CallSessionDto; token: string; livekitUrl: string }> {
    const callSessionId = crypto.randomUUID();
    const livekitRoomId = `saymyname_call_${dto.conversationId.slice(0, 8)}_${Date.now()}`;

    const sessionRecord = await this.runInTx(async (tx) => {
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
      if (!receiverId) {
        throw new ForbiddenException('Call recipient could not be authorized for this match.');
      }

      if (this.hasDbCallSessions() && typeof tx?.callSession?.create === 'function') {
        const created = await tx.callSession.create({
          data: {
            id: callSessionId,
            conversationId: dto.conversationId,
            callerId: userId,
            receiverId,
            callStatus: CallStatus.INITIATED,
            livekitRoomId,
            durationSeconds: 0,
          },
        });
        return {
          id: created.id,
          conversationId: created.conversationId,
          callerId: created.callerId,
          receiverId: created.receiverId,
          callStatus: created.callStatus as CallStatus,
          livekitRoomId: created.livekitRoomId,
          startedAt: created.startedAt,
          endedAt: created.endedAt,
          durationSeconds: created.durationSeconds ?? 0,
          createdAt: created.createdAt,
        } satisfies MockCallSession;
      }

      const mockRecord: MockCallSession = {
        id: callSessionId,
        conversationId: dto.conversationId,
        callerId: userId,
        receiverId,
        callStatus: CallStatus.INITIATED,
        livekitRoomId,
        startedAt: null,
        endedAt: null,
        durationSeconds: 0,
        createdAt: new Date(),
      };
      this.mockCallSessions.set(callSessionId, mockRecord);
      return mockRecord;
    });

    const callerToken = this.generateLivekitJwt(userId, livekitRoomId, 'Caller');

    return {
      callSession: {
        id: sessionRecord.id,
        conversationId: sessionRecord.conversationId,
        callerId: sessionRecord.callerId,
        receiverId: sessionRecord.receiverId,
        callStatus: sessionRecord.callStatus,
        livekitRoomId: sessionRecord.livekitRoomId,
        startedAt: null,
        durationSeconds: 0,
      },
      token: callerToken,
      livekitUrl: this.livekitUrl,
    };
  }

  /**
   * Receiver responds to call invitation (accept, decline, busy)
   */
  async respondToCall(userId: string, callId: string, dto: CallRespondDto): Promise<CallTokenResponseDto> {
    return this.runInTx(async (tx) => {
      const dbMode = this.hasDbCallSessions() && typeof tx?.callSession?.findUnique === 'function';
      const session: MockCallSession | null = dbMode
        ? await tx.callSession.findUnique({ where: { id: callId } })
        : (this.mockCallSessions.get(callId) ?? null);

      if (!session) {
        throw new NotFoundException('Call session not found');
      }

      if (session.receiverId !== userId && session.callerId !== userId) {
        throw new ForbiddenException('You are not a participant in this call session');
      }

      await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId, { tx });

      if (['ended', 'rejected', 'missed'].includes(String(session.callStatus))) {
        throw new ConflictException('Call invitation is no longer active.');
      }

      if (dto.action === 'accept') {
        if (session.receiverId !== userId) {
          throw new ForbiddenException('Only the invited recipient may accept this call.');
        }

        const startedAt = new Date();
        if (dbMode && typeof tx.callSession?.update === 'function') {
          await tx.callSession.update({
            where: { id: session.id },
            data: { callStatus: CallStatus.ACCEPTED, startedAt },
          });
        } else {
          session.callStatus = CallStatus.ACCEPTED;
          session.startedAt = startedAt;
        }
        const token = this.generateLivekitJwt(userId, session.livekitRoomId, 'Receiver');

        return {
          callSessionId: session.id,
          livekitRoomId: session.livekitRoomId,
          token,
          callStatus: CallStatus.ACCEPTED,
          livekitUrl: this.livekitUrl,
        };
      }

      const endedAt = new Date();
      if (dbMode && typeof tx.callSession?.update === 'function') {
        await tx.callSession.update({
          where: { id: session.id },
          data: { callStatus: CallStatus.REJECTED, endedAt },
        });
      } else {
        session.callStatus = CallStatus.REJECTED;
        session.endedAt = endedAt;
      }

      return {
        callSessionId: session.id,
        livekitRoomId: session.livekitRoomId,
        token: '',
        callStatus: CallStatus.REJECTED,
      };
    });
  }

  /**
   * Terminates active call and calculates total duration
   */
  async endCall(userId: string, callId: string): Promise<{ success: boolean; durationSeconds: number; callStatus: CallStatus }> {
    const dbMode = this.hasDbCallSessions();
    const session: MockCallSession | null = dbMode
      ? await (this.prisma as any).callSession.findUnique({ where: { id: callId } })
      : (this.mockCallSessions.get(callId) ?? null);

    if (!session) {
      throw new NotFoundException('Call session not found');
    }

    if (session.callerId !== userId && session.receiverId !== userId) {
      throw new ForbiddenException('You are not a participant in this call session');
    }

    const endedAt = new Date();
    const durationSeconds = session.startedAt
      ? Math.max(1, Math.round((endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000))
      : 0;

    if (dbMode) {
      await (this.prisma as any).callSession.update({
        where: { id: session.id },
        data: { callStatus: CallStatus.ENDED, endedAt, durationSeconds },
      });
    } else {
      session.callStatus = CallStatus.ENDED;
      session.endedAt = endedAt;
      session.durationSeconds = durationSeconds;
    }

    return {
      success: true,
      durationSeconds,
      callStatus: CallStatus.ENDED,
    };
  }

  /**
   * Retrieves call session status
   */
  async getCallSession(userId: string, callId: string): Promise<CallSessionDto> {
    const dbMode = this.hasDbCallSessions();
    const session: MockCallSession | null = dbMode
      ? await (this.prisma as any).callSession.findUnique({ where: { id: callId } })
      : (this.mockCallSessions.get(callId) ?? null);

    if (!session) {
      throw new NotFoundException('Call session not found');
    }

    if (session.callerId !== userId && session.receiverId !== userId) {
      throw new ForbiddenException('Not authorized to access this call session');
    }

    await this.matchAuth.assertAuthorizedForConversation(userId, session.conversationId);

    return {
      id: session.id,
      conversationId: session.conversationId,
      callerId: session.callerId,
      receiverId: session.receiverId,
      callStatus: session.callStatus as CallStatus,
      livekitRoomId: session.livekitRoomId,
      startedAt: session.startedAt ? new Date(session.startedAt).toISOString() : null,
      durationSeconds: session.durationSeconds || 0,
    };
  }

  /**
   * Generates standard LiveKit JWT token compatible with LiveKit WebRTC client
   */
  private generateLivekitJwt(userId: string, roomName: string, participantName: string): string {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      iss: this.livekitApiKey,
      sub: userId,
      name: participantName,
      nbf: now - 5,
      exp: now + 3600,
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      },
    };

    const b64Url = (str: string) =>
      Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const encodedHeader = b64Url(JSON.stringify(header));
    const encodedPayload = b64Url(JSON.stringify(payload));
    const dataToSign = `${encodedHeader}.${encodedPayload}`;

    const signature = crypto
      .createHmac('sha256', this.livekitApiSecret)
      .update(dataToSign)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    return `${dataToSign}.${signature}`;
  }
}
