# SayMyName.in — Staging Deployment Checklist (Cumulative Phases 1–4.2)

**Scope:** Preparing an isolated **Staging** environment for Phases 1–4.2 verification (Auth, Verification, Profiles, Discover, Likes, Matches, Outbox Messaging & Streaming Voice Notes, 1:1 LiveKit Calling/`MATCH-22`, and Together Space) without touching Production data or Production DNS.  
**Precondition Blocker:** Repository files previously referenced only one remote Supabase pooler (`aws-0-ap-southeast-1.pooler.supabase.com`) and a Render service (`saymyname-ri9e.onrender.com`, service ID `srv-dc2ogom8bjmc738ai63g`) tracking branch `master` (`761ef79`), while latest verified work is on branch `phase-4-2-together-experience` (branched from `phase-4-1-calling-safety` / `phase-3-5-chats` / `main`). An operator MUST explicitly confirm which Supabase project ref is **Staging** vs **Production** and approve branch promotion before running any step below.

---

## 0. Environment Mapping Template (Complete & Confirm Before Staging Promotion)

| Environment | Database / Project Reference | API Service & Origin | Web Application & Origin | Git Branch Tracked |
|---|---|---|---|---|
| **Local Development** | Docker PostgreSQL `saymyname-postgres` (`localhost:5433/saymyname_dev`) + Redis (`localhost:6379`) | Local NestJS `@saymyname/api` (`http://127.0.0.1:4000/api/v1`) | Local Next.js `@saymyname/web` (`http://127.0.0.1:3001`) | `main` (`cfb5079` + uncommitted Phase 2 work) |
| **Staging** | `[PENDING HUMAN INPUT: Staging Supabase Project Ref & Pooler Host]` | `[PENDING HUMAN INPUT: Staging API Service ID & Origin]` | `[PENDING HUMAN INPUT: Staging Web URL & Project]` | `[PENDING HUMAN INPUT: e.g. main or staging]` |
| **Production** | `[PENDING HUMAN INPUT: Production Supabase Project Ref — DO NOT MUTATE]` | Observed Render `srv-dc2ogom8bjmc738ai63g` (`https://saymyname-ri9e.onrender.com`; confirm `api.saymyname.in` DNS) | Observed Vercel `saymyname.in` / `www.saymyname.in` (Cloudflare CNAME `5f16287efd4a3184.vercel-dns-...`) | Observed `master` (`761ef79`) on Render API; confirm Vercel Web branch `[PENDING]` |

---

## 1. Source Control & Branch Alignment Gate
- [ ] Confirm approved branch to deploy to Staging (`main` after Phase 2 Exit Gate sign-off vs syncing `master` tracked by Render service `srv-dc2ogom8bjmc738ai63g`).
- [ ] Verify `@saymyname/api` and `@saymyname/web` build cleanly (`npm run build --prefix services/api` and `npm run build --prefix apps/web`).
- [ ] Verify zero secrets/`.env*` files are tracked in Git (`git ls-files "*.env*"` returns empty).

## 2. Database Backup, Migration & Approved Remediation Gate
- [ ] **Human Confirmation:** Identify Staging `DATABASE_URL` Supabase project ref separately from Production.
- [ ] Take a pre-migration database snapshot/backup of Staging PostgreSQL before altering schema or rows.
- [ ] Verify pre-migration schema parity against `packages/database/prisma/migrations/00000000000000_baseline/migration.sql`, then mark baseline applied if schema already exists:
  ```bash
  npx prisma migrate resolve --applied 00000000000000_baseline --schema packages/database/prisma/schema.prisma
  ```
- [ ] Deploy additive Phase 2 migration cleanly:
  ```bash
  npx prisma migrate deploy --schema packages/database/prisma/schema.prisma
  ```
- [ ] Confirm `prisma migrate status` reports zero pending migrations.
- [ ] **Separate Human Approval Required:** Apply the non-destructive remediation SQL from `docs/implementation/PHASE2_MIGRATION_AND_ROLLBACK_PLAN.md` (§5) so legacy auto-approved accounts transition to `pending_verification` cleanly (`discovery_eligible = false`, 5 published profiles moved non-destructively to `paused`), `9` rejected-age accounts clear contradictory `student_status = 'approved'`, and zero rows are deleted.

## 3. API Service Environment Variables (Render / Node Backend)
Ensure every required variable is configured in Staging secret storage (never committed to Git):

| Variable | Requirement / Notes | Verified Usage in Code |
|---|---|---|
| `NODE_ENV` | `production` | Fail-closed security checks (`CryptoService`, `VerificationService`, `IdentityService`) |
| `PORT` | `4000` (or platform-injected port) | `services/api/src/main.ts` |
| `DATABASE_URL` | Isolated Staging PostgreSQL connection string | `PrismaService` |
| `REDIS_URL` (or `REDIS_HOST`/`REDIS_PORT`) | Isolated Staging Redis instance | Rate limiting & real-time state |
| `JWT_ACCESS_SECRET` | **>= 32 chars cryptographically random secret** (MUST NOT be dev default; MUST exactly match Web Edge) | `services/api/src/modules/identity/security/crypto.service.ts` |
| `JWT_REFRESH_SECRET` | **>= 32 chars cryptographically random secret** (independent from access secret) | `services/api/src/modules/identity/security/crypto.service.ts` |
| `REVIEWER_API_KEY` | **>= 16 chars random operator secret** (guards `GET /pending`, `GET /evidence/:id/url`, `POST /:id/decision`) | `services/api/src/modules/verification/reviewer.guard.ts` |
| `RESEND_API_KEY` | Valid Resend API key (`re_...`) for real OTP & password-reset mail delivery | `services/api/src/modules/identity/identity.service.ts` |
| `EMAIL_FROM` | Verified sender identity on configured Resend domain (e.g. `SayMyName <auth@...>`) | `services/api/src/modules/identity/identity.service.ts` |
| `R2_ACCOUNT_ID` or `R2_ENDPOINT` | Cloudflare R2 account endpoint (`https://<account>.r2.cloudflarestorage.com`) | `ProfilesService`, `VerificationService` |
| `R2_BUCKET_NAME` | **Private** Staging R2 bucket (public bucket listing/access disabled) | `ProfilesService`, `VerificationService`, `CallingService` |
| `R2_ACCESS_KEY_ID` | R2 S3-compatible access key scoped to Staging bucket | `ProfilesService`, `VerificationService` |
| `R2_SECRET_ACCESS_KEY` | R2 S3-compatible secret key scoped to Staging bucket | `ProfilesService`, `VerificationService` |
| `WEB_APP_URL` | Staging Web origin (for CORS / password reset links) | `IdentityService`, `main.ts` |
| `SUPPORT_EMAIL` | Optional verified support address (if unset, footer/contact gracefully hides synthetic placeholder) | Shared support config |
| `EXPOSE_DEV_OTP` | Unset or `false` (even if `'true'`, `NODE_ENV=production` suppresses `devOtp` in API code) | `IdentityService.shouldExposeDevOtp()` |
| `SKIP_EMAIL_DISPATCH` | Unset or `false` (must dispatch real email via Resend) | `IdentityService.sendEmail()` |
| `SYNTHETIC_VERIFICATION_AUTO_APPROVE` | Unset or `false` (API throws `403` in production if enabled) | `verification.adapters.ts` |

## 4. Web Application Environment Variables (Vercel / Next.js BFF + Edge Middleware)

| Variable | Requirement / Notes | Verified Usage in Code |
|---|---|---|
| `NODE_ENV` | `production` | Cookie `Secure` flag, JWT secret enforcement, `/design-system` lock |
| `API_BACKEND_URL` | Staging API origin WITHOUT trailing `/api/v1` (e.g. `https://<staging-api-host>`) | `apps/web/lib/server-bff.ts`, `apps/web/next.config.mjs` |
| `JWT_ACCESS_SECRET` | **Exact same string as API `JWT_ACCESS_SECRET`** (`apps/web/middleware.ts` Edge JWT verification fails closed if mismatched or unset!) | `apps/web/middleware.ts` |
| `SUPPORT_EMAIL` / `NEXT_PUBLIC_SUPPORT_EMAIL` | Verified support mailbox if active, otherwise omit (never invent unconfigured email) | `apps/web/lib/public-config.ts` |
| `NEXT_PUBLIC_ALLOW_DESIGN_SYSTEM` | Unset / omitted so `/design-system` remains gated in production builds | `apps/web/app/design-system/page.tsx` |
| `NEXT_PUBLIC_API_ORIGIN` | Optional fallback only when `API_BACKEND_URL` is absent; prefer explicit `API_BACKEND_URL` | `apps/web/lib/server-bff.ts` |
| `NEXT_PUBLIC_WS_URL` | Public WebSocket endpoint (`wss://<staging-api-host>/api/v1/ws`) for live chats, calling signals, and Together sync | `apps/web/app/(app)/chats/page.tsx` |

## 4.1 Phase 3.5–4.2 Realtime, Voice-Note & LiveKit Calling Environment Variables (API Service)

| Variable | Requirement / Notes | Verified Usage in Code |
|---|---|---|
| `LIVEKIT_URL` | Managed LiveKit Cloud `wss://...` origin (HTTPS/WSS required in `NODE_ENV=production`) | `LiveKitProviderAdapter` |
| `LIVEKIT_SERVICE_URL` | Derived or explicit `https://...` Twirp RoomService endpoint | `LiveKitProviderAdapter` |
| `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Staging LiveKit project credentials (**enforce `room.auto_create: false` on LiveKit project per `ADR-024`**) | `LiveKitProviderAdapter` |
| `CALLING_IDENTITY_HMAC_SECRET` | Dedicated >= 32 char HMAC secret for pseudonymous `smn_p_*` LiveKit participant IDs | `CallingService` |
| `LIVEKIT_JOIN_TOKEN_TTL_SECONDS` | `300` (bounded `60..300`; never >= `3600`) | `CallingService` |
| `CALL_INVITE_TTL_SECONDS` | `45` (ring timeout) | `CallingService` |
| `DISABLE_OUTBOX_WORKER` | `false` (enable durable `MessagingOutboxRelayService`) | `MessagingOutboxRelayService` |
| `DISABLE_CALL_EVICTION_WORKER` | `false` (enable durable `CallEvictionRelayService` for `MATCH-22`) | `CallEvictionRelayService` |

## 5. Post-Deploy Staging Verification Checklist
1. Confirm `GET https://<staging-api>/api/v1/health` returns HTTP `200`.
2. Confirm `GET https://<staging-web>/design-system` returns disabled/404 when `NEXT_PUBLIC_ALLOW_DESIGN_SYSTEM` is unset.
3. Confirm `GET https://<staging-api>/api/v1/verification-cases/pending` rejects requests without valid `x-smn-reviewer-key` (`403`) and lists pending manual review cases with valid `REVIEWER_API_KEY` (`200`, `integrationMode: "manual_review_only_no_external_provider"`).
4. Confirm `POST /api/auth/register` never returns `devOtp` in JSON (`devOtp === undefined`) and static `123456` OTP returns `401`.
5. Confirm HttpOnly cookies (`smn_access_token`, `smn_refresh_token`) carry `HttpOnly`, `SameSite=Lax`, and `Secure` over HTTPS.
6. After human approval to run the live Staging quota probe, execute:
   ```bash
   ALLOW_LIVE_STAGING_SMOKE=true API_BASE=https://<staging-api>/api/v1 SMOKE_EMAIL=<staging-inbox@ds.study.iitm.ac.in> node scripts/smoke-staging-resend-r2.mjs --confirm-live-quota
   ```
7. Verify Reviewer CLI works end-to-end against Staging (`REVIEWER_API_KEY=<key> API_BASE=https://<staging-api>/api/v1 node scripts/review-verification-queue.mjs list`).
8. Verify Phase 3.5–4.2 runtime paths on Staging: WebSocket connection to `NEXT_PUBLIC_WS_URL`, authenticated `/api/bff/v1/messaging/media/:id/stream` `206` playback, 1:1 audio call accept + unmatch SFU eviction (`room.auto_create: false`), and Together Space invite/accept + Relationship Mode unilateral exit.
9. **Stop Gate:** Obtain explicit sign-off (plus governance sign-off on `D-P35-01`..`03` in `DECISION_REGISTER.md`) before updating Production database, DNS (`api.saymyname.in` / `saymyname.in`), or Production deployments.
