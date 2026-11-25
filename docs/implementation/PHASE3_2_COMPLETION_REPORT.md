# SAYMYNAME.IN — PHASE 3.2 COMPLETION REPORT
## Discover & Profile Discovery (Hardened Release Candidate)

**Phase:** 3.2 (Subphase 2 of Phase 3: Core Dating Experience)  
**Branch:** `phase-3-2-ambient-refinement` (parent checkpoint: `phase-3-1-profile` at `dd8df7d`)  
**Product Scope:** Verified adults (18+) currently enrolled in the four approved IIT Madras non-campus BS programmes  
**Design Language:** Document 10 — *THE INTERVAL* (Mineral Night surfaces, `Instrument Sans`, sharp architectural geometry)

---

## 1. Executive Summary

Phase 3.2 delivers and verifies the end-to-end **Discover & Profile Discovery** vertical slice across database schema & migrations, authoritative DOB verification persistence, server-side R2 media binary verification & HEIC decoding, reciprocal eligibility/cursor-pagination/interaction/safety services, Next.js BFF security headers & routes, and the Document 10 Mineral Night `/discover` frontend experience.

All final verification gates ran cleanly **after** all final code edits:
- Official monorepo shared packages + backend API build (`npm run --workspace=@saymyname/api build`, with orphaned `services/api/dist/src/main.js` lock cleared first) — **PASS (exit `0`)**
- Backend API automated suite (`npm run --workspace=@saymyname/api test`) — **81/81 PASS across 9 suites**
- Frontend unit tests (`node --test apps/web/test/discover-state.test.ts`) — **5/5 PASS (exit `0`)**
- Next.js production build (`npm run --workspace=@saymyname/web build`) — **PASS (30/30 routes, exit `0`)**
- Clean disposable PostgreSQL 17 migration diff check (`saymyname_phase32_audit`) — **PASS (`prisma migrate diff --exit-code` = `0`)**
- Real PostgreSQL cross-module closure integration test (`scripts/test-phase3-2-closure-pg.mjs` — all 5 revocation triggers + concurrent race + stale JWT + DOB checks) — **PASS (exit `0`)**
- Live end-to-end S3 + PostgreSQL + NestJS API + Next.js BFF + Headless Edge Browser integration test (`scripts/test-phase3-2-discover-e2e.mjs`) — **PASS (exit `0`)**
- Docker container image build (`services/api/Dockerfile` on `node:22-trixie-slim` with FFmpeg `7.1.5`) & runtime verification (`scripts/test-phase3-2-docker-verify.mjs` — live container HEIC->JPEG transcode, JPEG/PNG/WebP EXIF strip, Edge render, `/health` & `/profiles/catalog`) — **PASS (exit `0`)**
- Live responsive headless Edge QA suite (`1440px`, `1280px`, `768px`, `430px`, `375px`, `15` captured PNG screenshots) — **PASS** (0 JS exceptions, 0 horizontal overflow)
- Repository static secret scan & `git diff --check` — **PASS (`0` leaks / `0` whitespace errors)**

For full gate classification (including environment constraints around production R2/Supabase and Phase 3.3+ deferrals), see [PHASE3_2_FINAL_ACCEPTANCE_AUDIT.md](file:///i:/saymyname/docs/implementation/PHASE3_2_FINAL_ACCEPTANCE_AUDIT.md).

---

## 2. Phase 3.1 Carry-Over Closures & HEIC Media Compatibility

1. **Trusted Server-Side R2 Binary Verification & EXIF Stripping** (`services/api/src/modules/profiles/image-security.ts`, `profiles.service.ts`, `profile.dto.ts`):
   - Removed client `fileBufferBase64` bypass from `AddPhotoDto` and `ProfilesService.addPhoto`.
   - Enforced `GetObjectCommand` download from R2 (`<= 10 MB`), signature inspection (`JPEG`, `PNG`, `WebP`, `HEIC`), pixel decoding (`sharp` / `ffmpeg`), orientation baking & complete EXIF/GPS/XMP/IPTC/chunk stripping, clean overwrite (`PutObjectCommand`), and immediate deletion (`DeleteObjectCommand`) of disguised, spoofed, or undecodable objects.
   - Added opt-in path-style endpoint flag (`R2_FORCE_PATH_STYLE=true`) in `ProfilesService.createR2Client` so local S3-compatible test servers execute real signed S3 flows alongside Cloudflare R2 production deployments.
2. **Real HEIC Decoding Pipeline (`image/heic`)**:
   - Primary decode path attempts `sharp` (`libheif`); when host `libheif` omits proprietary HEVC codecs, `decodeHeicViaLocalFfmpeg` decodes the still HEIC stream privately via local `ffmpeg` (`execFile` without shell interpolation, isolated temp folder cleaned in `finally`), re-encodes stripped pixels via `sharp` into standard browser-displayable `image/jpeg` (`ContentType: image/jpeg`), records server dimensions, and writes clean JPEG bytes back to R2.
   - If neither `sharp` nor `ffmpeg` decodes real image pixels (or an HEIC container is corrupted/fake), `verifyAndSanitizeR2Image` **fails closed (`400 BadRequestException`)**, purges the R2 object, and never marks un-decodable files `approved`.
   - **Container Runtime & Host Capability Gate (`services/api/Dockerfile`, `.dockerignore`, `image-security.ts`):** Added production container build on `node:22-trixie-slim` bundling `ffmpeg 7.1.5` (`libavformat61` / `libavcodec61` with native ISO BMFF still HEIC demuxing + `hevc` decode; Debian 12 Bookworm FFmpeg `5.1.9` was caught lacking still-image HEIC demuxing during Docker testing and is now explicitly rejected by `doesFfmpegVersionSupportHeic()` requiring FFmpeg `>= 7.0`). When `image/heic` decode is unavailable (`DISABLE_HEIC_UPLOAD=true` or absent/old `ffmpeg`), `/profiles/catalog`, `/profiles/me/photos/presign`, `/profiles/me/photos`, and client upload pickers dynamically remove `image/heic`. `R2_FORCE_PATH_STYLE` is restricted to explicit non-Cloudflare R2 S3 endpoints.
   - Verified end-to-end inside both local Windows S3/Chromium (`test-phase3-2-discover-e2e.mjs`, `15_real_db_heic_full_profile.png`) AND the production Linux Docker container (`test-phase3-2-docker-verify.mjs`: real container HEIC -> EXIF-stripped JPEG + Edge `IMG_OK:96x96`, plus JPEG/PNG/WebP sanitization, `/api/v1/health`, `/api/v1/profiles/catalog`, `/tmp` cleanup as `UID 1000`, and zero baked `.env*` files).

---

## 3. PostgreSQL Schema, Migrations & Authoritative DOB Integrity

- **Authoritative Verified DOB Storage:** Added nullable `dateOfBirth DateTime? @map("date_of_birth") @db.Date` on `identity.account_eligibility` (`AccountEligibility` in `packages/database/prisma/schema.prisma`), owned by `identity`. Audit of the entire Prisma schema and `VerificationService` confirmed **no prior DOB column or persisted DOB payload** existed in `Account`, `VerificationCase`, `VerificationEvidenceRef`, `AuditEvent`, or `Profile`; therefore, zero duplicate DOB storage exists.
- **Additive Discovery Indexes & 63-Byte Alignment:** Added migrations `20261125000000_phase3_2_discover_dob_and_indexes` and `20261125010000_phase3_2_align_index_names` (short explicit Prisma `map:` names `"profiles_discovery_status_idx"` and `"profile_photos_ready_idx"` to stay cleanly under PostgreSQL's 63-byte identifier truncation limit).
- **Safe Legacy Handling (No Fake Backfill):** Pre-Phase-3.2 verified accounts without a persisted verified `date_of_birth` remain intact cleanly after migration (`null`), cannot bypass `DiscoveryEligibilityService` or `EligibilityGuard` (`403`), and are routed to `AccountLifecycleState.AGE_VERIFICATION` by `IdentityService.computeLifecycleState` so verified users submit & confirm DOB cleanly via `POST /verification/age` + human review (`D-P2-01`) rather than using unverified or guessed dates.

---

## 4. Discovery Domain, Pagination, Match/Conversation Boundaries & Security

- **Eligibility & Reciprocal Preferences (`discovery-eligibility.service.ts`):** Enforces requester/candidate active account status, adult verified DOB (`>= 18`), approved IITM BS enrolment across the 4 permitted programmes (`data_science_applications`, `electronic_systems`, `aeronautics_space`, `management_data_science`), published live unpaused profile with approved portrait photos, bidirectional age (`[minAge, maxAge]` clamped `18..65`) and programme compatibility, hidden-age privacy (`age: null, ageVisible: false` while using verified DOB server-side), dormant `maxDistanceKm`, and deterministic daily HMAC ordering.
- **Session-Bound Keyset Cursor (`discovery-cursor.ts`):** Uses HMAC-SHA256 keyset pagination `(sortKey, profileId)` bound to authenticated `accountId` + UTC day salt; rejects malformed (`400`), tampered (`400`), cross-user (`403`), and stale (`400 CURSOR_EXPIRED`) tokens cleanly.
- **Match, Unmatch, Revocation & Messaging/Calling/Together Boundaries (`MATCH-10`, `MATCH-11`, `MATCH-22`, `MatchAuthorizationService`):**
  - Unilateral Likes create zero `Match`, zero `Conversation`, and zero `ConversationMember` rows; mutual Likes atomically create strictly one active `Match` (`userLowId < userHighId`, `P2002` + `Idempotency-Key` protected), one active `Conversation`, and both `ConversationMember` records.
  - One shared `MatchAuthorizationService` enforces live participant, `Match.status`, `Conversation.status`, `UserBlock`, `Account`, and `AccountEligibility` checks across `DatingService`, `MessagingService`, `CallingService` (+ `CallingController` `req.user.sub` fix), `TogetherService` (+ `TogetherController` `req.user.sub` fix), `SafetyService`, `VerificationService`, `IdentityService`, and `ProfilesService`.
  - Validated all 5 invalidation triggers (Unmatch, Block, Account Suspension, Age Revocation, Student Revocation) across PostgreSQL/HTTP endpoints, idempotent repeat unmatch, ended-match non-reactivation, concurrent unmatch races, zero moderator note leakage, and already-issued HTTP access JWT denial (`403`). **Scope boundaries retained (`PARTIAL` for `MATCH-11`, `MATCH-AC-07`, `MATCH-22`):** Matches/Chats user-facing unmatch UI (`matches/page.tsx` prototype still targets `blockUser`), moderation endpoints, and external LiveKit SFU `RemoveParticipant`/`DeleteRoom` eviction for active 3605s media tokens remain out of Phase 3.2 scope and belong to Phase 3.4+/4.
- **Safety Integration (`safety.service.ts`, `safety.dto.ts`):** Accepts opaque `targetProfileId`, persists blocks/reports atomically, deactivates active pair Likes (`status: 'blocked'`), and closes shared Conversations/Calls/Games/Dates/Spaces via `MatchAuthorizationService.closeMatchDownstreamState`.
- **BFF & Cache Isolation (`server-bff.ts`, `auth/me/route.ts`):** Attaches `Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0`, `Pragma: no-cache`, and `Vary: Cookie` on all authenticated responses while keeping tokens strictly inside `HttpOnly` cookies.

---

## 5. Automated & Integration Verification Ledger (Post-Final-Edit)

| Check | Scope & Target | Outcome |
|---|---|---|
| `npm run --workspace=@saymyname/api build` | `@saymyname/contracts`, `@saymyname/database` (`prisma generate` v6.19.3), `@saymyname/design-tokens`, `@saymyname/validation`, `@saymyname/api` | **PASS (exit `0`)** |
| `npm run --workspace=@saymyname/api test` | 9 suites (`identity`, `security-prod`, `profiles`, `phase3-1-profile`, `dating`, `phase3-2-discovery`, `phase3-2-closure`, `calling`, `together`) | **PASS (`81/81`, exit `0`)** |
| `node --test apps/web/test/discover-state.test.ts` | Discover UI formatting, hidden-age, programme, batch merge/remove guards | **PASS (`5/5`, exit `0`)** |
| `npm run --workspace=@saymyname/web build` | Next.js 15.5.29 production build across 30 routes + middleware | **PASS (exit `0`)** |
| Disposable Postgres Migration & Diff (`saymyname_phase32_audit`) | Phase 0+2 SQL -> Phase 3.2 migrations -> `prisma migrate diff --exit-code` | **PASS (`0` diff, exit `0`)** |
| `node scripts/test-phase3-2-closure-pg.mjs` | Live Postgres + NestJS HTTP API: all 5 triggers, active Call/Game/VirtualDate/RelationshipSpace closure, concurrent race, idempotency, unrelated `403`, DOB `null` vs valid DOB | **PASS (exit `0`)** |
| `node scripts/test-phase3-2-discover-e2e.mjs` | Live S3 + Postgres + NestJS (`:4001`) + Next.js BFF (`:3005`) + Edge Chromium (`15` scenarios + HEIC + cache headers) | **PASS (exit `0`)** |
| `docker build` + `node scripts/test-phase3-2-docker-verify.mjs` | `saymyname-api:phase32-verify` (`node:22-trixie-slim`, FFmpeg `7.1.5`): HEIC->JPEG inside container, Edge render `IMG_OK:96x96`, JPEG/PNG/WebP strip, `/health` & `/profiles/catalog`, zero baked secrets | **PASS (exit `0`)** |
| `git diff --check` & `rg` static secret scan | Whitespace/conflict markers, Unsplash/stock URLs, forbidden badges, credential patterns | **PASS (`0` leaks, exit `0`)** |
| Browser Visual QA (`phase3_2_browser_qa.mjs`) | 15 screenshots across `1440px`, `1280px`, `768px`, `430px`, `375px` (`Navbar` + `/discover` modals & states) | **PASS (`0` JS errors / overflow)** |

---

## 6. Readiness Summary

All Phase 3.2 backend discovery, database schema/migration, HEIC/JPEG/PNG/WebP media verification (both host & Docker Trixie FFmpeg 7.1.5 runtime), BFF cache/CSRF security, authoritative unmatch/suspension/revocation backend closure, and Document 10 Mineral Night `/discover` UI checks pass cleanly on local branch `phase-3-2-ambient-refinement`. `MATCH-11`, `MATCH-AC-07`, and `MATCH-22` intentionally remain `PARTIAL` in traceability due to Phase 3.4+/4 UI unmatch screens and external LiveKit SFU disconnect remaining outside Phase 3.2 scope. Ready for human review and release gating prior to **Phase 3.3**.
