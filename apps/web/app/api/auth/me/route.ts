import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  attachCsrfCookie,
  forwardAuthenticatedRequest,
} from '../../../../lib/server-bff';

export async function GET(request: NextRequest) {
  const hasSessionCookie =
    Boolean(request.cookies.get(ACCESS_COOKIE)?.value) ||
    Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (!hasSessionCookie) {
    const response = NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    response.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Vary', 'Cookie');
    if (!request.cookies.get(CSRF_COOKIE)?.value) {
      attachCsrfCookie(request, response);
    }
    return response;
  }

  const response = await forwardAuthenticatedRequest(request, '/identity/me', { method: 'GET' });
  if (!request.cookies.get(CSRF_COOKIE)?.value) {
    attachCsrfCookie(request, response);
  }
  return response;
}
