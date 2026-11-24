import { NextRequest, NextResponse } from 'next/server';
import {
  getBackendBaseUrl,
  verifyOriginAndCsrf,
  clearAuthCookies,
} from '../../../../lib/server-bff';

export async function POST(request: NextRequest) {
  const csrfErr = verifyOriginAndCsrf(request);
  if (csrfErr) return csrfErr;

  const body = await request.text();
  try {
    const res = await fetch(`${getBackendBaseUrl()}/identity/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    const response = NextResponse.json(data, { status: res.status });
    if (res.ok) {
      clearAuthCookies(request, response);
    }
    return response;
  } catch {
    return NextResponse.json({ message: 'SayMyName API service is unavailable.' }, { status: 503 });
  }
}
