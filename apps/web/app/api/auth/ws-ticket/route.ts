import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  verifyOriginAndCsrf,
  forwardAuthenticatedRequest,
} from '../../../../lib/server-bff';

function derivePublicWsUrl(wsPath: string): string {
  const configured =
    process.env.PUBLIC_WS_ORIGIN ||
    process.env.NEXT_PUBLIC_WS_ORIGIN ||
    process.env.NEXT_PUBLIC_API_ORIGIN ||
    process.env.API_BACKEND_URL ||
    'http://127.0.0.1:4000';

  const normalizedOrigin = configured.replace(/\/$/, '').replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
  const cleanPath = wsPath.startsWith('/') ? wsPath : `/${wsPath}`;
  return `${normalizedOrigin}${cleanPath}`;
}

export async function POST(request: NextRequest) {
  const csrfErr = verifyOriginAndCsrf(request);
  if (csrfErr) return csrfErr;

  const hasSessionCookie =
    Boolean(request.cookies.get(ACCESS_COOKIE)?.value) ||
    Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (!hasSessionCookie) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }

  const forwarded = await forwardAuthenticatedRequest(
    request,
    '/messaging/realtime/ticket',
    { method: 'POST', body: '{}' },
  );

  if (!forwarded.ok) {
    return forwarded;
  }

  const body = await forwarded.json().catch(() => null);
  if (!body || !body.ticket) {
    return NextResponse.json(
      { message: 'Realtime ticket response was incomplete.' },
      { status: 502 },
    );
  }

  const wsUrl = derivePublicWsUrl(body.wsPath || '/ws/messaging');
  const nextRes = NextResponse.json(
    {
      ticket: body.ticket,
      wsPath: body.wsPath || '/ws/messaging',
      wsUrl,
      expiresInSeconds: body.expiresInSeconds ?? 45,
    },
    { status: 200 },
  );

  nextRes.headers.set(
    'Cache-Control',
    'private, no-store, no-cache, must-revalidate, max-age=0',
  );
  nextRes.headers.set('Pragma', 'no-cache');
  nextRes.headers.set('Vary', 'Cookie');

  // Preserve any refreshed HttpOnly / CSRF cookies issued during forwardAuthenticatedRequest
  const setCookie = forwarded.headers.getSetCookie?.() || [];
  for (const cookieHeader of setCookie) {
    nextRes.headers.append('Set-Cookie', cookieHeader);
  }

  return nextRes;
}
