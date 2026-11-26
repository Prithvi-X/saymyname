import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isSafeInternalReturnPath } from './lib/return-path';

const PROTECTED_PREFIXES = ['/discover', '/likes', '/matches', '/chats', '/profile'];
const DEV_SYNTHETIC_JWT_SECRET = 'dev-synthetic-access-secret-do-not-use-in-prod';

function getJwtSecret(): string {
  const configured = process.env.JWT_ACCESS_SECRET;
  if (configured && configured.length > 0) return configured;
  if (process.env.NODE_ENV === 'production') return '';
  return DEV_SYNTHETIC_JWT_SECRET;
}

function base64UrlToUint8Array(b64u: string): Uint8Array {
  const pad = '='.repeat((4 - (b64u.length % 4)) % 4);
  const b64 = (b64u + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

async function verifyJwtEdge(token: string): Promise<{
  valid: boolean;
  expired: boolean;
  discoveryEligible?: boolean;
}> {
  const secret = getJwtSecret();
  if (!secret || !token) return { valid: false, expired: false };

  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, expired: false };

  const [headerB64, payloadB64, sigB64] = parts;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const sigBytes = base64UrlToUint8Array(sigB64);
    const sigBuffer = new ArrayBuffer(sigBytes.byteLength);
    new Uint8Array(sigBuffer).set(sigBytes);
    const verified = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBuffer,
      enc.encode(`${headerB64}.${payloadB64}`),
    );
    if (!verified) return { valid: false, expired: false };

    const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(payloadB64));
    const payload = JSON.parse(payloadJson);
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) {
      return { valid: false, expired: true };
    }

    return {
      valid: true,
      expired: false,
      discoveryEligible: Boolean(payload.discoveryEligible),
    };
  } catch {
    return { valid: false, expired: false };
  }
}

export function isSafeReturnPath(raw: string): boolean {
  return isSafeInternalReturnPath(raw);
}

function ensureCsrfCookie(request: NextRequest, response: NextResponse): NextResponse {
  if (!request.cookies.get('smn_csrf')?.value) {
    const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol;
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    const secure = proto.includes('https') || (process.env.NODE_ENV === 'production' && !isLocalHost);
    response.cookies.set('smn_csrf', crypto.randomUUID().replace(/-/g, ''), {
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
      secure,
      maxAge: 7 * 24 * 60 * 60,
    });
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtected) {
    return ensureCsrfCookie(request, NextResponse.next());
  }

  const accessToken = request.cookies.get('smn_access_token')?.value || '';
  const refreshToken = request.cookies.get('smn_refresh_token')?.value || '';

  if (!accessToken && !refreshToken) {
    const loginUrl = new URL('/login', request.url);
    if (isSafeReturnPath(pathname)) {
      loginUrl.searchParams.set('returnUrl', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (accessToken) {
    const secret = getJwtSecret();
    if (secret) {
      const check = await verifyJwtEdge(accessToken);
      if (check.valid) {
        if (!check.discoveryEligible) {
          return NextResponse.redirect(new URL('/onboarding', request.url));
        }
        return ensureCsrfCookie(request, NextResponse.next());
      }

      if (!check.expired || !refreshToken) {
        const loginUrl = new URL('/login', request.url);
        if (isSafeReturnPath(pathname)) {
          loginUrl.searchParams.set('returnUrl', pathname);
        }
        const res = NextResponse.redirect(loginUrl);
        res.cookies.delete('smn_access_token');
        if (!refreshToken) res.cookies.delete('smn_refresh_token');
        return res;
      }
    }
  }

  // Expired access cookie with active refresh cookie passes to SSR layout guard for authoritative refresh & check
  return ensureCsrfCookie(request, NextResponse.next());
}

export const config = {
  matcher: [
    '/login',
    '/onboarding/:path*',
    '/discover/:path*',
    '/likes/:path*',
    '/matches/:path*',
    '/chats/:path*',
    '/profile/:path*',
  ],
};
