import { NextRequest, NextResponse } from 'next/server';
import {
  REFRESH_COOKIE,
  getBackendBaseUrl,
  verifyOriginAndCsrf,
  setAuthCookies,
  clearAuthCookies,
} from '../../../../lib/server-bff';

export async function POST(request: NextRequest) {
  const csrfErr = verifyOriginAndCsrf(request);
  if (csrfErr) return csrfErr;

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    const response = NextResponse.json({ message: 'No active session to refresh.' }, { status: 401 });
    clearAuthCookies(request, response);
    return response;
  }

  try {
    const res = await fetch(`${getBackendBaseUrl()}/identity/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.accessToken) {
      const response = NextResponse.json(
        { message: data.message || 'Session refresh failed.' },
        { status: res.status === 403 ? 403 : 401 },
      );
      clearAuthCookies(request, response);
      return response;
    }

    const response = NextResponse.json({ ok: true, expiresIn: data.expiresIn || 900 }, { status: 200 });
    setAuthCookies(request, response, data.accessToken, data.refreshToken);
    return response;
  } catch {
    return NextResponse.json({ message: 'SayMyName API service is unavailable.' }, { status: 503 });
  }
}
