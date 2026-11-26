import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  CSRF_COOKIE,
  attachCsrfCookie,
  forwardAuthenticatedRequest,
} from '../../../../lib/server-bff';
import { evaluateAuthMeSessionPrecheck } from '../../../../lib/auth-session-status';

export async function GET(request: NextRequest) {
  const precheck = evaluateAuthMeSessionPrecheck({
    hasAccessToken: Boolean(request.cookies.get(ACCESS_COOKIE)?.value),
    hasRefreshToken: Boolean(request.cookies.get(REFRESH_COOKIE)?.value),
  });

  if (!precheck.shouldForward) {
    const response = NextResponse.json(precheck.unauthenticatedBody, {
      status: precheck.unauthenticatedStatusCode,
    });
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
