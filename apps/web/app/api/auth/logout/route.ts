import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  getBackendBaseUrl,
  verifyOriginAndCsrf,
  clearAuthCookies,
} from '../../../../lib/server-bff';

export async function POST(request: NextRequest) {
  const csrfErr = verifyOriginAndCsrf(request);
  if (csrfErr) return csrfErr;

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value || '';
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value || '';

  if (accessToken && refreshToken) {
    await fetch(`${getBackendBaseUrl()}/identity/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    }).catch(() => null);
  }

  const response = NextResponse.json({ message: 'Signed out cleanly.' }, { status: 200 });
  clearAuthCookies(request, response);
  return response;
}
