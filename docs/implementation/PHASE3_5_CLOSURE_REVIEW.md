# SAYMYNAME.IN — PHASE 3.5 CLOSURE REVIEW
## Independent Engineering, Security, Privacy, Visual & Acceptance Review

**Project:** SayMyName.in  
**Phase Reviewed:** 3.5 — Chats & Private Messaging  
**Branch:** `phase-3-5-chats` (uncommitted working tree atop `main` commit `9e1a58dd38c173769f46390f06cd07be2859cc54`)  
**Review Date:** 2026-11-26  
**Verdict:** **`CONDITIONAL PASS` — Ready for Phase 3.5 Acceptance with Explicitly Tracked Policy Decisions & Phase 4 Boundaries**

---

## 1. Executive Summary

An independent end-to-end engineering, security, privacy, visual, and regression review was conducted across `phase-3-5-chats` without relying on historical agent reports. Code inspection and adversarial verification identified **three real engineering defects** that were missed prior to this review—including a **PostgreSQL `40P01` lock-order deadlock** between `MessagingService` and `DatingService.unmatch`, a failing strict `@saymyname/web typecheck` (`TS5097`), and missing modal focus trapping/return in `Dialog.tsx` plus `<audio>` cleanup on thread teardown in `VoiceNotePlayer.tsx`. All three issues were fixed cleanly within Phase 3.5 scope and verified across a full post-edit re-run covering packages, API (`95/95`), Web typecheck (`0` errors), Web unit tests (`18/18`), Next.js build (`31/31` routes), Prisma schema/migration diff, dual-instance Redis/PostgreSQL/Local-S3/`ffprobe`/Headless-Edge E2E, and Phases 3.2–3.4 regression suites.

Core bilateral messaging, realtime fan-out, server-side audio inspection, anti-surveillance boundaries, and safety controls pass cleanly. Final closure carries **`CONDITIONAL PASS`** strictly because:
1. Two open policy parameters remain marked **`NEEDS HUMAN DECISION`** (`OD-07` message character length conflict & `D04-12` voice-note max bytes).
2. `OutboxEvent` currently records `'processed'` in-transaction without an asynchronous background retry worker between Redis outages and client reconnect (`?afterSeq=` recovers all DB data cleanly).
3. `MATCH-22` external LiveKit SFU room eviction remains `PARTIAL` / deferred to Phase 4, and remote cloud providers (Supabase, Cloudflare R2, Resend, LiveKit Cloud) remain untouched.

---

## 2. Repository Baseline (Stage A)

- **Branch / HEAD:** `phase-3-5-chats` atop `9e1a58dd38c173769f46390f06cd07be2859cc54` (`chore(release): merge Phase 3.1-3.4 and Authenticated UI Refinement to main`).
- **Git State:** `0` staged files; clean separation of unstaged modifications and untracked Phase 3.5 files (`no commits, no pushes, no merges, no deployments`).
- **Dependency Additions:** `@nestjs/websockets@11.2.11`, `@nestjs/platform-ws@11.2.11`, `ws@8.18.0`, `@types/ws@8.5.14`, `ioredis@5.6.0` in [services/api/package.json](file:///i:/saymyname/services/api/package.json) (all directly required by `ADR-021`; plus Playwright/Chromium unrelated or existing `package-lock.json` sync).
- **Schema & Migration:** Additive updates to `ConversationMember`, `Message`, `MessageMedia`, `Report`, and `OutboxEvent` in [schema.prisma](file:///i:/saymyname/packages/database/prisma/schema.prisma) and [migration.sql](file:///i:/saymyname/packages/database/prisma/migrations/20261126000000_phase3_5_messaging_realtime_integrity/migration.sql).
- **Report Accuracy:** Files claimed in `PHASE3_5_COMPLETION_REPORT.md` match actual workspace contents, supplemented during this closure review by [Dialog.tsx](file:///i:/saymyname/apps/web/components/ui/Dialog.tsx) and [tsconfig.json](file:///i:/saymyname/apps/web/tsconfig.json).

---

## 3. Documentation & Requirement Traceability (Stage B)

- **Conversation Lifecycle:** Enforced via `DatingService.ensureMutualMatchForPair` (`services/api/src/modules/dating/dating.service.ts`) and `MatchAuthorizationService.assertAuthorizedForConversation` (`services/api/src/modules/safety/match-authorization.service.ts`). Unilateral Likes create zero conversations; strangers, unmatched peers, blocked pairs, suspended/deleted accounts, and age/student-revoked accounts receive `403` across REST and WS.
- **Persistence & Ordering:** PostgreSQL transaction locks serialize sequence generation before realtime broadcast (`sequenceNo` serialized to `number` in `toSanitizedMessageDto`).
- **Unread & Delivery State:** Owner-only `ConversationMember.lastReadSeq` computes recipient `unreadCount` privately via `MessagingService.markInboxSeen`; `ackDelivery` and `markIncomingDeliveredAndNotify` only advance `sent -> delivered`; `'read'` is mapped/suppressed (`D04-10`). See [PHASE3_5_REQUIREMENTS_TRACEABILITY.md](file:///i:/saymyname/docs/implementation/PHASE3_5_REQUIREMENTS_TRACEABILITY.md).

---

## 4. Realtime Architecture Review (Stage C & ADR-021)

- **BFF & Ticket Auth:** [ws-ticket/route.ts](file:///i:/saymyname/apps/web/app/api/auth/ws-ticket/route.ts) checks `verifyOriginAndCsrf(request)` + `HttpOnly` cookies (`Cache-Control: private, no-store...`, `Vary: Cookie`) and proxies to `POST /messaging/realtime/ticket`. Browser never receives JWTs.
- **Gateway Consumption (`MessagingGateway` & `RealtimeTicketService`):**
  - Rejects URL query creds (`/(ticket|token|accessToken|jwt)=/i`) with WS close `4400`.
  - Enforces 5s `WS_HANDSHAKE_TIMEOUT_MS` on unauthenticated sockets (`4401`).
  - Stores SHA-256 hash in Redis (`SET smn:wst:<hash> ... PX 45000`), consumes atomically via `GETDEL` (or `MULTI GET+DEL`), rejects replays/expired/invalid tickets with `4401`, and re-verifies `verifyParticipantAccountsActive` upon consumption.
  - **ADR Drift Note:** `ADR-021` describes Redis key write with `NX` and channel `smn:realtime:events`, whereas [realtime-ticket.service.ts](file:///i:/saymyname/services/api/src/modules/realtime/realtime-ticket.service.ts#L113) uses `SET ... PX 45000` (sufficient given 192-bit random ticket entropy) and [realtime.types.ts](file:///i:/saymyname/services/api/src/modules/realtime/realtime.types.ts#L3) versions the channel `smn:realtime:events:v1`.
- **Outbox & Recovery (`§5.3`):**
  - `MessagingService` creates `OutboxEvent` rows atomically in the message transaction (`status: 'processed'`) and publishes post-commit to Redis Pub/Sub (`RealtimeEventBusService`).
  - **Architectural Limitation:** Because no separate outbox relay daemon sweeps unpublished events (`status: 'pending'`), a transient Redis publish error drops that instant WS notification while durable PostgreSQL rows remain intact and recover cleanly on client reconnect / `GET /history?afterSeq=`.
- **Concurrency & Deadlock Discovery (`§5.4`):**
  - Initial Phase 3.4 regression re-run hit a real `503` deadlock during the 5-way race (`unmatch` + `unmatch` + `sendMessage` + `call` + `game`) because `MessagingService` locked `messaging.conversations FOR UPDATE` *before* calling `assertActiveMatchConversationMember` (`dating.matches FOR SHARE`), inverting `DatingService.unmatch` (`matches FOR UPDATE` -> `conversations`).
  - **Resolved:** Reordered [messaging.service.ts](file:///i:/saymyname/services/api/src/modules/messaging/messaging.service.ts#L754-L762) (`sendMessage`) and [messaging.service.ts](file:///i:/saymyname/services/api/src/modules/messaging/messaging.service.ts#L1234-L1242) (`sendVoiceNoteToConversation`) to acquire `dating.matches FOR SHARE` strictly before `messaging.conversations FOR UPDATE`. Verified cleanly across subsequent `test-phase3-4-matches-e2e.mjs` and `test-phase3-5-chats-e2e.mjs` runs.

---

## 5. Security Review (Stages C, D, E, K)

- **Authorization & Anti-Bypass:** `JwtAuthGuard`, `EligibilityGuard`, `ParseUUIDPipe`, and `MatchAuthorizationService` gate every REST route, WS subscription, presign slot, and media URL fetch. Unrelated third parties receive `403`.
- **WS Broadcast Isolation:** `MessagingGateway.handleBusMessage` routes `conversation_event` strictly to verified `conversationRooms` and `recipientAccountIds`, emits metadata-only `WebSocketEventEnvelope` frames (no plaintext `bodyText`, internal `accountId`, `s3Key`, or moderation reason), and evicts/closes active sockets on `match_ended` (`conversation.closed`) and `account_revoked` (`access.revoked`, `4403`).
- **Residual Signed URL Window Note:** `GET /messaging/media/:mediaId/url` returns a short-lived **90-second** S3/R2 signed `GET` URL (`signVoiceNoteUrl`). New URL fetches fail `403` immediately after unmatch/block, while an already-issued URL remains valid against S3 until its <=90s TTL expires unless proxied server-side.

---

## 6. Voice-Note Security Review (Stage D)

- **Magic Bytes & `ffprobe` (`audio-security.ts`):** Rejects disguised HTML/XML/SVG/ELF/PE/PDF/images, video streams, corrupt containers, and durations `> 60.75s` (canonical limit `60s` per `Doc 02 §4.3`). Executes `ffprobe` cleanly via `execFile` (array args, shell disabled, `timeout: 5000`/`6000`, `maxBuffer` bounded).
- **Headerless WebM MediaRecorder Support:** Packet-timestamp `ffprobe` scan measures actual packet duration cleanly when Chrome/Edge `MediaRecorder` omits Matroska header `Duration` (`N/A`). Temp directories clean up in `finally`; rejected R2 objects are deleted via `DeleteObjectCommand`.
- **Frontend Capture & Player:** Explicit mic prompt -> record (auto-stop at 60s into preview, never auto-sent) -> preview/discard/retry. [VoiceNotePlayer.tsx](file:///i:/saymyname/apps/web/components/VoiceNotePlayer.tsx) tightened in review to pause and clear `src` cleanly on unmount or media change (`no background audio leaks`).

---

## 7. Privacy & Safety Review (Stage E)

- Inspected API responses (`getConversations`, `getMessages`, `getMessageHistory`), Next.js BFF headers (`no-store`, `Vary: Cookie`), WebSocket frames, and Edge DOM: zero read receipts, zero last-seen, zero online/typing status, zero DOB/roll-no/institutional email/internal IDs/moderator notes/storage keys leaked.
- Safety reports target individual messages or voice notes (`Report.messageId`, `Report.conversationId`), leave matches intact, and remain strictly separate from Direct Unmatch (zero `UserBlock`) and Block (`UserBlock` created).
- Offline drafts (`smn_msg_draft_v1:<conversationId>`) wipe cleanly on `logout()` (`auth-context.tsx`), message send, and ended conversation eviction.

---

## 8. UI/UX & Visual Acceptance (Stage F)

All `15` rendered Edge screenshots (`1440×900`, `1280×800`, `768×1024`, `430×932`, `390×844`, `375×812`) were independently opened and verified — see detailed per-frame matrix in [PHASE3_5_VISUAL_ACCEPTANCE.md](file:///i:/saymyname/docs/implementation/PHASE3_5_VISUAL_ACCEPTANCE.md). No P0/P1 defects remain; mobile `375×812` composer sits cleanly above `BottomNav` even with top safety feedback banners visible (`0` horizontal overflow, `0` uncaught JS errors).

---

## 9. Accessibility Review (Stage J)

- Checked keyboard navigation, focus outlines (`focus-visible:outline-iris`), ARIA labels on icon buttons (`aria-label="Voice note"`, `aria-label="Report message"`, `aria-label="Back to conversations list"`, `aria-label="Play voice note"`), seek slider ARIA attributes, `role="alert"`/`role="status"`, and dialog handling.
- **Confirmed Defect Fixed:** [Dialog.tsx](file:///i:/saymyname/apps/web/components/ui/Dialog.tsx) previously lacked initial focus capture, `Tab`/`Shift+Tab` focus trapping, and focus restoration upon closing (`Escape`/cancel), despite documenting focus trapping in comments. Fixed cleanly with `panelRef`, `onCloseRef`, and `previousFocusRef`.

---

## 10. Web Typecheck Investigation (Stage G)

- **Outcome Achieved: Outcome A (Fixed Safely & Passing Exit `0`).**
- **Root Cause:** `apps/web/test/{chats,discover,likes,matches}-state.test.ts` execute under Node's native TypeScript runner (`node --test apps/web/test/*.test.ts`), requiring explicit `.ts` relative import extensions. [tsconfig.json](file:///i:/saymyname/apps/web/tsconfig.json) already sets `"noEmit": true` and `"moduleResolution": "bundler"`, so enabling `"allowImportingTsExtensions": true` eliminated all 4 `TS5097` errors without loosening strict mode, excluding test files, or modifying test code. Verified `npm run --workspace=@saymyname/web typecheck` -> Exit `0`.

---

## 11. Message & Voice-Note Limit Decisions (Stage H)

- **Text Message Length (`NEEDS HUMAN DECISION`):** Three values exist across specs/prior code — `1,000` enforced across `@saymyname/validation`, API DTO/service, and Web UI (`MAX_TEXT_MESSAGE_LENGTH = 1000`), `2,000` in pre-Phase-3.5 `@saymyname/validation`, and `4,000` in Document 06 §17 OpenAPI schema, while Document 06 `OD-07` leaves the official limit **`OPEN`**. Recommended default: **lock `1,000` characters** for focused mobile/desktop readability (trivial to raise via `MAX_TEXT_MESSAGE_LENGTH` if Product prefers `2,000` or `4,000`).
- **Voice-Note Size Cap (`NEEDS HUMAN DECISION`):** `60` seconds is locked (`Doc 02 §4.3`), while `D04-12` / `OD-07` leave file size limit **`OPEN`**. Runtime enforces `VOICE_NOTE_DEFAULT_MAX_BYTES = 5 * 1024 * 1024` (`VOICE_NOTE_MAX_BYTES` env override up to `15 MB` DTO ceiling). Recommended default: **lock `5 MB` for 60s Opus/AAC/WebM clips** (~0.5–1.5 MB typical, leaving headroom for M4A/WAV without abusive object costs).
- Recorded explicitly as pending in [DECISION_REGISTER.md](file:///i:/saymyname/docs/decisions/DECISION_REGISTER.md).

---

## 12. Database, Builds, Tests, Regressions & Hygiene (Stages I & K)

- **Prisma Schema & Migration:** `prisma validate`, `migrate status` (`6` migrations applied on `saymyname_phase32_audit` & `saymyname_dev`), and `migrate diff --exit-code` (`No difference detected.`) all exited `0`. Additive SQL verified non-destructive.
- **Post-Final-Edit Suite Results:** `api build` (`0`), `api typecheck` (`0`), `api test` (`95/95`), `web typecheck` (`0`), `apps/web/test/*.test.ts` (`18/18`), `web build` (`31/31` routes), `test-phase3-5-chats-e2e.mjs` (`PASS`), `test-phase3-4-matches-e2e.mjs` (`PASS`), `test-phase3-3-likes-e2e.mjs` (`PASS`), `test-phase3-2-closure-pg.mjs` (`PASS`), `test-phase3-2-discover-e2e.mjs` (`PASS`), `git diff --check` (`0`), `.env*` clean (`0` modified), static secret scan (`0` real secrets).

---

## 13. Deferred Work (`MATCH-22` & Phase 4)

- **`MATCH-22` (`PARTIAL`):** Database invalidation (`Match`, `Conversation`, `CallSession`, `GameSession`, `VirtualDatePlan`, `RelationshipState`), HTTP/JWT guards, and WebSocket `conversation.closed` / `access.revoked` eviction are implemented and verified across all 5 triggers. **Unimplemented:** LiveKit Server SDK (`RoomServiceClient`) active audio-room participant kick/room termination in [calling.service.ts](file:///i:/saymyname/services/api/src/modules/calling/calling.service.ts) / [match-authorization.service.ts](file:///i:/saymyname/services/api/src/modules/safety/match-authorization.service.ts). Until Phase 4 integrates LiveKit SFU eviction, a participant already inside an active call stays connected until call hangup even after unmatch/block.

---

## 14. Final Acceptance Recommendation

Recommend **`CONDITIONAL PASS`** for closing Phase 3.5 cleanly and accepting `phase-3-5-chats`, subject to explicit human sign-off on `OD-07` (text length `1,000` vs `2,000`/`4,000`) & `D04-12` (`5 MB` voice cap) and tracking `OutboxEvent` async relay + `MATCH-22` LiveKit SFU eviction in Phase 4.


---

## Addendum — Post-3.5.1 & 3.5.2 Closure Review Update (2026-11-26)

- Outbox reliability hardening (10 failure/concurrency scenarios + real `docker stop/start saymyname-redis` E2E) and Option A same-origin audio streaming proxy (11/11 auth cases + `206`/`416` Range + mid-stream abort) closed both engineering findings from the prior Conditional Pass.
- Remaining human governance gate: formal sign-off on `D-P35-01`, `D-P35-02`, and `D-P35-03` (`DECISION_REGISTER.md`), plus Phase 4 LiveKit room eviction (`MATCH-22`). See [`PHASE3_5_1_2_FINAL_ACCEPTANCE.md`](file:///i:/saymyname/docs/implementation/PHASE3_5_1_2_FINAL_ACCEPTANCE.md).

- **Final Pre-Merge Security & Git Diff Review (2026-11-26):** Reconciled historical 90s URL -> Option A streaming proxy chronology, `MATCH-22` (`PARTIAL` -> Phase 4 LiveKit SFU spec), `D-P35-01..03` (`NEEDS HUMAN DECISION`), and full 58-file branch inventory (`CONDITIONAL PASS: Ready for Human Acceptance`). See [`PHASE3_5_SECURITY_BOUNDARIES_AND_DEPENDENCIES.md`](file:///i:/saymyname/docs/implementation/PHASE3_5_SECURITY_BOUNDARIES_AND_DEPENDENCIES.md) & [`PHASE3_5_FINAL_GIT_DIFF_REVIEW.md`](file:///i:/saymyname/docs/implementation/PHASE3_5_FINAL_GIT_DIFF_REVIEW.md).
