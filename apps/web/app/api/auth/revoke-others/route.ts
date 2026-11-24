import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  verifyOriginAndCsrf,
  forwardAuthenticatedRequest,
} from '../../../../lib/server-bff';

export async function POST(request: NextRequest) {
  const csrfErr = verifyOriginAndCsrf(request);
  if (csrfErr) return csrfErr;

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!accessToken && !refreshToken) {
    return NextResponse.json({ message: 'Unauthenticated' }, { status: 401 });
  }

  return forwardAuthenticatedRequest(request, '/identity/sessions/revoke-others', {
    method: 'POST',
    body: JSON.stringify({ currentRefreshToken: refreshToken || undefined }),
  });
}
