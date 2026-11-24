import { NextRequest, NextResponse } from 'next/server';
import { CSRF_COOKIE, attachCsrfCookie } from '../../../../lib/server-bff';

export async function GET(request: NextRequest) {
  const existing = request.cookies.get(CSRF_COOKIE)?.value;
  const token = existing || crypto.randomUUID().replace(/-/g, '');
  const response = NextResponse.json({ ok: true, csrfToken: token }, { status: 200 });
  attachCsrfCookie(request, response, token);
  return response;
}
