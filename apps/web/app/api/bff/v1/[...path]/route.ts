import { NextRequest, NextResponse } from 'next/server';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  verifyOriginAndCsrf,
  forwardAuthenticatedRequest,
} from '../../../../../lib/server-bff';

async function handleProxy(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const csrfErr = verifyOriginAndCsrf(request);
  if (csrfErr) return csrfErr;

  const { path } = await context.params;
  if (!Array.isArray(path) || path.length === 0) {
    return NextResponse.json({ message: 'Missing API path' }, { status: 400 });
  }

  // Strictly block path traversal or Reviewer admin impersonation via web client proxy
  if (path.some((seg) => seg === '..' || seg.includes('..'))) {
    return NextResponse.json({ message: 'Invalid path' }, { status: 400 });
  }

  const hasSessionCookie =
    Boolean(request.cookies.get(ACCESS_COOKIE)?.value) ||
    Boolean(request.cookies.get(REFRESH_COOKIE)?.value);

  if (!hasSessionCookie) {
    return NextResponse.json({ message: 'Authentication required' }, { status: 401 });
  }

  const joinedPath = `/${path.join('/')}${request.nextUrl.search || ''}`;
  const method = request.method.toUpperCase();
  const body =
    method === 'GET' || method === 'HEAD' ? undefined : await request.text();

  return forwardAuthenticatedRequest(request, joinedPath, { method, body });
}

export async function GET(request: NextRequest, context: any) {
  return handleProxy(request, context);
}
export async function HEAD(request: NextRequest, context: any) {
  return handleProxy(request, context);
}
export async function POST(request: NextRequest, context: any) {
  return handleProxy(request, context);
}
export async function PUT(request: NextRequest, context: any) {
  return handleProxy(request, context);
}
export async function PATCH(request: NextRequest, context: any) {
  return handleProxy(request, context);
}
export async function DELETE(request: NextRequest, context: any) {
  return handleProxy(request, context);
}
