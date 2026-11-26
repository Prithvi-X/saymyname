import { AccountLifecycleState } from '@saymyname/contracts';

export interface AuthMeCookieSnapshot {
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
}

export interface AnonymousAuthMePayload {
  authenticated: false;
  user: null;
}

export const ANONYMOUS_AUTH_ME_PAYLOAD: AnonymousAuthMePayload = {
  authenticated: false,
  user: null,
};

/**
 * `/api/auth/me` preserves strict 401 semantics whenever no session cookies
 * are present (preserving BFF API contracts & E2E security checks).
 */
export function evaluateAuthMeSessionPrecheck(snapshot: AuthMeCookieSnapshot): {
  shouldForward: boolean;
  unauthenticatedStatusCode: 401;
  unauthenticatedBody: AnonymousAuthMePayload;
} {
  const hasAnySessionCookie = snapshot.hasAccessToken || snapshot.hasRefreshToken;
  return {
    shouldForward: hasAnySessionCookie,
    unauthenticatedStatusCode: 401,
    unauthenticatedBody: ANONYMOUS_AUTH_ME_PAYLOAD,
  };
}

/**
 * Browser-side precheck helper paired with `GET /api/auth/csrf` (`200 OK`).
 * Avoids firing a guaranteed-failing 401 `/api/auth/me` fetch for ordinary
 * anonymous visitors without cookies, while strictly fetching `/api/auth/me`
 * whenever a session cookie exists (valid, expired, or forged).
 */
export function shouldFetchAuthenticatedMe(
  sessionProbe: { hasSession?: boolean } | null | undefined,
): boolean {
  if (!sessionProbe || typeof sessionProbe.hasSession !== 'boolean') {
    return true;
  }
  return sessionProbe.hasSession;
}

/**
 * Safely interprets a `/api/auth/me` JSON response on the client without ever
 * promoting an anonymous payload (`authenticated: false` or missing `id`) into
 * an authenticated state.
 */
export function isAuthenticatedMePayload(
  payload: unknown,
): payload is {
  id: string;
  email: string;
  displayName?: string | null;
  accountStatus: string;
  lifecycleState?: AccountLifecycleState;
} {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  const candidate = payload as Record<string, unknown>;
  if (candidate.authenticated === false) {
    return false;
  }
  return typeof candidate.id === 'string' && candidate.id.trim().length > 0;
}
