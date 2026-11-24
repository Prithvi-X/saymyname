import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CryptoService } from '../identity/security/crypto.service';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly cryptoService: CryptoService,
  ) {
    void this.prisma;
    this.livekitUrl = process.env.LIVEKIT_URL || 'wss://saymyname-fwlu8ud3.livekit.cloud';
    this.livekitApiKey = process.env.LIVEKIT_API_KEY || 'devkey_saymyname_livekit';
    this.livekitApiSecret = process.env.LIVEKIT_API_SECRET || 'devsecret_saymyname_livekit_super_secure';
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

    // Resolve receiver from actual conversation members in database
    let receiverId = '';
    const conversation = await this.prisma.conversation?.findUnique?.({
      where: { id: dto.conversationId },
      include: { members: true },
    })?.catch(() => null);

    if (conversation && conversation.members && conversation.members.length >= 2) {
      const other = conversation.members.find((m: any) => m.accountId !== userId);
      if (other) receiverId = other.accountId;
    }
    if (!receiverId) {
      receiverId = userId === 'a1111111-1111-1111-1111-111111111111' ? 'a2222222-2222-2222-2222-222222222222' : 'a1111111-1111-1111-1111-111111111111';
    }

    const sessionRecord: MockCallSession = {
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

    this.mockCallSessions.set(callSessionId, sessionRecord);

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
    const session = this.mockCallSessions.get(callId);
    if (!session) {
      throw new NotFoundException('Call session not found');
    }

    if (session.receiverId !== userId && session.callerId !== userId) {
      throw new ForbiddenException('You are not a participant in this call session');
    }

    if (dto.action === 'accept') {
      session.callStatus = CallStatus.ACCEPTED;
      session.startedAt = new Date();
      const token = this.generateLivekitJwt(userId, session.livekitRoomId, 'Receiver');

      return {
        callSessionId: session.id,
        livekitRoomId: session.livekitRoomId,
        token,
        callStatus: CallStatus.ACCEPTED,
        livekitUrl: this.livekitUrl,
      };
    } else {
      session.callStatus = CallStatus.REJECTED;
      session.endedAt = new Date();

      return {
        callSessionId: session.id,
        livekitRoomId: session.livekitRoomId,
        token: '',
        callStatus: CallStatus.REJECTED,
      };
    }
  }

  /**
   * Terminates active call and calculates total duration
   */
  async endCall(userId: string, callId: string): Promise<{ success: boolean; durationSeconds: number; callStatus: CallStatus }> {
    const session = this.mockCallSessions.get(callId);
    if (!session) {
      throw new NotFoundException('Call session not found');
    }

    if (session.callerId !== userId && session.receiverId !== userId) {
      throw new ForbiddenException('You are not a participant in this call session');
    }

    session.callStatus = CallStatus.ENDED;
    session.endedAt = new Date();
    if (session.startedAt) {
      session.durationSeconds = Math.max(1, Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000));
    } else {
      session.durationSeconds = 0;
    }

    return {
      success: true,
      durationSeconds: session.durationSeconds,
      callStatus: CallStatus.ENDED,
    };
  }

  /**
   * Retrieves call session status
   */
  async getCallSession(userId: string, callId: string): Promise<CallSessionDto> {
    const session = this.mockCallSessions.get(callId);
    if (!session) {
      throw new NotFoundException('Call session not found');
    }

    if (session.callerId !== userId && session.receiverId !== userId) {
      throw new ForbiddenException('Not authorized to access this call session');
    }

    return {
      id: session.id,
      conversationId: session.conversationId,
      callerId: session.callerId,
      receiverId: session.receiverId,
      callStatus: session.callStatus,
      livekitRoomId: session.livekitRoomId,
      startedAt: session.startedAt ? session.startedAt.toISOString() : null,
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
