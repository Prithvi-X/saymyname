# SAYMYNAME.IN — PHASE 3.4 REQUIREMENTS TRACEABILITY MATRIX
## Matches & Connection Management

**Phase:** 3.4 — Matches & Connection Management  
**Branch:** `phase-3-4-matches` (branched from `66467e7` preserving Phase 3.3 & `authenticated-experience-refinement` UI changes)  
**Specification Sources:** Documents 01, 02, 04, 06, 07, 08, 09, 10, Decision Register  
**Evidence Levels:**  
- `VERIFIED_LIVE_E2E` — Verified end-to-end across local PostgreSQL (`saymyname_phase32_audit`), NestJS API, Next.js BFF, local S3 object store, and Headless Microsoft Edge browser (`test-phase3-4-matches-e2e.mjs`).  
- `VERIFIED_UNIT` — Verified in deterministic Node unit/service suites (`92/92` API, `13/13` web).  
- `VERIFIED_STATIC` — Verified via builds, Prisma migration diff, secret scan, and `git diff --check`.  
- `PARTIAL` — Cross-phase external infrastructure item explicitly scoped to Phase 4.  

---

## 1. Phase 3.4 Matches & Connection Management Matrix

| ID | Capability / Spec Alignment | Implementation Surface | Verification Evidence | Classification |
|---|---|---|---|---|
| `DAT-05` / `MATCH-01` | Dedicated `/matches` Concept A workspace showing verified mutual matches (`MatchSummaryDto` + hydrated partner profile), last-message metadata, and responsive detail view (`1440`, `1280`, `768`, `430`, `375`). | `apps/web/app/(app)/matches/page.tsx`, `DatingService.getMatches`, `DatingController` | `phase3-4-matches.test.ts` (`MATCH-PRIV-01`), `test-phase3-4-matches-e2e.mjs` + screenshots `01`, `06`, `09`..`13` | `VERIFIED_LIVE_E2E` |
| `MATCH-02` | Live server-verified match detail inspection (`GET /dating/matches/:matchId`) rejecting ended matches, blocks, or suspended/deleted/revoked accounts with `403`/`404`. | `DatingService.getMatchDetail`, `MatchAuthorizationService.assertAuthorizedForMatch`, `matches/page.tsx` | `phase3-4-matches.test.ts` (`MATCH-PRIV-01`, `AUTH-REVOKE-01`), Edge E2E | `VERIFIED_LIVE_E2E` |
| `MATCH-03` | Paused-discover member retains active bilateral matches while suspended, deleted, age-revoked, and student-revoked partners are excluded immediately. | `DatingService.getMatches`, `verifyParticipantAccountsActive` | `phase3-4-matches.test.ts` (`AUTH-REVOKE-01`), Edge E2E (`SuspendedMatch` excluded) | `VERIFIED_LIVE_E2E` |
| `MATCH-04` (`PRIV-MATCH`) | Zero sensitive field leakage in `/dating/matches*` & `/messaging/conversations*` (`matchedAccountId`, `accountId`, `userLowId`, `userHighId`, `senderAccountId`, `partnerAccountId`, `s3Key`, `dateOfBirth`, roll no, moderation notes omitted); `ageDisplayMode = 'hidden'` renders `Age set to private` without `, null`. Note: signed `photoUrl` URLs inherit Phase 3.1 R2 key prefix `photos/<accountId>/...`. | `DatingService.buildSanitizedMatchSummary`, `toSanitizedCandidateDto`, `MessagingService.getMessages`, `matches/page.tsx`, `chats/page.tsx` | `phase3-4-matches.test.ts`, `test-phase3-4-matches-e2e.mjs` (`inspectNode` non-URL JSON scan + `Arjun PrivateAge` UI & BFF check) | `VERIFIED_LIVE_E2E` |
| `MATCH-07` (`CHATS-LINK`) | Opening conversation from `/matches` deep-links `/chats?matchId=...&conversationId=...`, uses real `conversationId` for `getMessages` / `sendMessage`, and renders an explicit closed-connection notice (`ended-conversation-notice`) on ended/unmatched links or Browser Back. | `apps/web/lib/matches-state.ts` (`buildChatHrefForMatch`), `apps/web/app/(app)/chats/page.tsx` | `matches-state.test.ts`, `test-phase3-4-matches-e2e.mjs` (`02_desktop_1440_chats_from_match.png`, `04_desktop_1440_chats_ended_after_unmatch.png`) | `VERIFIED_LIVE_E2E` |
| `MATCH-10` | Private messaging strictly requires an active bilateral Match + `ConversationMember`; unmatch or block immediately blocks message reads/writes for both users (`403`) inside a shared `FOR SHARE` DB transaction. | `MatchAuthorizationService.lockMatchForShare`, `MessagingService.sendMessage` (`runInTx`), `DatingService.unmatch` | `phase3-4-matches.test.ts`, `test-phase3-4-matches-e2e.mjs` PG race tests & post-unmatch `403` assertions | `VERIFIED_LIVE_E2E` |
| `MATCH-11` (`Doc 01`, `Doc 04`) | Clean **Unmatch** workflow: explicit confirmation dialog explaining zero automatic block/report, `Keep Match` cancellation preserves Match, `Unmatch` executes `POST /dating/matches/:matchId/unmatch` with `Idempotency-Key`, closes Messaging/Calling/Mini-Games/Virtual Dates/Relationship Mode, creates **zero** `UserBlock` or `Report` rows, prevents stale-Like reactivation (`403`), and renders distinct `Connection Closed` (`just_ended`) UX. | `DatingService.unmatch`, `DatingController`, `matches/page.tsx`, `matches-state.ts`, `chats/page.tsx` | `phase3-4-matches.test.ts` (`UNMATCH-SEPARATION-01`), `test-phase3-4-matches-e2e.mjs` (UI + DB + partner `403` + screenshot `03`, `04`, `07`) | `VERIFIED` (`VERIFIED_LIVE_E2E` — promoted from `PARTIAL`) |
| `MATCH-AC-07` | Complete user-facing Unmatch / connection closure UI and post-unmatch navigation protection (`/matches` & `/chats`) replacing the Phase 3.2 prototype cleanly. | `apps/web/app/(app)/matches/page.tsx`, `apps/web/app/(app)/chats/page.tsx`, `IntervalEmptyComposition` | `test-phase3-4-matches-e2e.mjs` + all `13` responsive/state screenshots (`01`..`13`) | `VERIFIED` (`VERIFIED_LIVE_E2E` — promoted from `PARTIAL`) |
| `MATCH-CONC-01` | PostgreSQL transactional concurrency safety: concurrent double-unmatch creates max `1` `MatchStateEvent`; concurrent unmatch vs message/call/game leaves zero orphaned active sessions or post-unmatch messages (`FOR UPDATE` + `FOR SHARE`). | `DatingService.unmatch`, `MatchAuthorizationService.lockMatchForShare`, `MessagingService.sendMessage`, `CallingService`, `TogetherService` | Real PostgreSQL `Promise.all` race tests in `test-phase3-4-matches-e2e.mjs` (Step 3) | `VERIFIED_LIVE_E2E` |
| `SAFETY-SEP-01` | **Block** (`POST /safety/block`) and **Report** (`POST /safety/report`) are separate explicit dialogs/actions; Report deduplicates identical 10-min pending reports with `Idempotency-Key` without blocking or ending the Match alone; Block ends Match cleanly and creates `UserBlock`. | `SafetyController`, `SafetyService.reportUser`, `DatingService.blockUser`, `matches/page.tsx` | `phase3-4-matches.test.ts` (`SAFETY-REPORT-01`), `test-phase3-4-matches-e2e.mjs` (`Arjun Report` + `Rohan Block` screenshot `05`) | `VERIFIED_LIVE_E2E` |

---

## 2. Preserved Cross-Phase Boundary Status

| ID | Summary | Current Status | Notes |
|---|---|---|---|
| `MATCH-22` | External LiveKit SFU teardown & active WebSocket eviction | `PARTIAL` (Preserved) | PostgreSQL session closure and HTTP/JWT revocation verified across all 5 triggers (`test-phase3-2-closure-pg.mjs` & `test-phase3-4-matches-e2e.mjs`); external LiveKit SFU room/participant eviction (`RoomServiceClient`) and WebSocket gateway disconnect remain deferred to Phase 4. |
