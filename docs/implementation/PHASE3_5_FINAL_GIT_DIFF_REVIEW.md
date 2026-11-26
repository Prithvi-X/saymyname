# Phase 3.5, 3.5.1 & 3.5.2 — Final Git Diff & Repository Acceptance Review

**Project:** SayMyName.in  
**Reviewed Branch:** `phase-3-5-chats`  
**Review Date:** 2026-11-26  
**Verdict:** **`CONDITIONAL PASS` — Ready for Human Acceptance & Merge Authorization with Explicitly Tracked Follow-Ups**

---

## 1. Repository Baseline (`Part 6.1`)

- **Current Branch:** `phase-3-5-chats`
- **Current HEAD Commit:** `9e1a58dd38c173769f46390f06cd07be2859cc54` (`chore(release): merge Phase 3.1-3.4 and Authenticated UI Refinement to main`) — matches reported baseline verbatim.
- **Target Branch (`main`) State:** `main` tip is `3e13859021f56b0e8eb6277e920eaf55eebf9a70` (`fix(verification): fail closed with 503 and diagnostic code instead of silent mock-case fallback`, ahead of `9e1a58d` by `1` commit).
- **Merge Base with `main`:** `9e1a58dd38c173769f46390f06cd07be2859cc54`
- **Prior Phase Branches:** `phase-3-4-matches` (`af342b7587ebe2bee65c977834e15dc1320ace7e`), `phase-3-3-likes` (`66467e731a2dc48dabded6e9b1197c568b4e49d0`) — both ancestors of `9e1a58d`.
- **Working Tree Counts:**
  - Staged (`git diff --cached --name-status`): **0** files
  - Modified tracked (`git diff --name-only`): **29** files
  - Deleted tracked: **0** files
  - Untracked (`git ls-files --others --exclude-standard`): **32** files
  - Total changed/new workspace items under review: **61** files
  - Ignored top-level artifacts (`git status --ignored`): `.env.local`, `.next/`, `apps/mobile/node_modules/`, `apps/web/.env.local`, `apps/web/.next/`, `apps/web/tsconfig.tsbuildinfo`, `node_modules/`.
  - `.env*` modifications: **0** (`.env.example` clean, `.env.local` ignored & untouched).

---

## 2. Complete Changed & Untracked File Classification (`Part 6.2–6.3`)

**Categories:**  
`A` Required Phase 3.5 Chats/Messaging · `B` Required Phase 3.5.1 Outbox Relay · `C` Required Phase 3.5.2 Media Streaming & Policy · `D` Required Tests & Documentation · `E` Supporting Infrastructure/Contracts/Deps · `F` Pre-existing / Inherited · `G` Potentially Unrelated · `H` Unknown / Owner Review

| File | Change type | Phase | Reason | Risk | Recommendation |
|---|---|---|---|---|---|
| `apps/web/app/(app)/chats/page.tsx` | Modified (`M`) | A (Phase 3.5) | Desktop master-detail & mobile `/chats` workspace, WS sync, drafts, voice UI, report/unmatch modals | Low | Keep (Phase 3.5 core) |
| `apps/web/app/api/auth/ws-ticket/route.ts` | Untracked (`??`) | A (Phase 3.5) | Next.js BFF `POST /api/auth/ws-ticket` issuing single-use WS tickets with CSRF & `no-store` | Low | Keep (Phase 3.5 core) |
| `apps/web/app/api/bff/v1/[...path]/route.ts` | Modified (`M`) | C (Phase 3.5.2) | Exports `HEAD` alongside `GET`/`POST`/`PUT`/`PATCH`/`DELETE` for audio proxy probes | Low | Keep (Phase 3.5.2 core) |
| `apps/web/components/VoiceNotePlayer.tsx` | Untracked (`??`) | A + C (3.5 / 3.5.2) | `<audio>` player streaming same-origin proxy, cleanup on unmount, `HEAD` `401`/`403` error probe | Low | Keep (Phase 3.5 / 3.5.2 core) |
| `apps/web/components/icons.tsx` | Modified (`M`) | A (Phase 3.5) | Adds `PlayIcon`, `PauseIcon`, `TrashIcon`, `RefreshIcon` for Chats voice/retry UI | Low | Keep (Phase 3.5 UI) |
| `apps/web/components/ui/Dialog.tsx` | Modified (`M`) | A (3.5 closure) | Adds focus capture, `Tab` focus trapping, & trigger focus restore for chat report/unmatch dialogs | Low | Keep (accessibility fix) |
| `apps/web/lib/api.ts` | Modified (`M`) | A + C (3.5 / 3.5.2) | Conversation/history/voice/WS-ticket API methods & `/stream` media URL resolution | Low | Keep (Phase 3.5 / 3.5.2 core) |
| `apps/web/lib/auth-context.tsx` | Modified (`M`) | A (Phase 3.5) | Calls `clearAllConversationDrafts()` on `logout()` so local chat drafts never persist post-logout | Low | Keep (privacy requirement) |
| `apps/web/lib/chats-state.ts` | Untracked (`??`) | A (Phase 3.5) | Chronological dedup/merge, delivery transition, URL safety filter & draft storage helpers | Low | Keep (Phase 3.5 core) |
| `apps/web/lib/server-bff.ts` | Modified (`M`) | C (Phase 3.5.2) | Forwards `Range`/`If-Range`/`signal`; streams binary/`audio/*`/`206` responses directly (`no-store`) | Medium | Keep (verified E2E) |
| `apps/web/tsconfig.json` | Modified (`M`) | E (Support) | Adds `"allowImportingTsExtensions": true` (`noEmit: true` already active) fixing `web typecheck` (`TS5097`) | Low | Keep (verified exit 0) |
| `packages/contracts/src/dtos/index.ts` | Modified (`M`) | E (Phase 3.5) | Adds `SanitizedChatMessageDto`, `MessagesHistoryResponseDto`, `ConversationSummaryDto`, presign/ticket DTOs | Low | Keep (shared contracts) |
| `packages/contracts/src/events/index.ts` | Modified (`M`) | E (Phase 3.5) | Standardizes metadata-only `WebSocketEventEnvelope` & realtime payload contracts | Low | Keep (shared contracts) |
| `packages/validation/src/messaging.ts` | Modified (`M`) | E (Phase 3.5) | Configurable `MAX_TEXT_MESSAGE_LENGTH = 1000`, `VOICE_NOTE_DEFAULT_MAX_BYTES = 5MB`, `formatRelativeDayLabel` | Low | Keep (sync w/ `D-P35-01/02`) |
| `packages/database/prisma/schema.prisma` | Modified (`M`) | A + B (3.5 / 3.5.1) | Schema updates for `ConversationMember`, `Message`, `MessageMedia`, `Report`, and `OutboxEvent` leases | Low | Keep (matches migrations) |
| `packages/database/prisma/migrations/20261126000000_phase3_5_messaging_realtime_integrity/migration.sql` | Untracked (`??`) | A (Phase 3.5) | Strictly additive Phase 3.5 columns and indexes | Low | Keep (verified live PG) |
| `packages/database/prisma/migrations/20261126010000_phase3_5_1_outbox_relay_leases/migration.sql` | Untracked (`??`) | B (Phase 3.5.1) | Strictly additive `outbox_events` lease, backoff & error columns + indexes | Low | Keep (verified live PG) |
| `services/api/package.json` | Modified (`M`) | E (Phase 3.5) | Adds `ws`, `@types/ws`, `@nestjs/platform-ws`, `@nestjs/websockets`, `ioredis`; wires `phase3-5-messaging.test.js` | Low | Keep (all used at runtime) |
| `package-lock.json` | Modified (`M`) | E (Support) | Lockfile sync strictly for the 5 `services/api` realtime packages + direct transitive deps | Low | Keep |
| `services/api/src/app.module.ts` | Modified (`M`) | A (Phase 3.5) | Registers `RealtimeModule` globally in NestJS app | Low | Keep |
| `services/api/src/main.ts` | Modified (`M`) | A (Phase 3.5) | Attaches `WsAdapter` for `/ws/messaging` | Low | Keep |
| `services/api/src/modules/messaging/audio-security.ts` | Untracked (`??`) | A (Phase 3.5) | Magic-byte binary checks + packet-level `ffprobe` validation for voice notes (`<=60s`) | Low | Keep |
| `services/api/src/modules/messaging/dto/messaging.dto.ts` | Modified (`M`) | A (Phase 3.5) | Closed DTO validation for cursor pagination, send, voice presign/attach, ack | Low | Keep |
| `services/api/src/modules/messaging/messaging.controller.ts` | Modified (`M`) | A + C (3.5 / 3.5.2) | Conversation, history, ack, voice upload & authenticated `GET`/`HEAD` `/media/:mediaId/stream` routes | Low | Keep |
| `services/api/src/modules/messaging/messaging.module.ts` | Modified (`M`) | A (Phase 3.5) | Imports/connects messaging dependencies (`SafetyModule`, `ProfilesModule`) | Low | Keep |
| `services/api/src/modules/messaging/messaging.service.ts` | Modified (`M`) | A + B + C | `FOR UPDATE` sequencing (`matches -> conversations` lock order), `'pending'` outbox writes, Option A proxy streaming | Medium | Keep (retire dead `signVoiceNoteUrl` later) |
| `services/api/src/modules/realtime/realtime.types.ts` | Untracked (`??`) | A + B | Channel constants, TTLs, `OutboxRelayStatus`, internal bus union types | Low | Keep |
| `services/api/src/modules/realtime/realtime-ticket.service.ts` | Untracked (`??`) | A (Phase 3.5) | Single-use 45s SHA-256 Redis `GETDEL` ticket service | Low | Keep |
| `services/api/src/modules/realtime/realtime-event-bus.service.ts` | Untracked (`??`) | A + B | Redis Pub/Sub + reconnect `retryStrategy` + `publishEnvelopeReliable` | Low | Keep |
| `services/api/src/modules/realtime/messaging.gateway.ts` | Untracked (`??`) | A (Phase 3.5) | `ws` gateway (`5s` first-frame auth, rejects URL creds, room isolation & eviction) | Low | Keep |
| `services/api/src/modules/realtime/messaging-outbox-relay.service.ts` | Untracked (`??`) | B (Phase 3.5.1) | Two-phase `FOR UPDATE SKIP LOCKED` relay worker, backoff, suppression | Low | Keep |
| `services/api/src/modules/realtime/realtime.module.ts` | Untracked (`??`) | A + B | Exports `RealtimeTicketService`, `RealtimeEventBusService`, `MessagingOutboxRelayService`, `MessagingGateway` | Low | Keep |
| `services/api/src/modules/dating/dating.service.ts` | Modified (`M`) | A (Phase 3.5) | Post-commit `publishMatchEnded` hook on `unmatch` (`Optional` bus) | Low | Keep |
| `services/api/src/modules/safety/safety.service.ts` | Modified (`M`) | A (Phase 3.5) | Post-commit `publishMatchEnded` on `blockUser`; supports verified `conversationId`/`messageId` on report | Low | Keep |
| `services/api/src/modules/safety/dto/safety.dto.ts` | Modified (`M`) | A (Phase 3.5) | Optional UUID `conversationId` & `messageId` on `ReportUserDto` | Low | Keep |
| `services/api/src/modules/safety/match-authorization.service.ts` | Modified (`M`) | A (Phase 3.5) | Returns closed conversation contexts from `invalidateActiveMatchesForAccount` for revocation fan-out | Low | Keep |
| `services/api/src/modules/identity/identity.service.ts` | Modified (`M`) | A (Phase 3.5) | Post-commit `publishMatchEnded` + `publishAccountRevoked` on `suspendOrRestrictAccount` | Low | Keep |
| `services/api/src/modules/verification/verification.service.ts` | Modified (`M`) | A (Phase 3.5) | Post-commit `publishMatchEnded` + `publishAccountRevoked` on eligibility revocation | **Med** | Keep (rebase carefully with `main` `3e13859`) |
| `scripts/outbox-ops.mjs` | Untracked (`??`) | B (Phase 3.5.1) | Safe CLI-only outbox `inspect`, `replay`, `replay-failed` (zero payload/PII output) | Low | Keep |
| `apps/web/test/chats-state.test.ts` | Untracked (`??`) | D (Tests) | Phase 3.5 Web unit tests (5 tests) | Low | Keep |
| `services/api/test/phase3-5-messaging.test.ts` | Untracked (`??`) | D (Tests) | Unit & integration tests covering messaging, voice, WS, `PHASE351-OUTBOX-01` & `PHASE352-MEDIA-STREAM-01` | Low | Keep |
| `scripts/test-phase3-4-matches-e2e.mjs` | Modified (`M`) | D (Tests) | Selector compatibility update (`textarea` alongside `input` for upgraded `/chats` composer) | Low | Keep |
| `scripts/test-phase3-5-chats-e2e.mjs` | Untracked (`??`) | D (Tests) | Real PG/Redis/S3/2x-API/Next-BFF/`ffprobe`/Edge E2E suite | Low | Keep |
| `scripts/test-phase3-5-1-outbox-e2e.mjs` | Untracked (`??`) | D (Tests) | Real PG/Redis (`docker stop/start`) outbox E2E suite | Low | Keep |
| `scripts/test-phase3-5-2-media-e2e.mjs` | Untracked (`??`) | D (Tests) | Real Next BFF -> API -> Local S3 11-case auth, Range & mid-stream abort E2E suite | Low | Keep |
| `docs/decisions/DECISION_REGISTER.md` | Modified (`M`) | D (Docs) | Adds `ADR-021..023` & pending `D-P35-01..03` | Low | Keep |
| `docs/implementation/AGENT_COORDINATION.md` | Modified (`M`) | D (Docs) | Appends Phase 4 `MATCH-22` LiveKit SFU eviction & legacy route retirement handoff | Low | Keep |
| `docs/decisions/ADR-021..023*.md` (3 files) | Untracked (`??`) | D (Docs) | ADRs for WS transport, Outbox Relay, and Option A Streaming Proxy | Low | Keep |
| `docs/implementation/PHASE3_5_*.md` (11 files) | Untracked (`??`) | D (Docs) | Traceability, reports, closure reviews, evidence, visual QA, final acceptance, security boundaries & Git diff review | Low | Keep |

*(Total accounted files: 29 modified tracked + 32 untracked = 61 individual files cleanly accounted. Zero unrelated `G` or unknown `H` files were found.)*

---

## 3. Dependencies, Migrations & Diff Audits (`Part 6.4–6.8`)

### 3.1 Dependencies (`Part 6.4`)
- Direct additions in [services/api/package.json](file:///i:/saymyname/services/api/package.json): `@nestjs/platform-ws@^11.2.11`, `@nestjs/websockets@^11.2.11`, `ws@^8.18.0`, `@types/ws@^8.5.14`, `ioredis@^5.6.0` (MIT licenses, zero extraneous packages).
- Verified [package-lock.json](file:///i:/saymyname/package-lock.json): all `+ "node_modules/..."` additions belong strictly to `@nestjs/platform-ws`, `@nestjs/websockets`, `ws`, `@types/ws`, `ioredis`, and their direct transitive deps (`@ioredis/commands`, `cluster-key-slot`, `denque`, `lodash.defaults`, `lodash.isarguments`, `redis-errors`, `redis-parser`, `standard-as-callback`, `tslib`). No unapproved UI libraries, cloud SDKs, or browsers were added.

### 3.2 Database & Migrations (`Part 6.5`)
- Inspected both SQL files directly:
  - [20261126000000_phase3_5_messaging_realtime_integrity/migration.sql](file:///i:/saymyname/packages/database/prisma/migrations/20261126000000_phase3_5_messaging_realtime_integrity/migration.sql): strictly `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and `CREATE [UNIQUE] INDEX IF NOT EXISTS`. Zero `DROP`, `TRUNCATE`, or unsafe backfills.
  - [20261126010000_phase3_5_1_outbox_relay_leases/migration.sql](file:///i:/saymyname/packages/database/prisma/migrations/20261126010000_phase3_5_1_outbox_relay_leases/migration.sql): strictly additive `next_attempt_at`, `locked_by`, `locked_until`, `last_error_code`, `last_error_at` + two partial relay indexes matching `MessagingOutboxRelayService` queries (`status`, `next_attempt_at`, `created_at` and `status`, `locked_until`).
  - Schema parity verified previously post-edit on `saymyname_phase32_audit` and `saymyname_dev` (`7` migrations applied, `migrate diff --exit-code` returned no difference).

### 3.3 Security-Sensitive & Script Diff Review (`Part 6.6–6.7`)
- **Authorization & BFF Security:** Verified BFF CSRF (`verifyOriginAndCsrf`), `HttpOnly` cookies, `no-store` cache directives, WebSocket URL-ticket blocking (`4400`), `GETDEL` single-use ticket consumption, uniform `403` media denial, RFC 9110 Range validation, `ffprobe` array-arg execution (`execFile`, shell disabled), canonical `matches -> conversations` lock ordering, and zero plaintext/PII in outbox logs or `outbox-ops.mjs`.
- **Scripts & Tests:** Inspected all Phase 3.5 test files (`phase3-5-messaging.test.ts`, `chats-state.test.ts`, `test-phase3-5-chats-e2e.mjs`, `test-phase3-5-1-outbox-e2e.mjs`, `test-phase3-5-2-media-e2e.mjs`, `test-phase3-4-matches-e2e.mjs`). Uses synthetic credentials only (`saymyname_phase32_audit`), deterministic readiness polling (`waitUntil`/`waitForHttp`), zero skipped assertions, and full teardown (`finally` deletes synthetic DB rows and terminates spawned processes).
- **Inherited / Divergence Finding:** `main` (`3e13859`) modifies `services/api/src/modules/verification/verification.service.ts` ahead of baseline `9e1a58d`. Merging `phase-3-5-chats` into `main` must preserve both `3e13859`'s fail-closed `503` guard and Phase 3.5's `realtimeBus` revocation emission.

---

## 4. Merge-Readiness Recommendation (`Part 10`)

**Classification:** **`CONDITIONAL PASS` — Ready for Human Acceptance & Branch Merge Authorization** under the following tracked follow-ups:
1. Merge/rebase cleanly with `main` (`3e13859` on `verification.service.ts`).
2. Keep `MATCH-22` external LiveKit SFU eviction explicitly tracked as `PARTIAL` / Phase 4 dependency (and retire legacy `/calling/voice-notes/*` routes during Phase 4).
3. Record human approvals on `D-P35-01`, `D-P35-02`, and `D-P35-03` (`NEEDS HUMAN DECISION`) prior to production deployment or automated purge-worker implementation.
