import { NextRequest } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  forwardAuthenticatedRequest,
  verifyOriginAndCsrf,
} from '../../../../../../lib/server-bff';

export async function DELETE(request: NextRequest) {
  const csrfErr = verifyOriginAndCsrf(request);
  if (csrfErr) return csrfErr;

  const hasSessionCookie =
    Boolean(request.cookies.get(ACCESS_COOKIE)?.value) ||
    Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (!hasSessionCookie) {
    return Response.json({ message: 'Authentication required' }, { status: 401 });
  }

  const body = await request.text();
  const res = await forwardAuthenticatedRequest(request, '/identity/me', {
    method: 'DELETE',
    body,
  });

  if (res.ok) {
    clearAuthCookies(request, res);
  }
  return res;
}
