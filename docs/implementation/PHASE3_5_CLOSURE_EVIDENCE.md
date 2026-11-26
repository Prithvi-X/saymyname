# SAYMYNAME.IN — PHASE 3.5 CLOSURE EVIDENCE LEDGER

**Branch:** `phase-3-5-chats`  
**Audit Date:** 2026-11-26  
**Note:** All runtime commands cited below were re-executed cleanly **after the final code edits** (`tsconfig.json`, `Dialog.tsx`, `VoiceNotePlayer.tsx`, `messaging.service.ts`).

| Requirement / Check | Evidence Location | Verification Method | Result | Notes |
|---|---|---|---|---|
| `MSG-01` Match-only conversation unlock | `dating.service.ts` (`ensureMutualMatchForPair`), `phase3-5-messaging.test.ts`, `test-phase3-5-chats-e2e.mjs` | Unit-tested + Integration-tested (PG) | `VERIFIED` | Unilateral Like yields `0` channels; bilateral Match creates `1` active channel |
| `MSG-02` Conversation & media auth | `match-authorization.service.ts`, `messaging.service.ts`, `messaging.gateway.ts` | Code-inspected + Unit-tested + Integration-tested (PG+WS) | `VERIFIED` | Strangers, unmatched, blocked, suspended, deleted, and eligibility-revoked users denied `403` / WS fail |
| `MSG-03` Ordering & cursor pagination | `messaging.service.ts` (`getMessageHistory`, `sendMessage`), `chats/page.tsx` | Unit-tested + Integration-tested + Real browser-tested | `VERIFIED` | `sequenceNo` monotonic `1..34+`; `Load earlier messages` (`beforeSeq`) & `?afterSeq=` verified |
| `MSG-04` / `MSG-05` Sent/Delivered (no Read) | `messaging.service.ts` (`ackDelivery`), `chats-state.ts`, `test-phase3-5-chats-e2e.mjs` | Unit-tested + Integration-tested + Real browser-tested + Screenshot-inspected (`02`, `03`) | `VERIFIED` | Zero `Read` receipts emitted or rendered; `Sent -> Delivered` transitions verified |
| `MSG-06` Offline drafts privacy | `chats-state.ts`, `auth-context.tsx` (`logout`), `chats/page.tsx` | Code-inspected + Real browser-tested | `VERIFIED` | Saved locally per thread, never auto-sent, wiped on `logout()`, send, unmatch, and block |
| `MSG-07` Idempotency & concurrency | `messaging.service.ts` (`lockConversationRow`, `IdempotencyRecord`), `test-phase3-5-chats-e2e.mjs` | Unit-tested + Integration-tested (PG concurrency) + Real browser-tested | `VERIFIED` | `5` parallel sends -> `[1..5]`; duplicate `clientAssignedUuid`/`Idempotency-Key` -> `1` row; failed send retry verified |
| `MSG-08` / `MSG-20` Message/voice reporting | `safety.service.ts`, `SafetyDto`, `chats/page.tsx`, `test-phase3-5-chats-e2e.mjs` | Unit-tested + Integration-tested (PG) + Real browser-tested + Screenshot-inspected (`06`) | `VERIFIED` | Persists `Report.messageId` & `Report.conversationId` without blocking or ending Match |
| `MSG-09` Unmatch vs Block closure | `chats/page.tsx` (`confirmUnmatch`, `confirmBlock`), `dating.service.ts`, `safety.service.ts` | Unit-tested + Integration-tested (PG races + Redis WS) + Screenshot-inspected (`07`, `08`) | `VERIFIED` | Canonical `matches -> conversations` lock fix eliminated `40P01` deadlock; Unmatch leaves `0` `UserBlock` rows |
| `MSG-10` Anti-surveillance & unread count | `messaging.service.ts` (`markInboxSeen`), `chats/page.tsx` | Code-inspected + Unit-tested + Real browser-tested | `VERIFIED` | Owner-only unread badge; zero online/last-seen/typing indicators |
| `MSG-12` / `PRIV` Payload & WS sanitization | `toSanitizedMessageDto`, `MessagingGateway`, `ws-ticket/route.ts` | Code-inspected + Unit-tested + Integration-tested + Real browser-tested | `VERIFIED` | Zero `senderAccountId`, `s3Key`, plaintext body, email, DOB, or roll numbers in WS frames or BFF messages |
| `MSG-15..24` Voice notes & audio security | `audio-security.ts`, `MessagingService`, `VoiceNotePlayer.tsx`, `chats/page.tsx` | Code-inspected + Unit-tested (`phase3-5-messaging.test.ts`) + Integration-tested (S3+`ffprobe`+Edge mic) + Screenshot-inspected (`04`, `05`) | `VERIFIED` | Fake HTML & `62s` audio rejected `400` + purged from S3; real Edge `MediaRecorder` WebM passed `ffprobe`; post-unmatch media `403` |
| `RT-01..05` WebSocket tickets & Redis fan-out | `RealtimeModule`, `ws-ticket/route.ts`, `test-phase3-5-chats-e2e.mjs` | Code-inspected + Unit-tested + Integration-tested (Redis `GETDEL` + Pub/Sub `:4004`<->`:4005`) | `VERIFIED` | URL `?ticket=` closed `4400`; replay closed `4401`; `45s` TTL enforced; `?afterSeq=` syncs missed messages |
| `OutboxEvent` async retry relay worker | `messaging.service.ts` (`outboxEvent.create`), `realtime-event-bus.service.ts` | Code-inspected (no dedicated poller loop for missed Redis publish) | `PARTIAL` | DB messages commit durably and recover via `?afterSeq=`; dedicated background outbox retry worker not yet built |
| `UI-CHAT-01..06` Responsive Mineral Night UI | `chats/page.tsx`, `chats-state.ts`, `VoiceNotePlayer.tsx`, `screenshots_phase3_5/` | Real browser-tested + Screenshot-inspected (`01`..`15`) | `VERIFIED` | `0` JS exceptions, `0` horizontal overflow across `1440`..`375`; mobile composer verified clear above `BottomNav` |
| `Dialog` focus trap & `VoiceNotePlayer` cleanup | `apps/web/components/ui/Dialog.tsx`, `VoiceNotePlayer.tsx` | Code-inspected + Web typecheck + Next.js build + Phase 3.4/3.5 E2E | `VERIFIED` | Fixed during closure review; `Tab` cycling, trigger focus restoration, and `<audio>` pause cleanup added |
| `npm run --workspace=@saymyname/api build` & `typecheck` | `services/api` + `packages/*` | Command executed post-final-edit | `PASS` | Exit `0` |
| `npm run --workspace=@saymyname/api test` | `services/api/test/*.test.ts` (`12` suites) | Command executed post-final-edit | `PASS` | **95 passed, 0 failed, 0 skipped** |
| `npm run --workspace=@saymyname/web typecheck` | `apps/web/tsconfig.json`, `apps/web/**/*.{ts,tsx}` | Command executed post-final-edit | `PASS` | Exit `0` (resolved `TS5097` via `"allowImportingTsExtensions": true`) |
| `node --test apps/web/test/*.test.ts` & `web build` | `apps/web/test/*.test.ts`, Next.js build | Commands executed post-final-edit | `PASS` | **18/18 passed**; **31/31 Next.js routes compiled** (exit `0`) |
| Prisma `validate` / `migrate status` / `migrate diff` | `packages/database/prisma/`, local `saymyname-postgres:5433` | Commands executed post-final-edit | `PASS` | `6` migrations applied (`saymyname_phase32_audit` + `saymyname_dev`); `No difference detected.` |
| `test-phase3-5-chats-e2e.mjs` | PG + Redis + S3 + 2x API/WS + Next BFF + `ffprobe` + Edge | Real browser-tested post-final-edit | `PASS` | Exit `0` (`PHASE3_5_REAL_E2E_ALL_PASSED`) |
| Phases 3.2–3.4 Regressions | `test-phase3-4`, `test-phase3-3`, `test-phase3-2-closure-pg`, `test-phase3-2-discover` | Integration-tested + Real browser-tested post-final-edit | `PASS` | All `4` scripts exited `0` |
| `MATCH-22` LiveKit SFU eviction | `calling.service.ts`, `match-authorization.service.ts` | Code-inspected (LiveKit Cloud not connected; no `RoomServiceClient`) | `PARTIAL` | DB/REST/WS revocation verified; SFU room kick deferred to Phase 4 |
| `OD-07` / `D04-12` Limit Locks (`1,000` vs `2,000`/`4,000`; `5 MB`) | `packages/validation/src/messaging.ts`, `Document 04`, `Document 06` | Document & code-inspected | `NEEDS HUMAN DECISION` | Technical defaults harmonized safely (`1000` chars / `5 MB`); formal Product approval pending |
| Remote Cloud Infra (Supabase / R2 / Resend / LiveKit) | N/A | Intentionally not exercised per rules | `NOT RUN` | Local Docker PG, Redis, Local S3, `ffprobe`, and Edge tested instead |


---

## Addendum — Phase 3.5.1 & 3.5.2 Verified Run Evidence (2026-11-26)

- `npm run --workspace=@saymyname/api test`: **97/97 PASS** (12 suites, including `PHASE351-OUTBOX-01` and `PHASE352-MEDIA-STREAM-01`).
- `node --test apps/web/test/*.test.ts`: **18/18 PASS** (4 suites).
- `npm run --workspace=@saymyname/web build`: **PASS** (31/31 routes).
- `node scripts/test-phase3-5-1-outbox-e2e.mjs`: **PASS** (`concurrentSkipLockedClaimed: 5`, live Redis stop/start recovery, expired lease reclaim, CLI inspect/replay, unmatch suppression).
- `node scripts/test-phase3-5-2-media-e2e.mjs`: **PASS** (11/11 auth cases, `[200, 206, 416]`, mid-stream unmatch abort, zero R2 signed URLs/`s3Key`s).
- `node scripts/test-phase3-5-chats-e2e.mjs`, `test-phase3-4-matches-e2e.mjs`, `test-phase3-3-likes-e2e.mjs`, `test-phase3-2-closure-pg.mjs`, `test-phase3-2-discover-e2e.mjs`: **ALL PASS**.

- **Final Review Hygiene & Git Audit Evidence (2026-11-26):** Independent source/diff inspection covering 28 modified + 30 untracked files, 0 staged, `main` (`3e13859`) divergence on `verification.service.ts` identified, `CallingController` legacy `/calling/voice-notes/*` flagged, and final `git diff --check` + secret scan run recorded in [`PHASE3_5_FINAL_GIT_DIFF_REVIEW.md`](file:///i:/saymyname/docs/implementation/PHASE3_5_FINAL_GIT_DIFF_REVIEW.md).
