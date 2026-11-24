import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * SayMyName Authentication & Route Protection Middleware
 *
 * Strict Access Control Model (Document 01 §3.5 & Document 02):
 * - Public routes: '/', '/login', '/onboarding', '/eligibility', '/safety', '/api/public/*'
 * - Protected routes: '/discover', '/likes', '/matches', '/chats', '/profile'
 *
 * An unauthenticated visitor must NEVER receive protected member content.
 * Redirects unauthenticated requests to /login with a safe returnUrl.
 */

const PROTECTED_PREFIXES = ['/discover', '/likes', '/matches', '/chats', '/profile'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected) {
    const token =
      request.cookies.get('smn_auth_token')?.value ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/discover/:path*',
    '/likes/:path*',
    '/matches/:path*',
    '/chats/:path*',
    '/profile/:path*',
  ],
};
