import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

export interface JwtPayload {
  sub: string;
  email: string;
  discoveryEligible: boolean;
  iat?: number;
  exp?: number;
}

@Injectable()
export class CryptoService {
  private readonly jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_ACCESS_SECRET || 'dev-synthetic-access-secret-do-not-use-in-prod';
  }

  /**
   * Secure password hashing using PBKDF2 with SHA-512 and salt
   */
  hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password: string, storedHash: string): boolean {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(originalHash));
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
   * Verify and decode HMAC-SHA256 JWT
   */
  verifyJwt(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid token format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const dataToSign = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = this.hmacSha256(dataToSign, this.jwtSecret);

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
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
