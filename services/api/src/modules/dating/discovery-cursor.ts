import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface DiscoveryCursorPayload {
  v: 1;
  sub: string;
  day: string;
  sk: string;
  pid: string;
  exp: number;
}

const CURSOR_TTL_MS = 12 * 60 * 60 * 1000;

export function getDiscoveryUtcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function resolveDiscoveryCursorSecret(): string {
  const secret = process.env.DISCOVERY_CURSOR_SECRET || process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    if (!secret || secret.length < 32 || secret.includes('dev-secret')) {
      throw new ServiceUnavailableException(
        'Discovery cursor signing key is not safely configured.',
      );
    }
    return secret;
  }

  return secret || 'dev-saymyname-discovery-cursor-secret-local';
}

export function encodeDiscoveryCursor(
  accountId: string,
  sortKey: string,
  profileId: string,
  now: Date = new Date(),
): string {
  const payload: DiscoveryCursorPayload = {
    v: 1,
    sub: accountId,
    day: getDiscoveryUtcDay(now),
    sk: sortKey,
    pid: profileId,
    exp: now.getTime() + CURSOR_TTL_MS,
  };

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', resolveDiscoveryCursorSecret())
    .update(encoded)
    .digest('base64url');

  return `${encoded}.${sig}`;
}

export function decodeDiscoveryCursor(
  token: string,
  expectedAccountId: string,
  now: Date = new Date(),
): DiscoveryCursorPayload {
  if (!token || typeof token !== 'string') {
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Discovery pagination cursor is missing.',
    });
  }

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Malformed discovery pagination cursor.',
    });
  }

  const [encoded, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', resolveDiscoveryCursorSecret())
    .update(encoded)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Discovery pagination cursor signature verification failed.',
    });
  }

  let parsed: DiscoveryCursorPayload;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Discovery pagination cursor payload is unreadable.',
    });
  }

  if (
    !parsed ||
    parsed.v !== 1 ||
    typeof parsed.sub !== 'string' ||
    typeof parsed.day !== 'string' ||
    typeof parsed.sk !== 'string' ||
    typeof parsed.pid !== 'string' ||
    typeof parsed.exp !== 'number'
  ) {
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Discovery pagination cursor payload is incomplete.',
    });
  }

  if (parsed.sub !== expectedAccountId) {
    throw new ForbiddenException(
      'Discovery pagination cursor does not belong to the authenticated member.',
    );
  }

  const today = getDiscoveryUtcDay(now);
  if (parsed.exp <= now.getTime() || parsed.day !== today) {
    throw new BadRequestException({
      code: 'CURSOR_EXPIRED',
      message: 'Your discovery session has refreshed. Reloading candidates cleanly.',
    });
  }

  return parsed;
}

export type LikesCursorScope = 'likes_received' | 'likes_sent';

export interface LikesCursorPayload {
  v: 1;
  sub: string;
  scope: LikesCursorScope;
  ts: string;
  lid: string;
  exp: number;
}

const LIKES_CURSOR_TTL_MS = 24 * 60 * 60 * 1000;

export function encodeLikesCursor(
  accountId: string,
  scope: LikesCursorScope,
  createdAtIso: string,
  likeId: string,
  now: Date = new Date(),
): string {
  const payload: LikesCursorPayload = {
    v: 1,
    sub: accountId,
    scope,
    ts: createdAtIso,
    lid: likeId,
    exp: now.getTime() + LIKES_CURSOR_TTL_MS,
  };

  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', resolveDiscoveryCursorSecret())
    .update(encoded)
    .digest('base64url');

  return `${encoded}.${sig}`;
}

export function decodeLikesCursor(
  token: string,
  expectedAccountId: string,
  expectedScope: LikesCursorScope,
  now: Date = new Date(),
): LikesCursorPayload {
  if (!token || typeof token !== 'string') {
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Likes pagination cursor is missing.',
    });
  }

  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Malformed likes pagination cursor.',
    });
  }

  const [encoded, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', resolveDiscoveryCursorSecret())
    .update(encoded)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Likes pagination cursor signature verification failed.',
    });
  }

  let parsed: LikesCursorPayload;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Likes pagination cursor payload is unreadable.',
    });
  }

  if (
    !parsed ||
    parsed.v !== 1 ||
    typeof parsed.sub !== 'string' ||
    (parsed.scope !== 'likes_received' && parsed.scope !== 'likes_sent') ||
    typeof parsed.ts !== 'string' ||
    typeof parsed.lid !== 'string' ||
    typeof parsed.exp !== 'number' ||
    Number.isNaN(new Date(parsed.ts).getTime())
  ) {
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Likes pagination cursor payload is incomplete.',
    });
  }

  if (parsed.sub !== expectedAccountId) {
    throw new ForbiddenException(
      'Likes pagination cursor does not belong to the authenticated member.',
    );
  }

  if (parsed.scope !== expectedScope) {
    throw new BadRequestException({
      code: 'INVALID_CURSOR',
      message: 'Likes pagination cursor scope mismatch.',
    });
  }

  if (parsed.exp <= now.getTime()) {
    throw new BadRequestException({
      code: 'CURSOR_EXPIRED',
      message: 'Your likes session refreshed. Reloading cleanly.',
    });
  }

  return parsed;
}
