import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(crypto.pbkdf2);

export interface JwtPayload {
  sub: string;
  email: string;
  discoveryEligible: boolean;
  iat?: number;
  exp?: number;
}

const DEV_SYNTHETIC_JWT_SECRET = 'dev-synthetic-access-secret-do-not-use-in-prod';

@Injectable()
export class CryptoService {
  private readonly jwtSecret: string;

  constructor() {
    const configured = process.env.JWT_ACCESS_SECRET;
    if (
      process.env.NODE_ENV === 'production' &&
      (!configured || configured === DEV_SYNTHETIC_JWT_SECRET || configured.length < 24)
    ) {
      throw new Error('JWT_ACCESS_SECRET must be set securely in production.');
    }
    this.jwtSecret = configured || DEV_SYNTHETIC_JWT_SECRET;
  }

  /**
   * Secure password hashing using PBKDF2-HMAC-SHA512 (100,000 iterations + per-hash random salt)
   */
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `pbkdf2$100000$${salt}$${hash}`;
  }

  async hashPasswordAsync(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = await pbkdf2Async(password, salt, 100000, 64, 'sha512');
    return `pbkdf2$100000$${salt}$${derived.toString('hex')}`;
  }

  verifyPassword(password: string, storedHash: string): boolean {
    if (!storedHash || typeof storedHash !== 'string') return false;

    if (storedHash.startsWith('pbkdf2$')) {
      const parts = storedHash.split('$');
      if (parts.length !== 4) return false;
      const iterations = Number(parts[1]);
      const salt = parts[2];
      const originalHash = parts[3];
      if (!Number.isFinite(iterations) || iterations < 10000 || !salt || !originalHash) {
        return false;
      }
      const derived = crypto
        .pbkdf2Sync(password, salt, iterations, 64, 'sha512')
        .toString('hex');
      const a = Buffer.from(derived, 'utf8');
      const b = Buffer.from(originalHash, 'utf8');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    }

    // Legacy 2-part format compatibility (10,000 iterations)
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    const derived = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    const a = Buffer.from(derived, 'utf8');
    const b = Buffer.from(originalHash, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  async verifyPasswordAsync(password: string, storedHash: string): Promise<boolean> {
    if (!storedHash || typeof storedHash !== 'string') return false;

    if (storedHash.startsWith('pbkdf2$')) {
      const parts = storedHash.split('$');
      if (parts.length !== 4) return false;
      const iterations = Number(parts[1]);
      const salt = parts[2];
      const originalHash = parts[3];
      if (!Number.isFinite(iterations) || iterations < 10000 || !salt || !originalHash) {
        return false;
      }
      const derived = (await pbkdf2Async(password, salt, iterations, 64, 'sha512')).toString('hex');
      const a = Buffer.from(derived, 'utf8');
      const b = Buffer.from(originalHash, 'utf8');
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    }

    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    const derived = (await pbkdf2Async(password, salt, 10000, 64, 'sha512')).toString('hex');
    const a = Buffer.from(derived, 'utf8');
    const b = Buffer.from(originalHash, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  /**
   * Server-keyed HMAC for short-lived numeric OTP challenges (prevents offline brute-forcing if DB rows leak)
   */
  hashChallengeCode(code: string, email: string, purpose = 'email_verification'): string {
    return crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${purpose}:${email.toLowerCase().trim()}:${code}`)
      .digest('hex');
  }

  verifyChallengeCode(
    code: string,
    email: string,
    expectedHash: string,
    purpose = 'email_verification',
  ): boolean {
    const computed = this.hashChallengeCode(code, email, purpose);
    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(expectedHash, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  /**
   * RFC 7519 compliant HMAC-SHA256 JWT Generator
   */
  generateJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, expiresInSeconds = 900): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const fullPayload: JwtPayload = {
      ...payload,
      iat: now,
      exp: now + expiresInSeconds,
    };

    const encodedHeader = this.base64Url(JSON.stringify(header));
    const encodedPayload = this.base64Url(JSON.stringify(fullPayload));
    const dataToSign = `${encodedHeader}.${encodedPayload}`;
    const signature = this.hmacSha256(dataToSign, this.jwtSecret);

    return `${dataToSign}.${signature}`;
  }

  /**
   * Verify and decode HMAC-SHA256 JWT (timing-safe length guard)
   */
  verifyJwt(token: string): JwtPayload {
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Invalid token format');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid token format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = this.hmacSha256(dataToSign, this.jwtSecret);

    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      throw new UnauthorizedException('Invalid token signature');
    }

    try {
      const payloadText = Buffer.from(encodedPayload, 'base64url').toString('utf8');
      const payload: JwtPayload = JSON.parse(payloadText);

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        throw new UnauthorizedException('Token has expired');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Malformed token payload');
    }
  }

  generateOpaqueToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private base64Url(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private hmacSha256(data: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(data)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }
}
