# SAYMYNAME.IN — PHASE 3.2 FINAL ACCEPTANCE & RELEASE READINESS AUDIT

**Phase:** 3.2 — Discover & Profile Discovery  
**Branch:** `phase-3-2-ambient-refinement`  
**Parent Checkpoint:** `phase-3-1-profile` (`dd8df7d`)  
**Audit Date:** 2026-11-25  

---

## 1. Evidence Classification Summary

### A. Fully Implemented and Integration-Tested (Real PostgreSQL + Real API + Real Next.js BFF + Headless Edge)
- **Database Schema & Migrations (`20261125000000_phase3_2_discover_dob_and_indexes`, `20261125010000_phase3_2_align_index_names`)**: Tested end-to-end on clean local PostgreSQL 17 (`saymyname_phase32_audit`) starting from Baseline + Phase 2 migrations; verified zero schema drift (`prisma migrate diff --exit-code` = `0`) and idempotent re-execution (`No pending migrations to apply`).
- **Real Discovery Feed, Eligibility, Reciprocal Filters & Interactions (`scripts/test-phase3-2-discover-e2e.mjs`)**: Verified full `Browser -> Next.js BFF (/api/auth/login + /api/bff/v1/*) -> NestJS API -> PostgreSQL -> Browser` flow across 14 synthetic member scenarios:
  - Reciprocal age & 4-programme intersection filtering (both forward and reverse directions enforced against server `AccountEligibility.date_of_birth` and `programme_family`).
  - Dormant `maxDistanceKm` preservation (different coarse cities with `maxDistanceKm: 5` remain eligible; zero coordinate/distance output).
  - Exclusion of reversed-age incompatible, reversed-programme incompatible, paused (`isPaused = true`), pre-blocked (`user_blocks`), missing-DOB (`AGE_VERIFICATION` lifecycle + `403` on Discover), pending/non-approved photo, and already active-matched profiles.
  - Hidden age privacy (`ageDisplayMode = 'hidden'`: `age: null, ageVisible: false` in BFF JSON; renders `"Arjun Hidden"` without `", null"`).
  - Unilateral Like persistence (`1 Like`, `0 Match`, `0 Conversation`, `0 ConversationMember`).
  - Reciprocal Like persistence (`1 Match` with `userLowId < userHighId`, `1 Conversation`, `2 ConversationMember`s, Mutual Match Interval modal rendered).
  - Private 30-day Pass suppression persisted across reloads.
  - Bidirectional Block via UI modal + direct `GET /api/bff/v1/dating/candidates/:profileId` returning `404` for blocked pair.
  - Post-feed stale availability protection (pausing target in PostgreSQL after feed delivery causes subsequent Like to fail cleanly `404` and advance UI without persisting Like/Match).
  - Authenticated BFF cache isolation (`Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0` & `Vary: Cookie` asserted in Chromium).
- **Full R2 Media & Docker Container HEIC Pipeline (`services/api/Dockerfile`, `test-phase3-2-docker-verify.mjs`, `test-phase3-2-discover-e2e.mjs`)**: Verified real `presignPhoto` -> S3 `PUT` -> server `GetObjectCommand` -> JPEG GPS EXIF strip (`PutObjectCommand`) + genuine still-image `ftypheic` (`libx265`) `ffmpeg`/`sharp` JPEG transcoding (`ContentType: image/jpeg`) -> signed GET URL -> real Chromium `<img>` load in both card and Full Profile modal (`15_real_db_heic_full_profile.png`) + `400` fail-closed rejection and `DeleteObjectCommand` purge for undecodable/malicious HEIC payloads. **Also verified locally inside `saymyname-api:phase32-verify` (`node:22-trixie-slim`, `Node v22.23.5`, `FFmpeg 7.1.5-0+deb13u1`, `UID 1000`, `.dockerignore` active, zero `.env*` baked into image):** writable `/tmp` with zero leftover `smn-heic-*` temp folders, `sharp` + `@prisma/client` + `@aws-sdk/client-s3` load cleanly, container-synthesized still HEIC -> stripped `96x96` JPEG renders in Edge (`IMG_OK:96x96`), JPEG/PNG/WebP EXIF/chunk stripping succeeds inside container, and `NODE_ENV=production` container HTTP `/api/v1/health` + `/api/v1/profiles/catalog` respond `200` against PostgreSQL. (Caught during audit: Debian 12 Bookworm FFmpeg `5.1.9` lists `hevc` codec without supporting still-image HEIF demuxing; hardened `doesFfmpegVersionSupportHeic()` to require FFmpeg major version `>= 7` and upgraded `services/api/Dockerfile` to `node:22-trixie-slim` with FFmpeg `7.1.5`.)
- **Authoritative Match & Downstream Closure (`MATCH-11`, `MATCH-22`, `MATCH-AC-07` — `scripts/test-phase3-2-closure-pg.mjs`)**: Verified real NestJS API + PostgreSQL (`saymyname_phase32_audit`) end-to-end across `Dating`, `Messaging`, `Calling`, `Together`, `Verification`, `Identity`, `Safety`, and `Profiles`:
  - Fixed JWT caller identity resolution (`req.user.sub`) across `CallingController` & `TogetherController`.
  - Unmatching (`POST /dating/unmatch`) transactionally ends active `Match` (`status = 'ended'`, `MatchStateEvent`), closes `Conversation`, ends open `CallSession`/`GameSession`, cancels active `VirtualDate`, deactivates `RelationshipSpace`, marks likes `'unmatched'`, handles repeated unmatch idempotently, rejects unrelated actors (`403`), and prevents silent Like reactivation (`403`).
  - Concurrent unmatch + message/call/game race settled without inconsistent DB state (`ended`/`closed`/`isActive = false`).
  - Verified all 5 invalidation triggers — **Unmatch**, **Block** (`POST /safety/block`), **Account Suspension** (`IdentityService.suspendOrRestrictAccount` / DB status transition), **Age Verification Revocation** (`checkType: 'age'`), and **Student Eligibility Revocation** (`checkType: 'student_enrolment'`) — closing active `CallSession`s, active `GameSession`s, `VirtualDate`s, `RelationshipSpace`s, and denying already-issued HTTP Access JWTs cleanly (`403`/`404`) without conflating reasons or exposing moderator notes/rejection reasons. Accounts with `dateOfBirth = NULL` remain intact (`AGE_VERIFICATION` / `403`) while approved accounts with valid DOB remain `ACTIVE_MEMBER`.
- **Responsive Document 10 Discover UI (`screenshots_phase3_2/`)**: Verified live Chromium rendering across `1440×900`, `1280×800`, `768×1024`, `430×932`, and `375×812` viewports (including Full Profile, Block, Report, Mutual Match Interval, Error Retry, Paused/Resume, Empty/Exhausted states) with zero JS console exceptions and zero horizontal overflow (`Navbar.tsx` tablet breakpoint corrected during audit).

### B. Implemented and Unit-Tested (`services/api/test/phase3-2-discovery.test.ts` & `phase3-2-closure.test.ts` — Mocked Stores Only)
- Full `MATCH-11` / `MATCH-22` cross-module authorization (`MatchAuthorizationService`), real-time & 5-trigger active call/Together invalidation audit (`phase3-2-closure.test.ts`, verifying LiveKit `exp - nbf = 3605`s stateless token generation), controller `req.user.sub` extraction, FFmpeg `>= 7.0` + `DISABLE_HEIC_UPLOAD` fail-closed HEIC gating & dynamic MIME allowlist sync, `R2_FORCE_PATH_STYLE` non-Cloudflare R2 host restriction, and DOB `AGE_VERIFICATION` vs `ACTIVE_MEMBER` invariants (`phase3-2-closure.test.ts`).
- Concurrent mutual Like race handling (`Promise.all` + Prisma `P2002` unique recovery) and `Idempotency-Key` conflict rejection (`409` when key reused across targets).
- `CURSOR_EXPIRED` (past UTC day) and cross-account cursor replay (`403`) & HMAC signature tampering (`400`) unit coverage (`discovery-cursor.ts`).
- PNG chunk (`tEXt`) & WebP (`EXIF`/`XMP`) binary stripping unit verification (`image-security.ts`).
- `MessagingService` block/inactive-match authorization unit verification (`MATCH-10` / `MATCH-22`).
- Complete official API workspace build (`npm run --workspace=@saymyname/api build` exit `0` after clearing stale local `services/api/dist/src/main.js` lock), API test suite (**`81/81` API tests across 9 suites**), **`5/5` web unit tests**, **Next.js build `30/30` routes**, and local Docker image build + container HEIC/health verification (`saymyname-api:phase32-verify` exit `0`).

### C. Static-Only Verification
- UI/copy prohibitions across Phase 3.2 code (`MATCH-15` compatibility scores/soulmate predictions, `MATCH-25` monetization paywalls, zero `images.unsplash`, zero `18+ Student`, zero `rounded-full` card/badge geometry) verified via `rg -n` and `discover/page.tsx` review.
- `git diff --check` clean (`exit 0`).

### D. Partial / Host-Dependent Caveats (Including Unverified Real-Time SFU Eviction & Deferred UI)
- **HEVC Conversion Host Prerequisite & Runtime Capability Gate:** Added `.dockerignore` and reproducible `services/api/Dockerfile` (`node:22-trixie-slim` + FFmpeg `7.1.5` + `hevc` decoder verification) alongside strict runtime probing (`doesFfmpegVersionSupportHeic()` requiring FFmpeg `>= 7.0` + `hevc`, `isHeicDecodingSupported()`, `getAllowedImageMimes()`). When deployed without FFmpeg `>= 7.0` (e.g., Debian 12 FFmpeg `5.1.9`, Windows/serverless without `ffmpeg`, or `DISABLE_HEIC_UPLOAD=true`), the API automatically omits `image/heic` from `/profiles/catalog` (`supportedImageMimes`, synced with web upload inputs) and `/profiles/me/photos/presign`, failing closed (`400`) on HEIC uploads while keeping `/health` `capabilities.heicDecoding` accurate. `R2_FORCE_PATH_STYLE` is ignored on `*.r2.cloudflarestorage.com` hosts and restricted to explicit local/non-R2 S3 endpoints.
- **External LiveKit SFU Disconnect & WebSocket Gap (`MATCH-22` remains `PARTIAL`):** While PostgreSQL `CallSession`, `GameSession`, `VirtualDate`, `RelationshipSpace`, `Match`, and `Conversation` state all close atomically and **all future HTTP API calls & already-issued HTTP Access JWTs fail closed (`403`)** (plus `AppSession` refresh tokens revoke on suspension), `CallingService` issues stateless `3605s` (`nbf`..`exp`) LiveKit JWTs and does **not** invoke external LiveKit `RoomServiceClient.deleteRoom` / `removeParticipant` RPCs to forcibly eject an already-joined LiveKit WebRTC media participant mid-call. Zero `@WebSocketGateway` gateways exist in Phase 3.2. LiveKit server-side room eviction remains unverified and assigned to Phase 4 real-time call hardening.
- **User-Facing Unmatch UI Gap (`MATCH-11` & `MATCH-AC-07` remain `PARTIAL`):** Backend `/dating/unmatch` and downstream authorization across `Messaging`/`Calling`/`Together` are complete and verified live on PostgreSQL; however, `apps/web/app/(app)/matches/page.tsx` currently contains a pre-Phase-3.4 prototype modal calling `api.blockUser(...)` rather than `/dating/unmatch`, and Chats/Calls UI unmatch flows belong to Phase 3.4+/4.
- **Moderation Operator Endpoint/UI:** `IdentityService.suspendOrRestrictAccount` executes atomic suspension/deletion/match-invalidation as a backend domain service; dedicated moderation HTTP endpoints and operator consoles belong to moderation/admin tooling.

### E. Blocked / Intentionally Not Executed
- **Remote Cloud Storage (Live Cloudflare R2 Bucket), Resend Email, & Remote Supabase PostgreSQL:** Intentionally **NOT RUN / NOT TOUCHED** per strict safety/isolation rules (`AGENTS.md`). All R2 integration tests used a real AWS SDK S3 client against a local HTTP path-style S3 server (`127.0.0.1:9009`), and all Postgres tests ran on local container `saymyname-postgres` (`localhost:5433`, disposable DB `saymyname_phase32_audit`).

### F. Deferred to Subsequent Phases
- Incoming Likes Inbox curation & Sent Likes management (**Phase 3.3**).
- Async push/WebSocket mutual-match notifications & chat/calls/games/relationship-mode UI overhauls (**Phase 3.4 / Phase 4+**).
- Optional coarse district/time-zone proximity design review (keeping `maxDistanceKm` dormant until explicit product/privacy sign-off).

### G. Requires Human Approval Before Staging/Production Rollout
1. **Production/Staging Migration Execution & Pre-Phase-3.2 DOB Backfill Decision:**
   - Approve running `prisma migrate deploy` for `20261125000000_phase3_2_discover_dob_and_indexes` and `20261125010000_phase3_2_align_index_names` on staging/production PostgreSQL.
   - **Rollback Strategy (Emergency Only):** No columns or tables are dropped. If emergency schema rollback is required before downstream data depends on `date_of_birth`, apply transactional DDL rollback script: drop the 6 additive indexes (`DROP INDEX IF EXISTS ...`) and optionally `ALTER TABLE "identity"."account_eligibility" DROP COLUMN IF EXISTS "date_of_birth";` (only after explicit backup/human approval).
   - **Legacy Account Policy:** Confirm rollout of age reverification (`AccountLifecycleState.AGE_VERIFICATION` routing via `/onboarding`) for any pre-Phase-3.2 accounts whose `identity.account_eligibility.date_of_birth` is `NULL`, since no historic verified DOB exists in PostgreSQL.
2. **Production Runtime Container (`ffmpeg` HEIC Decoder):** Deploy `@saymyname/api` using `services/api/Dockerfile` (which bundles open-source `ffmpeg` + verifies `hevc` decoder availability); if running native Node without `ffmpeg`, `getAllowedImageMimes()` automatically disables `image/heic` cleanly in runtime/catalog/pickers until Docker is enabled.
3. **Phase 3.2 Exit Sign-Off:** Human review and explicit approval of `phase-3-2-ambient-refinement` commits/PR before merging, pushing, deploying, or initiating Phase 3.3.

---

## 2. DOB Data Integrity Audit Record

| Question | Audited Fact from Code & PostgreSQL |
|---|---|
| Single authoritative DOB column | `identity.account_eligibility.date_of_birth` (`@db.Date`, nullable for additive zero-downtime migration) |
| Any duplicate DOB storage? | **No.** Verified across full `packages/database/prisma/schema.prisma`, `VerificationCase`, `VerificationEvidenceRef`, `AuditEvent`, `Account`, and `Profile`. |
| Prior verified DOB recoverable for backfill? | **No.** `VerificationService.submitAgeVerification` previously stored only `status = 'pending'`, `check_type = 'age'`, `reason_code`, and `{ checkType, reasonCode }` metadata without saving DOB. Zero synthetic/inferred backfill performed. |
| Missing DOB safety behavior | Preserved intact during migration; denied discovery access (`EligibilityGuard` `403`, `DiscoveryEligibilityService`), and routed cleanly to `AGE_VERIFICATION` reverification in `IdentityService.computeLifecycleState`. |
| Verified pre-Phase-3.2 row test | Seeded verified row on `saymyname_phase32_audit` prior to `migrate deploy` remained intact (`active | approved | approved | discovery_eligible=t | date_of_birth=NULL`) and failed closed cleanly on Discover. |

---

## 3. Focused Security Audit Results

| Security Check | Verified Outcome |
|---|---|
| `dateOfBirth`, student roll no, email, phone, private preferences in Discovery DTOs | **PASS** — Omitted in `DatingService.toSanitizedCandidateDto`, asserted absent in unit & live BFF JSON tests (`Arjun Hidden`, etc.). |
| `accountId` exposure on Discover / Like / Pass / Safety | **PASS** — All Phase 3.2 endpoints/BFF calls use opaque `profileId` (`targetProfileId`) only; server resolves `accountId` internally. |
| Cursor forgery, tampering, cross-account replay, expiry | **PASS** — HMAC-SHA256 `timingSafeEqual` verification, `sub === accountId`, `day === today`, `exp > now`. |
| IDOR / Block bypass via `GET /dating/candidates/:profileId` | **PASS** — Enforces requester eligibility, non-self, live state, reciprocal compatibility, and bidirectional `UserBlock` check (`404` on block verified live). |
| Like / Pass / Conversation boundary (`MATCH-10`) | **PASS** — Unilateral Like creates 0 Match/0 Conversation; Messaging enforces active `Match` + active `Conversation` + 0 `UserBlock`. |
| Server-side R2 media inspection & EXIF strip | **PASS** — Client base64 trust removed; `GetObjectCommand` -> magic bytes + pixel decode (`sharp`/`ffmpeg`) -> EXIF/chunk strip -> `PutObjectCommand` -> `DeleteObjectCommand` on invalid binaries. |
| Authenticated cache isolation | **PASS** — `Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0`, `Pragma: no-cache`, `Vary: Cookie` verified live in Edge via `/api/bff/v1/dating/candidates`. |
| Unmatch & account suspension/revocation closure (`MATCH-11`, `MATCH-22`, `MATCH-AC-07`) | **PASS** — Single authoritative `MatchAuthorizationService` enforced across `Dating`, `Messaging`, `Calling`, `Together`, `Safety`, `Verification`, `Identity`, and `Profiles`; concurrent race, idempotency, ended-match non-reactivation, and zero moderator note leak verified live on PostgreSQL (`saymyname_phase32_audit`). |
| Secret & sensitive logging scan | **PASS** — Zero secrets, keys, raw tokens, emails, or DOB values in Phase 3.2 code, logs, or committed reports (`rg` exit clean). |
