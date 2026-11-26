# SAYMYNAME.IN — PHASE 3.5 COMPLETION REPORT
## Chats & Private Messaging

**Phase:** 3.5 — Chats & Private Messaging  
**Branch:** `phase-3-5-chats`  
**Parent Checkpoint:** `main` (`9e1a58d`, clean Phase 3.1–3.4 + Authenticated UI Refinement baseline)  
**Completion Date:** 2026-11-26  

---

## 1. Executive Summary

Phase 3.5 implements the end-to-end **Chats & Private Messaging** experience for verified mutually matched members on SayMyName.in across shared contracts/validation, additive PostgreSQL schema & migration, NestJS REST + authenticated WebSocket realtime backend (`ws` + Redis Pub/Sub + single-use BFF connection tickets), server-verified voice notes (`ffprobe`), **THE INTERVAL** (Document 10) Mineral Night `/chats` desktop & mobile workspace, and comprehensive automated + live Edge browser verification.

Key delivered outcomes:
- **Authenticated Realtime Transport (`ADR-021`):** Implemented `RealtimeModule` (`services/api/src/modules/realtime/`) using `@nestjs/platform-ws` (`ws`), first-frame ticket authentication (`POST /api/auth/ws-ticket` -> single-use 45s SHA-256 Redis `GETDEL` ticket, rejecting URL `?ticket=`/`?token=` with close `4400` and replays with `4401`), Redis Pub/Sub cross-instance event fan-out (`smn:realtime:events:v1`) with local in-process fallback when Redis is absent in unit mode, and live WebSocket eviction when matches end (`unmatch`, `block`, suspension, verification revocation).
- **Messaging & Delivery Integrity (`MessagingService` & PostgreSQL):** Wrapped message/voice-note creation in serializable transaction locks (`SELECT id ... FROM messaging.conversations FOR UPDATE`) allocating strictly monotonic `sequenceNo`, enforcing idempotency (`Idempotency-Key` + `Message.clientAssignedUuid`), persisting `OutboxEvent` records, tracking truthful recipient `DeliveryState` (`sent` -> `delivered` via explicit `delivery-ack`), maintaining owner-only private `unreadCount` (`lastReadSeq`) without exposing read receipts, last-seen, online presence, or typing indicators, and providing bidirectional cursor pagination (`beforeSeq` / `afterSeq`).
- **Voice Notes & Audio Binary Security:** Added `services/api/src/modules/messaging/audio-security.ts` validating binary headers + `ffprobe` container/audio-stream inspection (rejecting HTML/scripts/executables/video tracks, enforcing `<= 60s`, and falling back to packet-level `ffprobe` timestamp inspection for headerless browser `MediaRecorder` WebM streams), and automatically purging rejected objects from R2/S3 *(Historically served via 90-second pre-signed `GET /messaging/media/:mediaId/url` in initial Phase 3.5; superseded in Phase 3.5.2 by Option A same-origin BFF streaming proxy `/api/bff/v1/messaging/media/:mediaId/stream` per ADR-023)*.
- **Mineral Night `/chats` Workspace:** Upgraded `apps/web/app/(app)/chats/page.tsx` with desktop master-detail rails and mobile list/thread navigation (`375×812`–`1440×900`), local draft preservation (cleared on logout/close), failed send `Retry`/`Discard`, live WS reconnect reconciliation (`?afterSeq=`), explicit microphone prompt -> record (<=60s) -> preview/discard/send voice recorder + `VoiceNotePlayer`, per-message/voice-note confidential reporting (`Report.messageId`), Direct Unmatch dialog (`chat-unmatch-dialog`), separate Block confirmation, and `Connection Closed` guards.

Zero remote cloud services (Supabase, Cloudflare R2, Resend, LiveKit Cloud), `.env*` files, commits, pushes, merges, or deployments were touched.

---

## 2. Database & Migration Summary (`packages/database`)

- **Prisma Schema (`packages/database/prisma/schema.prisma`):**
  - `ConversationMember`: added `lastReadSeq` (`BigInt @default(0)`), `lastDeliveredSeq` (`BigInt @default(0)`), and `conversation_members_account_idx`.
  - `Message`: added unique `(conversationId, sequenceNo)` (`messages_conv_seq_key`), descending pagination index (`messages_conv_seq_desc_idx`), and unread-count index (`messages_unread_count_idx`).
  - `MessageMedia`: added `sha256`, `processingStatus` (`@default("ready")`), and `uploaderAccountId`.
  - `Report`: added optional nullable `conversationId`, `messageId`, and `reports_conversation_idx`.
  - `OutboxEvent`: added composite index `outbox_events_status_created_idx`.
- **Additive Migration (`20261126000000_phase3_5_messaging_realtime_integrity`):** Applied cleanly to local PostgreSQL (`saymyname_phase32_audit` and `saymyname_dev`); `prisma migrate status` and `prisma migrate diff --exit-code` both pass cleanly (`No difference detected.`).
- **Rollback Plan (Safe Reverse DDL if needed pre-release):**
  ```sql
  DROP INDEX IF EXISTS "platform"."outbox_events_status_created_idx";
  DROP INDEX IF EXISTS "safety"."reports_conversation_idx";
  ALTER TABLE "safety"."reports" DROP COLUMN IF EXISTS "message_id", DROP COLUMN IF EXISTS "conversation_id";
  ALTER TABLE "messaging"."message_media" DROP COLUMN IF EXISTS "uploader_account_id", DROP COLUMN IF EXISTS "processing_status", DROP COLUMN IF EXISTS "sha256";
  DROP INDEX IF EXISTS "messaging"."messages_unread_count_idx";
  DROP INDEX IF EXISTS "messaging"."messages_conv_seq_desc_idx";
  DROP INDEX IF EXISTS "messaging"."messages_conv_seq_key";
  DROP INDEX IF EXISTS "messaging"."conversation_members_account_idx";
  ALTER TABLE "messaging"."conversation_members" DROP COLUMN IF EXISTS "last_delivered_seq", DROP COLUMN IF EXISTS "last_read_seq";
  ```

---

## 3. Files Added & Modified

- **Shared Packages:**
  - `packages/contracts/src/dtos/index.ts`, `packages/contracts/src/events/index.ts`
  - `packages/validation/src/messaging.ts` (`MAX_TEXT_MESSAGE_LENGTH = 1000`, `VOICE_NOTE_MAX_DURATION_SEC = 60`, `VOICE_NOTE_DEFAULT_MAX_BYTES`, `ALLOWED_VOICE_NOTE_MIMES`)
  - `packages/database/prisma/schema.prisma`, `packages/database/prisma/migrations/20261126000000_phase3_5_messaging_realtime_integrity/migration.sql`
- **Backend (`services/api`):**
  - `services/api/package.json`, `package-lock.json`, `services/api/src/main.ts`, `services/api/src/app.module.ts`
  - `services/api/src/modules/realtime/{realtime.types.ts, realtime-ticket.service.ts, realtime-event-bus.service.ts, messaging.gateway.ts, realtime.module.ts}`
  - `services/api/src/modules/messaging/{audio-security.ts, dto/messaging.dto.ts, messaging.controller.ts, messaging.module.ts, messaging.service.ts}`
  - `services/api/src/modules/safety/{dto/safety.dto.ts, match-authorization.service.ts, safety.service.ts}`
  - `services/api/src/modules/dating/dating.service.ts`, `identity/identity.service.ts`, `verification/verification.service.ts`
- **Frontend (`apps/web`):**
  - `apps/web/app/api/auth/ws-ticket/route.ts`
  - `apps/web/lib/{api.ts, auth-context.tsx, chats-state.ts}`
  - `apps/web/components/{VoiceNotePlayer.tsx, icons.tsx}`
  - `apps/web/app/(app)/chats/page.tsx`
- **Tests, Verification & Docs:**
  - `services/api/test/phase3-5-messaging.test.ts`, `apps/web/test/chats-state.test.ts`
  - `scripts/test-phase3-5-chats-e2e.mjs`, `scripts/test-phase3-4-matches-e2e.mjs` (updated composer selector for `<textarea>`)
  - `docs/decisions/ADR-021-realtime-messaging-websocket-architecture.md`, `docs/decisions/DECISION_REGISTER.md`
  - `docs/implementation/{PHASE3_5_REQUIREMENTS_TRACEABILITY.md, PHASE3_5_COMPLETION_REPORT.md, PHASE3_5_FINAL_ACCEPTANCE_AUDIT.md}`

---

## 4. Verification Summary (Latest Post-Final-Edit Runs)

- `npm run build:packages` & `npm run --workspace=@saymyname/api build` -> Exit `0`
- `npm run --workspace=@saymyname/api test` -> **95 passed, 0 failed, 0 skipped across 12 suites**
- `node --test apps/web/test/*.test.ts` -> **18 passed, 0 failed, 0 skipped across 4 suites**
- `npm run --workspace=@saymyname/web build` -> Exit `0` (**31/31 routes compiled**)
- `npx prisma migrate status` & `npx prisma migrate diff --exit-code` (`saymyname_phase32_audit`) -> Exit `0` (`Database schema is up to date!`, `No difference detected.`)
- `node scripts/test-phase3-5-chats-e2e.mjs` -> Exit `0` (`PHASE3_5_REAL_E2E_ALL_PASSED`) across real PostgreSQL + Redis + Local S3 + dual API/WS instances (`:4004`, `:4005`) + Next.js BFF (`:3008`) + `ffmpeg`/`ffprobe` + Headless Edge + all `15` rendered screenshots visually verified
- Regression suites:
  - `node scripts/test-phase3-4-matches-e2e.mjs` -> Exit `0` (`PHASE3_4_REAL_E2E_ALL_PASSED`)
  - `node scripts/test-phase3-3-likes-e2e.mjs` -> Exit `0` (`PHASE3_3_REAL_E2E_ALL_PASSED`)
  - `node scripts/test-phase3-2-closure-pg.mjs` -> Exit `0` (`ALL REAL POSTGRESQL CLOSURE INVARIANTS PASSED`)
  - `node scripts/test-phase3-2-discover-e2e.mjs` -> Exit `0` (`REAL_E2E_INTEGRATION_ALL_PASSED`)
- `git diff --check` -> Exit `0`

---

## 5. Independent Closure Review & Hardening Addendum (2026-11-26)

An independent Phase 3.5 closure review re-audited all source modules, database locking, WebSocket/BFF security, voice-note verification, privacy invariants, accessibility, visual captures, and regression tests cleanly against the live repository state.

### Confirmed Defects Discovered & Fixed
1. **PostgreSQL Transaction Lock-Order Deadlock Risk (`40P01`) in `MessagingService`:** Re-running the 5-way Phase 3.4 concurrent `unmatch` vs `sendMessage` race surfaced a lock inversion where `sendMessage` and `sendVoiceNoteToConversation` acquired `messaging.conversations FOR UPDATE` before `dating.matches FOR SHARE`, opposite `DatingService.unmatch`. Fixed cleanly in [messaging.service.ts](file:///i:/saymyname/services/api/src/modules/messaging/messaging.service.ts#L754-L762) and [#L1234-L1242](file:///i:/saymyname/services/api/src/modules/messaging/messaging.service.ts#L1234-L1242) to always enforce `dating.matches -> messaging.conversations` ordering.
2. **Strict Web Typecheck Failure (`TS5097`):** Added `"allowImportingTsExtensions": true` alongside existing `"noEmit": true` and `"moduleResolution": "bundler"` in [tsconfig.json](file:///i:/saymyname/apps/web/tsconfig.json), enabling `npm run --workspace=@saymyname/web typecheck` to exit `0` across all app and test files.
3. **Accessibility Focus Trap & Audio Lifecycle Cleanup:** Implemented focus capture, `Tab`/`Shift+Tab` cycling, and close-time focus restoration in [Dialog.tsx](file:///i:/saymyname/apps/web/components/ui/Dialog.tsx) plus unmount/media-switch `<audio>` pause cleanup in [VoiceNotePlayer.tsx](file:///i:/saymyname/apps/web/components/VoiceNotePlayer.tsx).

### Fresh Post-Hardening Verification (Executed After Final Code Edit)
- `npm run --workspace=@saymyname/api build` & `typecheck` -> Exit `0`
- `npm run --workspace=@saymyname/api test` -> **95/95 passed** across `12` suites
- `npm run --workspace=@saymyname/web typecheck` -> Exit `0` (**full pass**, `0` errors)
- `node --test apps/web/test/*.test.ts` -> **18/18 passed** across `4` suites
- `npm run --workspace=@saymyname/web build` -> Exit `0`, **31/31 routes** compiled
- `npx prisma validate`, `migrate status`, `migrate diff --exit-code` (`saymyname_phase32_audit`) -> Exit `0` (`Database schema is up to date!`, `No difference detected.`)
- `node scripts/test-phase3-5-chats-e2e.mjs` -> Exit `0` (`PHASE3_5_REAL_E2E_ALL_PASSED`)
- `node scripts/test-phase3-4-matches-e2e.mjs`, `test-phase3-3-likes-e2e.mjs`, `test-phase3-2-closure-pg.mjs`, `test-phase3-2-discover-e2e.mjs` -> All `4` exited `0`
- `git diff --check` -> Exit `0`

### Remaining Partial / Pending Items & Acceptance Verdict
- **`MATCH-22` (`PARTIAL`):** LiveKit SFU room/participant eviction deferred to Phase 4.
- **`OUTBOX-RELAY` (`PARTIAL`):** Durable DB + `?afterSeq=` reconnect recovery verified; background `OutboxEvent` retry worker deferred.
- **`D-P35-01` (`OD-07`) & `D-P35-02` (`D04-12`):** Recorded as **`NEEDS HUMAN DECISION`** in [DECISION_REGISTER.md](file:///i:/saymyname/docs/decisions/DECISION_REGISTER.md).
- **Final Closure Recommendation:** **`CONDITIONAL PASS`** — ready for formal Phase 3.5 human acceptance review. See [PHASE3_5_CLOSURE_REVIEW.md](file:///i:/saymyname/docs/implementation/PHASE3_5_CLOSURE_REVIEW.md).


---

## Addendum — Phase 3.5.1 & 3.5.2 Completion Update (2026-11-26)

- **Phase 3.5.1 Outbox Reliability:** Implemented and verified ([Report](file:///i:/saymyname/docs/implementation/PHASE3_5_1_OUTBOX_RELIABILITY_REPORT.md), [ADR-022](file:///i:/saymyname/docs/decisions/ADR-022-transactional-outbox-relay.md)).
- **Phase 3.5.2 Media Streaming Security & Policy Closure:** Implemented Option A same-origin streaming proxy and formalized `D-P35-01..03` ([Report](file:///i:/saymyname/docs/implementation/PHASE3_5_2_MEDIA_SECURITY_AND_POLICY_CLOSURE.md), [ADR-023](file:///i:/saymyname/docs/decisions/ADR-023-authenticated-voice-note-streaming-proxy.md)).
- **Latest Combined Suite:** 97/97 API tests, 18/18 Web tests, 31/31 Next.js routes, `test-phase3-5-1-outbox-e2e.mjs`, `test-phase3-5-2-media-e2e.mjs`, and `test-phase3-5-chats-e2e.mjs` all passed cleanly.


---

## Addendum — Final Security Boundaries & Git Acceptance Review (2026-11-26)

- Independent pre-merge security and Git diff audit completed: [`PHASE3_5_SECURITY_BOUNDARIES_AND_DEPENDENCIES.md`](file:///i:/saymyname/docs/implementation/PHASE3_5_SECURITY_BOUNDARIES_AND_DEPENDENCIES.md) and [`PHASE3_5_FINAL_GIT_DIFF_REVIEW.md`](file:///i:/saymyname/docs/implementation/PHASE3_5_FINAL_GIT_DIFF_REVIEW.md).
- Confirmed Option A streaming proxy replaced 90s direct R2 URLs, clarified irreversible client-byte & stateless 15-minute access-JWT limits, preserved `MATCH-22` LiveKit SFU eviction as `PARTIAL` (Phase 4 dependency), and flagged legacy Phase 4 stub `/calling/voice-notes/*` for Phase 4 retirement.
