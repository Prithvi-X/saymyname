# SAYMYNAME.IN — PHASE 3.3 REQUIREMENTS TRACEABILITY MATRIX
## Likes & Interest Management

**Phase:** 3.3 — Likes & Interest Management  
**Branch:** `phase-3-3-likes` (`parent: phase-3-2-ambient-refinement @ dd8df7d`)  
**Specification Sources:** Documents 01, 02, 03, 04, 06, 07, 08, 09, 10, Decision Register  
**Evidence Levels:**  
- `VERIFIED_LIVE_E2E` — Verified end-to-end across local PostgreSQL (`saymyname_phase32_audit`), NestJS API, Next.js BFF, local S3 object store, and headless Edge browser.  
- `VERIFIED_UNIT` — Verified in deterministic Node unit/service suites (`88/88` API, `9/9` web).  
- `VERIFIED_STATIC` — Verified via builds, Prisma migration diff, and `git diff --check`.  
- `PARTIAL` — Preserved Phase 3.2 cross-phase boundary items (Phase 3.4+ / Phase 4+).

---

## 1. Phase 3.3 Likes & Interest Management Matrix

| ID | Capability / Spec Alignment | Implementation Surface | Verification Evidence | Classification |
|---|---|---|---|---|
| `DAT-04` / `LIKES-01` | Structured `/likes` view with Received & Sent sections and zero deceptive blurred teaser cards or paywalls. | `apps/web/app/(app)/likes/page.tsx`, `Tabs` (`received` / `sent`) | `test-phase3-3-likes-e2e.mjs` + screenshots `01`..`11` | `VERIFIED_LIVE_E2E` |
| `MATCH-05` / `LIKES-02` | Express interest via explicit accessible controls with idempotent mutation and loading/duplicate-click guards. | `/discover`, `/likes`, `DatingService.sendLike`, `likeBackReceivedLike` | `phase3-2-discovery.test.ts`, `phase3-3-likes.test.ts`, Edge E2E | `VERIFIED_LIVE_E2E` |
| `MATCH-06` / `LIKES-03` | Unilateral Like is private interest, never opens conversation alone; reciprocal Like Back atomically creates 1 active `Match` & `Conversation`. | `DatingService.sendLike`, `likeBackReceivedLike`, `ensureMutualMatchForPair` | `phase3-3-likes.test.ts`, `test-phase3-3-likes-e2e.mjs` (`Kabir LikeBack`) | `VERIFIED_LIVE_E2E` |
| `LIKES-04` (`RECV-LIKES-01`) | Received Likes strictly filters out blocked, passed, matched, ended-match, paused, suspended, deleted, under-18, unverified & pending-photo senders. | `DatingService.getReceivedLikes`, `getReceivedLikeDetail`, `DiscoveryEligibilityService` | `phase3-3-likes.test.ts` (`ELIG-LIKES-01`, `RECV-LIKES-01`), live Edge E2E | `VERIFIED_LIVE_E2E` |
| `LIKES-05` (`AGE-PRIVACY`) | Received & Sent Likes never return `accountId`, `dateOfBirth`, roll numbers, or moderation notes; `ageDisplayMode = 'hidden'` returns `age: null, ageVisible: false`. | `DatingService.toSanitizedCandidateDto`, `likes-state.ts` | `phase3-3-likes.test.ts` (`RECV-LIKES-01`), live Edge E2E (`Arjun PrivateAge`) | `VERIFIED_LIVE_E2E` |
| `LIKES-06` (`PASS-RECV-01`) | Pass on incoming Like suppresses sender cleanly from Received Likes & Discover during cooldown without exposing Pass state to sender. | `DatingService.passReceivedLike`, `getReceivedLikes` | `phase3-3-likes.test.ts` (`PASS-RECV-01`), Edge E2E (`Nisha Passable` vs `Sneha SecretPass`) | `VERIFIED_LIVE_E2E` |
| `LIKES-07` (`SENT-LIKES-PRIVACY-01`) | Sent Likes owned strictly by `fromAccountId`; shows pending/withdrawn or redacted `Member unavailable` without revealing moderation/block/pass reasons. | `DatingService.getSentLikes`, `buildRedactedUnavailablePreview`, `likes-state.ts` | `phase3-3-likes.test.ts` (`SENT-LIKES-PRIVACY-01`), `likes-state.test.ts`, Edge E2E (`04_desktop_1440_sent_likes.png`) | `VERIFIED_LIVE_E2E` |
| `LIKES-08` (`Doc 04 / Doc 06 §6.1`) | Safe withdrawal transitions active pending `Like.status` -> `'withdrawn'`, idempotent on retry, strictly rejects active/ended matches (`409`) and non-owners (`403`), prevents stale Like Back matches. | `DatingService.withdrawLike`, `likeBackReceivedLike`, `POST/DELETE /dating/likes/:likeId` | `phase3-3-likes.test.ts` (`WITHDRAW-RACE-01`), Edge E2E (`Priya SentPending`) | `VERIFIED_LIVE_E2E` |
| `LIKES-09` (`CONCURRENCY`) | PostgreSQL transaction row & advisory locks prevent simultaneous `withdraw` + `likeBack` from creating inconsistent Match+withdrawn states. | `DatingService.lockLikeAndPair` (`pg_advisory_xact_lock` + `FOR UPDATE`) | Real PostgreSQL `Promise.all` race test in `test-phase3-3-likes-e2e.mjs` | `VERIFIED_LIVE_E2E` |
| `LIKES-10` (`CURSOR-LIKES-01`) | HMAC-SHA256 keyset `(createdAt, id)` pagination avoids duplicate/skipped rows across mutations and rejects tampered, expired, cross-user, or wrong-scope cursors. | `discovery-cursor.ts` (`encodeLikesCursor`, `decodeLikesCursor`), schema indexes | `phase3-3-likes.test.ts` (`CURSOR-LIKES-01`), Edge E2E (`limit=2` pagination) | `VERIFIED_LIVE_E2E` |
| `PAUSE-01` / `AUTH-GATE` | Member shell SSR/middleware gate + `EligibilityGuard` reject unverified/minor/suspended/deleted accounts (`403`) while giving paused users calm UX + Sent withdrawal access. | `MemberAppLayout`, `middleware.ts`, `EligibilityGuard`, `DatingService`, BFF `no-store` | `phase3-3-likes.test.ts` (`PAUSE-LIKES-01`), Edge E2E (`10_desktop_1440_paused_likes.png`, unauth `/login` redirect) | `VERIFIED_LIVE_E2E` |

---

## 2. Preserved Phase 3.2 Cross-Phase Boundary Status

| ID | Summary | Current Status | Notes |
|---|---|---|---|
| `MATCH-11` / `MATCH-AC-07` | Full user-facing Unmatch UI | `PARTIAL` (Preserved) | Backend `/dating/unmatch` & downstream closure complete; `apps/web/app/(app)/matches/page.tsx` UI belongs to Phase 3.4. |
| `MATCH-22` | External LiveKit SFU teardown & WebSocket eviction | `PARTIAL` (Preserved) | PostgreSQL & HTTP JWT revocation verified across all 5 triggers; LiveKit `RoomServiceClient` room ejection belongs to Phase 4. |
