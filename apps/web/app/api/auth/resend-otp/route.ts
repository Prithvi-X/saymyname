import { NextRequest, NextResponse } from 'next/server';
import { getBackendBaseUrl, verifyOriginAndCsrf } from '../../../../lib/server-bff';

export async function POST(request: NextRequest) {
  const csrfErr = verifyOriginAndCsrf(request);
  if (csrfErr) return csrfErr;

  const body = await request.text();
  try {
    const res = await fetch(`${getBackendBaseUrl()}/identity/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      cache: 'no-store',
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: 'SayMyName API service is unavailable.' }, { status: 503 });
  }
}
