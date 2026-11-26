# SAYMYNAME.IN — PHASE 3.5 FINAL ACCEPTANCE AUDIT
## Chats & Private Messaging

**Phase:** 3.5 — Chats & Private Messaging  
**Branch:** `phase-3-5-chats`  
**Audit Date:** 2026-11-26  
**Audited Commit Base:** `main` (`9e1a58d`)  

---

## A. Observed Verification Evidence Ledger (Post-Final-Edit)

| Check | Exact Command / Scope | Observed Result | Status |
|---|---|---|---|
| Shared Packages & API Build | `npm run --workspace=@saymyname/api build` (invokes `build:packages` + Prisma client generation + `tsc`) | Exit `0` | `PASS` |
| API Unit, WS & Audio Test Suites | `npm run --workspace=@saymyname/api test` (`12` suites including `phase3-5-messaging.test.js`) | **95 passed, 0 failed, 0 skipped** | `PASS` |
| Web State & Privacy Unit Suites | `node --test apps/web/test/*.test.ts` (`chats`, `discover`, `likes`, `matches`) | **18 passed, 0 failed, 0 skipped** | `PASS` |
| Next.js Production Build | `npm run --workspace=@saymyname/web build` | Exit `0`, **31/31 routes** compiled (`/api/auth/ws-ticket`, `/chats`) | `PASS` |
| Web Standalone Typecheck Note | `npm run --workspace=@saymyname/web typecheck` | Exits `2` on pre-existing `.ts` import extensions in `apps/web/test/*.test.ts` (required by Node `--test`); `next build` typechecked app routes cleanly | `PARTIAL` (pre-existing harness config) |
| PostgreSQL Migration & Drift Check | `prisma migrate status` & `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --exit-code` (`saymyname_phase32_audit`) | Exit `0`, `6 migrations found`, `Database schema is up to date!`, `No difference detected.` | `PASS` |
| Live Redis Service | `docker exec saymyname-redis redis-cli ping` + dual-instance Pub/Sub & ticket `GETDEL` in E2E | `PONG`, single-use tickets & cross-instance (`:4004`<->`:4005`) events verified | `PASS` |
| Phase 3.5 Real-World E2E | `node scripts/test-phase3-5-chats-e2e.mjs` (PG + Redis + Local S3 + 2x API/WS + Next BFF + `ffprobe` + Edge) | Exit `0`, `PHASE3_5_REAL_E2E_ALL_PASSED` (`0` JS exceptions, `0` horizontal overflow) | `PASS` |
| Visual Screenshot QA | Inspected all `15` rendered PNGs (`01`..`15`) in artifact `screenshots_phase3_5/` | Clean Mineral Night contrast/typography, responsive `1440`/`1280`/`768`/`430`/`390`/`375` framing, composer clear above `BottomNav`, `VoiceNotePlayer`, offline/retry, report/unmatch modals | `PASS` |
| Phase 3.2–3.4 Full Regressions | `test-phase3-4-matches-e2e.mjs`, `test-phase3-3-likes-e2e.mjs`, `test-phase3-2-closure-pg.mjs`, `test-phase3-2-discover-e2e.mjs` | All `4` suites exited `0` post-final-edit | `PASS` |
| Diff & Secret Hygiene | `git diff --check`, `.env*` status check & static secret/PII pattern scan | Exit `0`, zero secrets or `.env*` modifications | `PASS` |

---

## B. Architecture, Security & Concurrency Audit

- **Server-Side Default Deny (`MSG-01`, `MSG-02`):** Verified active bilateral `Match`, bidirectional `UserBlock`, `accountStatus === 'active'`, `deletedAt === null`, and current adult/student eligibility on every messaging REST endpoint, voice-note presign/attach/media URL fetch, and WebSocket `conversation.subscribe`.
- **PostgreSQL Monotonic Sequencing & Idempotency (`MSG-03`, `MSG-07`):** `sendMessage` and `sendVoiceNoteToConversation` acquire `FOR UPDATE` row lock on `messaging.conversations` paired with `(conversationId, sequenceNo)` uniqueness (`messages_conv_seq_key`), `clientAssignedUuid` deduplication, and `Idempotency-Key` records — verified under `5` concurrent simultaneous writes and duplicate retry loops.
- **WebSocket Ticket Security & Privacy (`ADR-021`, `RT-01..05`):** BFF route `POST /api/auth/ws-ticket` validates CSRF + session cookies and returns `Cache-Control: private, no-store...` + `Vary: Cookie`. Gateway rejects URL `?ticket=`/`?token=` (`4400`), enforces 5s first-frame authentication, atomically consumes 45s tickets (`GETDEL`, rejecting replay `4401`), and emits metadata-only event envelopes excluding plaintext message bodies, internal account IDs, and storage keys.
- **Anti-Surveillance Compliance (`MSG-04`, `MSG-10`):** Verified zero `Read` states, zero last-seen timestamps, zero online/offline status indicators, and zero typing events anywhere in API payloads, WebSocket frames, or DOM renders. Delivery status uses explicit `Sent` -> `Delivered` (`delivery-ack`).

---

## C. Voice-Note Media Pipeline Audit (`MSG-15..24`)

- **Explicit Capture & Preview:** Microphone capture opens only after explicit `Allow Mic & Record` interaction (`60s` max per `Doc 02 §4.3`), pauses into local preview (`Discard` / `Send Voice Note`), and never auto-sends.
- **Real Audio Validation & Purge (`audio-security.ts`):** Rejects disguised HTML/scripts/PE/ELF/PDF/image files and over-60s duration uploads (`400`) via magic-byte + `ffprobe` inspection (including packet-timestamp probing for headerless Chromium `MediaRecorder` WebM streams), purging rejected objects cleanly from S3/R2 and revoking playback URLs (`403`) immediately on unmatch or block.

---

## D. Findings Resolved During Final Audit

1. **Headerless Browser `MediaRecorder` WebM Probing:** Visual QA surfaced `Uploaded voice note duration could not be verified.` because Chromium `MediaRecorder` omits Matroska header duration (`N/A`). Fixed in `services/api/src/modules/messaging/audio-security.ts` via deterministic `ffprobe` packet timestamp fallback, re-verified cleanly with real Headless Edge recording.
2. **Window `scrollIntoView()` & Mobile Banner Framing:** Visual QA surfaced outer window scrolling (`scrollIntoView()`) and composer overlap behind `BottomNav` when a top feedback banner rendered on mobile (`390×844` / `375×812`). Fixed via inner `threadContainerRef.current.scrollTop` scrolling and viewport flex sizing (`h-[calc(100dvh-67px)]` + `flex-1 min-h-0`) in `apps/web/app/(app)/chats/page.tsx`, re-verified across all screenshots with `window.scrollY === 0`.

---

## E. Open Policy / Deferred Items & Residual Boundaries

- **`D04-10`, `D04-11`, `ADR-10` (`DEFERRED_BY_POLICY`):** Read receipts, typing indicators, last-seen, message self-delete/retention auto-purge, and client E2EE remain deferred pending explicit Product/Privacy decision.
- **Configurable Guardrails Awaiting Lock:** Text message limit harmonized at `1,000` chars (`Doc 06 §17` `OPEN`: `1,000` vs `2,000`); voice-note size cap set to `5 MB` default via `VOICE_NOTE_MAX_BYTES` (`D04-12`).
- **`MATCH-22` (`PARTIAL`):** DB/HTTP/JWT/WebSocket revocation verified live; external LiveKit SFU room/participant eviction (`RoomServiceClient`) remains deferred to Phase 4.
- **External Providers (`NOT RUN / NOT TOUCHED`):** Live remote Supabase PostgreSQL, Cloudflare R2, Resend, and LiveKit Cloud were not touched; local PG, Redis, S3, and Edge verified full behavior locally.

---

## F. Release Readiness & Human Gate

- Branch `phase-3-5-chats` is complete, verified, and preserved uncommitted for human review and acceptance (`no commits, pushes, merges, or deployments` executed).
- **Initial Historical Verdict:** Ready for Human Acceptance Sign-Off (with `Web Typecheck` marked `PARTIAL` and `MATCH-22` SFU eviction marked `PARTIAL`).

---

## G. Independent Closure Review Addendum (2026-11-26)

During the formal independent Phase 3.5 Closure Review (re-inspecting repository code, screenshots, accessibility, and full concurrency regressions), three additional hardening fixes were applied cleanly and re-verified across a complete post-edit run (`npm run --workspace=@saymyname/api build`, `typecheck`, `95/95` API tests, `npm run --workspace=@saymyname/web typecheck` **exit `0`**, `18/18` Web unit tests, `31/31` Next.js build routes, Prisma `validate` / `migrate status` / `migrate diff`, `test-phase3-5-chats-e2e.mjs`, `test-phase3-4-matches-e2e.mjs`, `test-phase3-3-likes-e2e.mjs`, `test-phase3-2-closure-pg.mjs`, `test-phase3-2-discover-e2e.mjs`, and `git diff --check`):

1. **Resolved PostgreSQL `40P01` Deadlock Risk (`services/api/src/modules/messaging/messaging.service.ts`):** Independent regression testing caught a lock-order inversion between `MessagingService` (`conversations FOR UPDATE` before `matches FOR SHARE`) and `DatingService.unmatch` (`matches FOR UPDATE` before `conversations`). Reordered `sendMessage` and `sendVoiceNoteToConversation` to lock `dating.matches` before `messaging.conversations`, after which the 5-way Phase 3.4 unmatch race and Phase 3.5 concurrency suites passed cleanly (`exit 0`).
2. **Resolved `@saymyname/web typecheck` (`apps/web/tsconfig.json`):** Added `"allowImportingTsExtensions": true` alongside existing `"noEmit": true` and `"moduleResolution": "bundler"`, resolving all `4` `TS5097` errors in `apps/web/test/*.test.ts` without modifying strictness or exclusions (**updated from `PARTIAL` to `PASS` — exit `0`**).
3. **Modal Focus Trap & Voice Cleanup (`Dialog.tsx`, `VoiceNotePlayer.tsx`):** Added focus capture, `Tab`/`Shift+Tab` trapping, trigger focus restoration on close, and `<audio>` unmount/media-switch pause cleanup.
4. **Updated Closure Verdict — `CONDITIONAL PASS`:** Core messaging, realtime WebSockets, `ffprobe` voice verification, privacy invariants, and Phase 3.2–3.4 regressions are accepted. Formal closure carries **`CONDITIONAL PASS`** subject to:
   - Recording explicit human decisions (`NEEDS HUMAN DECISION`) for `D-P35-01` / `OD-07` (`1,000` vs `2,000` vs `4,000` message characters) and `D-P35-02` / `D04-12` (`5 MB` voice-note cap).
   - Preserving `MATCH-22` (`PARTIAL` — LiveKit SFU room eviction) and async `OutboxEvent` retry-worker hardening (`PARTIAL` — durable PG + `?afterSeq=` reconnect recovery active; dedicated poller not yet built) for Phase 4.
   - Remote cloud infrastructure (Supabase, Cloudflare R2, Resend, LiveKit Cloud) remains untouched (`NOT RUN`).

See [PHASE3_5_CLOSURE_REVIEW.md](file:///i:/saymyname/docs/implementation/PHASE3_5_CLOSURE_REVIEW.md), [PHASE3_5_CLOSURE_EVIDENCE.md](file:///i:/saymyname/docs/implementation/PHASE3_5_CLOSURE_EVIDENCE.md), and [PHASE3_5_VISUAL_ACCEPTANCE.md](file:///i:/saymyname/docs/implementation/PHASE3_5_VISUAL_ACCEPTANCE.md).


---

## Addendum — Phase 3.5.1 & 3.5.2 Acceptance Upgrade (2026-11-26)

- Previous conditional blockers on outbox relay durability and 90s direct R2 pre-signed voice-note URLs are **RESOLVED** via `MessagingOutboxRelayService` (`ADR-022`) and Option A same-origin BFF streaming proxy (`ADR-023`).
- Updated audit summary recorded in [`PHASE3_5_1_2_FINAL_ACCEPTANCE.md`](file:///i:/saymyname/docs/implementation/PHASE3_5_1_2_FINAL_ACCEPTANCE.md); policy decisions `D-P35-01`, `D-P35-02`, and `D-P35-03` remain `NEEDS HUMAN DECISION`.

- **Final Security Boundaries & Git Review (2026-11-26):** Reconciled Option A streaming proxy chronology, client-byte & stateless 15m JWT residual limits, legacy `/calling/voice-notes/*` Phase 4 retirement note, `MATCH-22` (`PARTIAL` -> Phase 4 spec), and full 58-file diff classification in [`PHASE3_5_SECURITY_BOUNDARIES_AND_DEPENDENCIES.md`](file:///i:/saymyname/docs/implementation/PHASE3_5_SECURITY_BOUNDARIES_AND_DEPENDENCIES.md) and [`PHASE3_5_FINAL_GIT_DIFF_REVIEW.md`](file:///i:/saymyname/docs/implementation/PHASE3_5_FINAL_GIT_DIFF_REVIEW.md).
