import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';

export const ACCESS_COOKIE = 'smn_access_token';
export const REFRESH_COOKIE = 'smn_refresh_token';
export const CSRF_COOKIE = 'smn_csrf';

export function getBackendBaseUrl(): string {
  const defaultLocal = 'http://127.0.0.1:4000';
  const origin =
    process.env.API_BACKEND_URL ||
    (process.env.NODE_ENV === 'production'
      ? process.env.NEXT_PUBLIC_API_ORIGIN || defaultLocal
      : defaultLocal);
  return `${origin.replace(/\/$/, '')}/api/v1`;
}

function isSecureCookie(request: NextRequest): boolean {
  const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const isLocalHost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  return proto.includes('https') || (process.env.NODE_ENV === 'production' && !isLocalHost);
}

export function attachCsrfCookie(request: NextRequest, response: NextResponse, existingToken?: string): string {
  const token = existingToken || crypto.randomBytes(24).toString('hex');
  response.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    secure: isSecureCookie(request),
    maxAge: 7 * 24 * 60 * 60,
  });
  return token;
}

export function setAuthCookies(
  request: NextRequest,
  response: NextResponse,
  accessToken: string,
  refreshToken?: string,
) {
  const secure = isSecureCookie(request);
  response.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: 15 * 60,
  });
  if (refreshToken) {
    response.cookies.set(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure,
      maxAge: 7 * 24 * 60 * 60,
    });
  }
  const existingCsrf = request.cookies.get(CSRF_COOKIE)?.value;
  if (!existingCsrf) {
    attachCsrfCookie(request, response);
  }
}

export function clearAuthCookies(request: NextRequest, response: NextResponse) {
  const secure = isSecureCookie(request);
  response.cookies.set(ACCESS_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: 0,
  });
  response.cookies.set(REFRESH_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure,
    maxAge: 0,
  });
}

/**
 * Verifies same-origin Origin/Referer + double-submit CSRF token on mutating BFF requests (D-P2-02)
 */
export function verifyOriginAndCsrf(request: NextRequest): NextResponse | null {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return null;
  }

  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (host && originUrl.host !== host) {
        return NextResponse.json(
          { message: 'Cross-origin mutating request rejected (Origin mismatch).' },
          { status: 403 },
        );
      }
    } catch {
      return NextResponse.json({ message: 'Malformed Origin header.' }, { status: 403 });
    }
  }

  const cookieCsrf = request.cookies.get(CSRF_COOKIE)?.value || '';
  const headerCsrf = request.headers.get('x-smn-csrf') || '';

  if (!cookieCsrf || !headerCsrf) {
    return NextResponse.json(
      { message: 'Missing CSRF protection token.' },
      { status: 403 },
    );
  }

  const a = Buffer.from(cookieCsrf, 'utf8');
  const b = Buffer.from(headerCsrf, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ message: 'Invalid CSRF token.' }, { status: 403 });
  }

  return null;
}

export function stripSensitiveTokens<T extends Record<string, any>>(payload: T): Omit<T, 'accessToken' | 'refreshToken'> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  const clone = { ...payload };
  delete clone.accessToken;
  delete clone.refreshToken;
  return clone;
}

async function refreshSessionTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    const res = await fetch(`${getBackendBaseUrl()}/identity/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.accessToken && data?.refreshToken) {
      return { accessToken: data.accessToken, refreshToken: data.refreshToken };
    }
    return null;
  } catch {
    return null;
  }
}

export async function forwardAuthenticatedRequest(
  request: NextRequest,
  backendPath: string,
  options: { method?: string; body?: string | null } = {},
): Promise<NextResponse> {
  const baseUrl = getBackendBaseUrl();
  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value || '';
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value || '';

  let rotatedTokens: { accessToken: string; refreshToken: string } | null = null;

  if (!accessToken && refreshToken) {
    rotatedTokens = await refreshSessionTokens(refreshToken);
    if (rotatedTokens) {
      accessToken = rotatedTokens.accessToken;
    }
  }

  const doFetch = async (token: string) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(`${baseUrl}${backendPath}`, {
      method: options.method || request.method,
      headers,
      body: options.body !== undefined ? options.body : undefined,
      cache: 'no-store',
    });
  };

  let backendRes: Response;
  try {
    backendRes = await doFetch(accessToken);
  } catch {
    return NextResponse.json(
      { message: 'SayMyName API service is currently unreachable from BFF.' },
      { status: 503 },
    );
  }

  if (backendRes.status === 401 && refreshToken && !rotatedTokens) {
    rotatedTokens = await refreshSessionTokens(refreshToken);
    if (rotatedTokens) {
      accessToken = rotatedTokens.accessToken;
      backendRes = await doFetch(accessToken);
    }
  }

  const rawText = await backendRes.text();
  let parsed: any = {};
  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    parsed = { message: rawText };
  }

  // If backend returned rotated session tokens inside an eligibility call, preserve them inside HttpOnly cookies cleanly
  if (backendRes.ok && parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.accessToken) {
    rotatedTokens = {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken || rotatedTokens?.refreshToken || refreshToken,
    };
    parsed = stripSensitiveTokens(parsed);
  }

  const response = NextResponse.json(parsed, { status: backendRes.status });

  if (backendRes.status === 401) {
    clearAuthCookies(request, response);
  } else if (rotatedTokens) {
    setAuthCookies(request, response, rotatedTokens.accessToken, rotatedTokens.refreshToken);
  }

  return response;
}
