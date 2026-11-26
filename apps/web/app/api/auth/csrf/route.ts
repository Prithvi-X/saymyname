import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  attachCsrfCookie,
} from '../../../../lib/server-bff';

export async function GET(request: NextRequest) {
  const existing = request.cookies.get(CSRF_COOKIE)?.value;
  const token = existing || crypto.randomUUID().replace(/-/g, '');
  const hasSession =
    Boolean(request.cookies.get(ACCESS_COOKIE)?.value) ||
    Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  const response = NextResponse.json(
    { ok: true, csrfToken: token, hasSession },
    { status: 200 },
  );
  response.headers.set('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Vary', 'Cookie');
  attachCsrfCookie(request, response, token);
  return response;
}
