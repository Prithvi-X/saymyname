import { describe, test } from 'node:test';
import * as assert from 'node:assert';
import {
  ANONYMOUS_AUTH_ME_PAYLOAD,
  evaluateAuthMeSessionPrecheck,
  isAuthenticatedMePayload,
  shouldFetchAuthenticatedMe,
} from '../lib/auth-session-status.ts';
import { AccountLifecycleState } from '../../../packages/contracts/dist/enums/index.js';

describe('BFF /api/auth/me Anonymous & Session Handling (Phase 2 Technical Foundation)', () => {
  test('anonymous visitor probe returns hasSession=false so AuthProvider stays unauthenticated without triggering 401 console noise', () => {
    assert.strictEqual(shouldFetchAuthenticatedMe({ hasSession: false }), false);
    const directMe = evaluateAuthMeSessionPrecheck({
      hasAccessToken: false,
      hasRefreshToken: false,
    });
    // Direct unauthenticated calls to /api/auth/me still fail closed with 401 (preserving E2E security contract)
    assert.strictEqual(directMe.shouldForward, false);
    assert.strictEqual(directMe.unauthenticatedStatusCode, 401);
    assert.deepStrictEqual(directMe.unauthenticatedBody, ANONYMOUS_AUTH_ME_PAYLOAD);
    assert.strictEqual(isAuthenticatedMePayload(directMe.unauthenticatedBody), false);
  });

  test('valid authenticated session triggers /api/auth/me forward and accepts valid user payload', () => {
    assert.strictEqual(shouldFetchAuthenticatedMe({ hasSession: true }), true);
    const directMe = evaluateAuthMeSessionPrecheck({
      hasAccessToken: true,
      hasRefreshToken: true,
    });
    assert.strictEqual(directMe.shouldForward, true);

    const validUser = {
      id: 'acc-123',
      email: 'student@study.iitm.ac.in',
      displayName: 'Aarav',
      accountStatus: 'active',
      lifecycleState: AccountLifecycleState.ACTIVE_MEMBER,
    };
    assert.strictEqual(isAuthenticatedMePayload(validUser), true);
  });

  test('expired access session with refresh token must trigger /api/auth/me forward for backend refresh or 401 failure', () => {
    assert.strictEqual(shouldFetchAuthenticatedMe({ hasSession: true }), true);
    const directMe = evaluateAuthMeSessionPrecheck({
      hasAccessToken: false,
      hasRefreshToken: true,
    });
    assert.strictEqual(directMe.shouldForward, true);
  });

  test('invalid/tampered access cookie or inconclusive session probe fails closed to /api/auth/me verification', () => {
    assert.strictEqual(shouldFetchAuthenticatedMe(null), true);
    assert.strictEqual(shouldFetchAuthenticatedMe({}), true);
    const directMe = evaluateAuthMeSessionPrecheck({
      hasAccessToken: true,
      hasRefreshToken: false,
    });
    assert.strictEqual(directMe.shouldForward, true);
  });

  test('malformed or spoofed anonymous payloads cannot pass as authenticated', () => {
    assert.strictEqual(isAuthenticatedMePayload(null), false);
    assert.strictEqual(isAuthenticatedMePayload([]), false);
    assert.strictEqual(isAuthenticatedMePayload({ authenticated: false, id: 'acc-123' }), false);
    assert.strictEqual(isAuthenticatedMePayload({ id: '   ' }), false);
    assert.strictEqual(isAuthenticatedMePayload({ user: null }), false);
  });

  test('post-logout cleared cookies resolve anonymous cleanly via probe while /api/auth/me enforces 401', () => {
    assert.strictEqual(shouldFetchAuthenticatedMe({ hasSession: false }), false);
    const postLogoutMe = evaluateAuthMeSessionPrecheck({
      hasAccessToken: false,
      hasRefreshToken: false,
    });
    assert.strictEqual(postLogoutMe.shouldForward, false);
    assert.strictEqual(postLogoutMe.unauthenticatedStatusCode, 401);
  });
});
