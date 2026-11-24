# ADR-018: Credential Auth, Hardened Email OTP & Next.js BFF HttpOnly Sessions

- **Status:** Accepted
- **Date:** 2026-11-24
- **Decision owner:** Security + Backend + Frontend Lead (`D-P2-02`)
- **Reviewers:** Application Security, Human Project Owner
- **Related tasks / documents:** Document 04 (`D04-04`, `AUTH-01..25`), Document 05 (§6.2, §17 `ADR-06`, `ADR-09`), Document 06 (§5.1, §5.5), `docs/decisions/DECISION_REGISTER.md`

## Context
Audit of `services/api/src/modules/identity/identity.service.ts` and `apps/web/lib/{api.ts,auth-context.tsx}` identified:
1. Unconditional OTP `'123456'` accepted in production (`identity.service.ts:172`).
2. `POST /identity/login` triggers passwordless OTP login without password authentication.
3. Registration passwords (`dto.password`) are discarded and `identity.accounts` has no `password_hash`.
4. Ephemeral in-memory `Map` OTPs with no attempt limits or resend cooldown, plus silent email failures.
5. JWT access/refresh tokens stored in browser `localStorage` and readable JS cookies, checked only by presence in `apps/web/middleware.ts`.

## Decision drivers
- Immediately eliminate the `'123456'` production authentication bypass.
- Align browser auth with Document 05 §6.2 BFF cookie architecture (`HttpOnly; SameSite=Lax`, zero `localStorage` tokens).
- Preserve approved product boundary: **Password login + Email OTP verification only** (no unapproved passwordless OTP login).

## Options considered
1. **Password Login + Persistent Email OTP Verification + Forgot/Reset + Next.js BFF `HttpOnly` Cookies (with CSRF, rotation, revocation).**
2. Allow passwordless OTP login or keep client-side JWTs in `localStorage`.

## Decision
Adopt Option 1 (`Accepted`).
1. **Immediate Production OTP Hardening:** Reject static `'123456'` everywhere in `NODE_ENV === 'production'`. In local non-production tests, OTP verification must use `OtpChallenge` persistence (optionally allowing deterministic test code ONLY when `NODE_ENV === 'test' || ENABLE_DEV_TEST_OTP === 'true'` and **strictly never** when `NODE_ENV === 'production'`).
2. **Credential Storage & Recovery:**
   - Hash passwords using per-account random salt (`CryptoService.hashPassword`) in `identity.accounts.password_hash`.
   - `POST /identity/login` requires `{ email, password }`; remove passwordless OTP login (`RequestLoginOtpDto` flow).
   - Provide `POST /identity/forgot-password` and `POST /identity/reset-password` backed by hashed single-use `PasswordResetToken` rows (`15-30m` TTL) that revoke all existing `AppSession` rows on password reset.
   - Legacy accounts created prior to `password_hash` receive a clear prompt to use Forgot Password / Reset Password to set a credential.
3. **Persistent Hashed `OtpChallenge`:**
   - Stored in PostgreSQL (`identity.otp_challenges`): hashed 6-digit code, 10-minute expiry, max 5 failed attempts (lockout), 60-second resend cooldown, single-use `consumed_at`, purpose (`email_verification`).
   - Resend email failures surface explicitly to API callers (never masked as fake `"OTP sent"` when Resend fails in live/production delivery).
4. **Next.js BFF & Session Hardening:**
   - Implement BFF routes (`apps/web/app/api/auth/{register,verify-otp,login,forgot-password,reset-password,refresh,logout,me,revoke-others}/route.ts`).
   - Store session tokens exclusively in **`HttpOnly; SameSite=Lax; Path=/`** (`Secure` on HTTPS/production) cookies (`smn_access_token`, `smn_refresh_token`, plus HMAC/double-submit CSRF token cookie + `X-SMN-CSRF` validation / Origin verification on state-changing BFF requests).
   - **Zero tokens in `localStorage` or `sessionStorage`.**
   - `AppSession` tracks `token_family_id`, `rotated_from_session_id`, `last_seen_at`, and supports refresh rotation (revoking entire family on replay) plus `POST /identity/sessions/revoke-others`.
   - `apps/web/middleware.ts` cryptographically verifies session cookie integrity / expiry + lifecycle state before rendering protected routes (`(app)/*`, `/onboarding`).

## Consequences and trade-offs
- Mobile (`apps/mobile`) or API integration clients can still call `/api/v1/identity/*` using Bearer tokens cleanly while web browser clients operate purely through BFF `HttpOnly` cookies (zero browser JS access to tokens).

## Security, privacy, safety and operations impact
Mitigates XSS token exfiltration, CSRF on cookie-authenticated endpoints, brute-force OTP guessing, replay of rotated refresh tokens, and the critical `'123456'` production auth bypass.

## Migration / rollback / compatibility
Additive `password_hash`, `email_verified_at`, `otp_challenges`, `password_reset_tokens`, and `app_sessions` family columns preserve all 26 existing rows.

## Evidence and review date
- Target Verification: `REG-001..008`, `OTP-001..006`, `SES-001..007`, negative CSRF/replay/lockout/production-OTP tests, browser storage inspection asserting empty auth keys in `localStorage`.
