import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  AccessToken,
  ParticipantInfo,
  RoomServiceClient,
  TrackSource,
  TwirpError,
} from 'livekit-server-sdk';

export class CallingProviderUnavailableError extends ServiceUnavailableException {
  constructor(message = 'Audio calling service is temporarily unavailable.') {
    super({
      code: 'CALLING_PROVIDER_UNAVAILABLE',
      message,
    });
  }
}

export interface IssuedAudioJoinToken {
  token: string;
  participantIdentity: string;
  livekitUrl: string;
  expiresAt: string;
  ttlSeconds: number;
}

export interface EvictionAttemptResult {
  outcome: 'evicted' | 'already_absent';
  participantIdentities: string[];
  roomDeleted: 'deleted' | 'already_absent';
}

export interface CallingProviderPort {
  isConfigured(): boolean;
  getPublicJoinUrl(): string;
  getJoinTokenTtlSeconds(): number;
  buildParticipantIdentity(callSessionId: string, accountId: string): string;
  ensureAudioRoom(input: {
    roomId: string;
    emptyTimeoutSeconds?: number;
    departureTimeoutSeconds?: number;
  }): Promise<void>;
  issueAudioJoinToken(input: {
    roomId: string;
    callSessionId: string;
    accountId: string;
    ttlSeconds?: number;
  }): Promise<IssuedAudioJoinToken>;
  removeParticipant(input: {
    roomId: string;
    callSessionId: string;
    accountId: string;
    revokeTokenTs?: number;
  }): Promise<{ outcome: 'evicted' | 'already_absent'; identity: string }>;
  deleteRoom(roomId: string): Promise<'deleted' | 'already_absent'>;
  listParticipants(roomId: string): Promise<ParticipantInfo[]>;
  evictSession(input: {
    roomId: string;
    callSessionId: string;
    participantAccountIds: string[];
    revokeTokenTs?: number;
  }): Promise<EvictionAttemptResult>;
}

const DEFAULT_JOIN_TOKEN_TTL_SECONDS = 300;
const MIN_JOIN_TOKEN_TTL_SECONDS = 60;
const MAX_JOIN_TOKEN_TTL_SECONDS = 300;
const WEAK_PLACEHOLDER_SECRETS = new Set([
  'devkey',
  'secret',
  'dev-secret',
  'livekit-dev-secret',
  'changeme',
  'replace-me',
]);

export function resolveLiveKitServiceHttpUrl(publicWsUrl: string): string {
  const override = String(process.env.LIVEKIT_SERVICE_URL || process.env.LIVEKIT_INTERNAL_URL || '').trim();
  if (override) {
    return override.replace(/\/+$/, '');
  }
  const normalized = publicWsUrl.trim().replace(/\/+$/, '');
  if (normalized.startsWith('wss://')) {
    return 'https://' + normalized.slice('wss://'.length);
  }
  if (normalized.startsWith('ws://')) {
    return 'http://' + normalized.slice('ws://'.length);
  }
  return normalized;
}

function isNotFoundProviderError(err: unknown): boolean {
  if (err instanceof TwirpError) {
    return err.status === 404 || err.code === 'not_found';
  }
  const status = (err as { status?: number; statusCode?: number })?.status ??
    (err as { statusCode?: number })?.statusCode;
  const code = String((err as { code?: string })?.code || '').toLowerCase();
  const msg = String((err as { message?: string })?.message || '').toLowerCase();
  return (
    status === 404 ||
    code === 'not_found' ||
    msg.includes('requested participant does not exist') ||
    msg.includes('requested room does not exist') ||
    msg.includes('room not found') ||
    msg.includes('participant not found')
  );
}

function isAlreadyExistsProviderError(err: unknown): boolean {
  if (err instanceof TwirpError) {
    return err.status === 409 || err.code === 'already_exists';
  }
  const status = (err as { status?: number })?.status;
  const code = String((err as { code?: string })?.code || '').toLowerCase();
  return status === 409 || code === 'already_exists';
}

@Injectable()
export class LiveKitProviderAdapter implements CallingProviderPort {
  private cachedClientKey: string | null = null;
  private cachedClient: RoomServiceClient | null = null;

  private getRawConfig(): {
    livekitUrl: string;
    serviceHttpUrl: string;
    apiKey: string;
    apiSecret: string;
    identitySecret: string;
    nodeEnv: string;
  } {
    const livekitUrl = String(process.env.LIVEKIT_URL || '').trim();
    const apiKey = String(process.env.LIVEKIT_API_KEY || '').trim();
    const apiSecret = String(process.env.LIVEKIT_API_SECRET || '').trim();
    const serviceHttpUrl = livekitUrl ? resolveLiveKitServiceHttpUrl(livekitUrl) : '';
    const nodeEnv = String(process.env.NODE_ENV || 'development').trim().toLowerCase();
    const identitySecret =
      String(process.env.CALLING_IDENTITY_HMAC_SECRET || '').trim() ||
      crypto.createHash('sha256').update(`${apiSecret}:smn-calling-identity`).digest('hex');

    return {
      livekitUrl,
      serviceHttpUrl,
      apiKey,
      apiSecret,
      identitySecret,
      nodeEnv,
    };
  }

  isConfigured(): boolean {
    const cfg = this.getRawConfig();
    if (!cfg.livekitUrl || !cfg.serviceHttpUrl || !cfg.apiKey || !cfg.apiSecret) {
      return false;
    }
    if (cfg.nodeEnv === 'production') {
      if (
        cfg.apiSecret.length < 32 ||
        WEAK_PLACEHOLDER_SECRETS.has(cfg.apiKey.toLowerCase()) ||
        WEAK_PLACEHOLDER_SECRETS.has(cfg.apiSecret.toLowerCase()) ||
        cfg.livekitUrl.startsWith('ws://')
      ) {
        return false;
      }
    }
    return true;
  }

  private assertConfigured(): ReturnType<LiveKitProviderAdapter['getRawConfig']> {
    const cfg = this.getRawConfig();
    if (!cfg.livekitUrl || !cfg.serviceHttpUrl || !cfg.apiKey || !cfg.apiSecret) {
      throw new CallingProviderUnavailableError(
        'Audio calling provider credentials are not configured.',
      );
    }
    if (cfg.nodeEnv === 'production') {
      if (
        cfg.apiSecret.length < 32 ||
        WEAK_PLACEHOLDER_SECRETS.has(cfg.apiKey.toLowerCase()) ||
        WEAK_PLACEHOLDER_SECRETS.has(cfg.apiSecret.toLowerCase())
      ) {
        throw new CallingProviderUnavailableError(
          'Production LiveKit credentials failed security validation.',
        );
      }
      if (!cfg.livekitUrl.startsWith('wss://')) {
        throw new CallingProviderUnavailableError(
          'Production LiveKit URL must use secure wss:// transport.',
        );
      }
    }
    return cfg;
  }

  private getRoomServiceClient(): RoomServiceClient {
    const cfg = this.assertConfigured();
    const cacheKey = `${cfg.serviceHttpUrl}|${cfg.apiKey}|${cfg.apiSecret.length}`;
    if (this.cachedClient && this.cachedClientKey === cacheKey) {
      return this.cachedClient;
    }
    this.cachedClient = new RoomServiceClient(cfg.serviceHttpUrl, cfg.apiKey, cfg.apiSecret);
    this.cachedClientKey = cacheKey;
    return this.cachedClient;
  }

  getPublicJoinUrl(): string {
    return this.assertConfigured().livekitUrl;
  }

  getJoinTokenTtlSeconds(): number {
    const raw = Number(process.env.LIVEKIT_JOIN_TOKEN_TTL_SECONDS || DEFAULT_JOIN_TOKEN_TTL_SECONDS);
    if (!Number.isFinite(raw) || raw <= 0) {
      return DEFAULT_JOIN_TOKEN_TTL_SECONDS;
    }
    return Math.min(
      MAX_JOIN_TOKEN_TTL_SECONDS,
      Math.max(MIN_JOIN_TOKEN_TTL_SECONDS, Math.floor(raw)),
    );
  }

  buildParticipantIdentity(callSessionId: string, accountId: string): string {
    const cfg = this.getRawConfig();
    const secret = cfg.identitySecret || 'smn-ephemeral-fallback';
    const digest = crypto
      .createHmac('sha256', secret)
      .update(`${callSessionId}:${accountId}`)
      .digest('hex')
      .slice(0, 24);
    return `smn_p_${digest}`;
  }

  async ensureAudioRoom(input: {
    roomId: string;
    emptyTimeoutSeconds?: number;
    departureTimeoutSeconds?: number;
  }): Promise<void> {
    const client = this.getRoomServiceClient();
    try {
      await client.createRoom({
        name: input.roomId,
        emptyTimeout: input.emptyTimeoutSeconds ?? 120,
        departureTimeout: input.departureTimeoutSeconds ?? 30,
        maxParticipants: 2,
      });
    } catch (err) {
      if (isAlreadyExistsProviderError(err)) {
        return;
      }
      throw new CallingProviderUnavailableError(
        'Could not reserve audio call room on LiveKit SFU.',
      );
    }
  }

  async issueAudioJoinToken(input: {
    roomId: string;
    callSessionId: string;
    accountId: string;
    ttlSeconds?: number;
  }): Promise<IssuedAudioJoinToken> {
    const cfg = this.assertConfigured();
    const baseTtl = this.getJoinTokenTtlSeconds();
    const ttlSeconds =
      typeof input.ttlSeconds === 'number' && Number.isFinite(input.ttlSeconds) && input.ttlSeconds > 0
        ? Math.min(MAX_JOIN_TOKEN_TTL_SECONDS, Math.max(10, Math.floor(input.ttlSeconds)))
        : baseTtl;

    const participantIdentity = this.buildParticipantIdentity(input.callSessionId, input.accountId);
    const token = new AccessToken(cfg.apiKey, cfg.apiSecret, {
      identity: participantIdentity,
      name: 'Member',
      ttl: ttlSeconds,
    });
    token.addGrant({
      roomJoin: true,
      room: input.roomId,
      canPublish: true,
      canPublishSources: [TrackSource.MICROPHONE],
      canSubscribe: true,
      canPublishData: false,
      canUpdateOwnMetadata: false,
      roomCreate: false,
      roomList: false,
      roomRecord: false,
      roomAdmin: false,
    });

    const jwt = await token.toJwt();
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    return {
      token: jwt,
      participantIdentity,
      livekitUrl: cfg.livekitUrl,
      expiresAt,
      ttlSeconds,
    };
  }

  async removeParticipant(input: {
    roomId: string;
    callSessionId: string;
    accountId: string;
    revokeTokenTs?: number;
  }): Promise<{ outcome: 'evicted' | 'already_absent'; identity: string }> {
    const client = this.getRoomServiceClient();
    const identity = this.buildParticipantIdentity(input.callSessionId, input.accountId);
    const revokeTs = Math.floor(input.revokeTokenTs ?? Date.now() / 1000);

    try {
      await client.removeParticipant(input.roomId, identity, {
        revokeTokenTs: BigInt(revokeTs),
      });
      return { outcome: 'evicted', identity };
    } catch (err) {
      if (isNotFoundProviderError(err)) {
        return { outcome: 'already_absent', identity };
      }
      throw new CallingProviderUnavailableError(
        'LiveKit SFU failed to remove participant from active room.',
      );
    }
  }

  async deleteRoom(roomId: string): Promise<'deleted' | 'already_absent'> {
    const client = this.getRoomServiceClient();
    try {
      await client.deleteRoom(roomId);
      return 'deleted';
    } catch (err) {
      if (isNotFoundProviderError(err)) {
        return 'already_absent';
      }
      throw new CallingProviderUnavailableError(
        'LiveKit SFU failed to close terminated audio room.',
      );
    }
  }

  async listParticipants(roomId: string): Promise<ParticipantInfo[]> {
    const client = this.getRoomServiceClient();
    try {
      return await client.listParticipants(roomId);
    } catch (err) {
      if (isNotFoundProviderError(err)) {
        return [];
      }
      throw new CallingProviderUnavailableError(
        'LiveKit SFU failed to list participants for audio room.',
      );
    }
  }

  async evictSession(input: {
    roomId: string;
    callSessionId: string;
    participantAccountIds: string[];
    revokeTokenTs?: number;
  }): Promise<EvictionAttemptResult> {
    const uniqueAccounts = Array.from(new Set(input.participantAccountIds.filter(Boolean)));
    const participantIdentities: string[] = [];
    let anyEvicted = false;

    for (const accountId of uniqueAccounts) {
      const res = await this.removeParticipant({
        roomId: input.roomId,
        callSessionId: input.callSessionId,
        accountId,
        revokeTokenTs: input.revokeTokenTs,
      });
      participantIdentities.push(res.identity);
      if (res.outcome === 'evicted') {
        anyEvicted = true;
      }
    }

    const roomDeleted = await this.deleteRoom(input.roomId);

    return {
      outcome: anyEvicted || roomDeleted === 'deleted' ? 'evicted' : 'already_absent',
      participantIdentities,
      roomDeleted,
    };
  }
}
