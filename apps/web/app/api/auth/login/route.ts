import { NextRequest, NextResponse } from 'next/server';
import {
  getBackendBaseUrl,
  verifyOriginAndCsrf,
  setAuthCookies,
  stripSensitiveTokens,
} from '../../../../lib/server-bff';

export async function POST(request: NextRequest) {
  const csrfErr = verifyOriginAndCsrf(request);
  if (csrfErr) return csrfErr;

  const body = await request.text();
  try {
    const res = await fetch(`${getBackendBaseUrl()}/identity/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    const response = NextResponse.json(stripSensitiveTokens(data), { status: 200 });
    if (data.accessToken) {
      setAuthCookies(request, response, data.accessToken, data.refreshToken);
    }
    return response;
  } catch {
    return NextResponse.json(
      { message: 'SayMyName API service is unavailable.' },
      { status: 503 },
    );
  }
}
