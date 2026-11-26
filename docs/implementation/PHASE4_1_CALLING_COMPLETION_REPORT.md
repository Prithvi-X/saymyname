# Phase 4.1 Completion Report: Secure Audio Calling, LiveKit Integration & Safety Lifecycle

**Date:** 2026-11-26  
**Branch:** `phase-4-1-calling-safety`  
**Status:** **IMPLEMENTATION COMPLETE — LOCAL REAL-STACK VERIFIED (Production & LiveKit Cloud NOT Authorized / NOT Deployed)**  

---

## 1. Checkpoints Delivered

1. **Calling Architecture & Provider Abstraction (`e555067`):** Installed `livekit-server-sdk@2.20.1`, added `calling-state-machine.ts`, `livekit-provider.adapter.ts`, calling `CallStatus` enum values (`inviting`, `connecting`, `active`, `reconnecting`) and WebSocket calling signal types (`call.invited`, `call.accepted`, `call.state_changed`, `call.ended`), documented in [`ADR-024`](file:///i:/saymyname/docs/decisions/ADR-024-livekit-audio-calling-and-sfu-eviction.md).
2. **Room & Scoped Token Lifecycle (`f2a4d73`):** Extended `messaging.call_sessions` (`20261126020000_phase4_1_call_sessions_safety`), enforced single active call per conversation, invitation TTL (`CALL_INVITE_TTL_SECONDS=45`), zero pre-acceptance tokens, recipient-only `accept`, post-accept/reconnect `/calling/:callId/token`, `/calling/:callId/state`, `/calling/conversations/:conversationId/active`, and privacy-minimized WS call signaling.
3. **`MATCH-22` Durable SFU Eviction (`6ce4ff7`):** Implemented atomic `call.evict` outbox writes inside `MatchAuthorizationService.closeMatchDownstreamState`, isolated `MessagingOutboxRelayService`, created `CallEvictionRelayService` with `FOR UPDATE SKIP LOCKED` + lease recovery + bounded backoff + reconciliation sweep, updated `VerificationService` invalidation broadcasts, and verified 6 real LiveKit Docker + Headless Edge WebRTC revocation/outage scenarios (`test-phase4-1-livekit-e2e.mjs`).
4. **Audio Calling Frontend (`a80305a`):** Installed `livekit-client`, created `apps/web/lib/calling-state.ts` and `apps/web/components/AudioCallOverlay.tsx`, wired real live audio room connection/mute/end/reconnect/revocation and `pagehide` microphone track cleanup into `apps/web/app/(app)/chats/page.tsx` and `apps/web/lib/api.ts`, verified with live 2-browser Edge + LiveKit Docker E2E (`test-phase4-1-browser-calling-e2e.mjs`) across `1440..375`.
5. **Legacy Cleanup & Streaming Boundary Verification (`ac77577`):** Retired legacy `POST /api/v1/calling/voice-notes/{presign,send}` handlers/DTOs and removed dead `MessagingService.signVoiceNoteUrl`, added RFC 9110 `ETag` + `If-Range` handling to `MessagingService.streamVoiceNoteMedia`, and verified BFF `HEAD`/`Range` `200`/`206`/`416` behavior.
6. **Final Regressions, Documentation & Acceptance Audit:** Completed all post-Checkpoint-5 builds, unit tests, real-stack E2E suites, and reports.

---

## 2. Verified Outcomes

| Layer | Suite / Check | Outcome |
|---|---|---|
| Shared packages & API compile | `@saymyname/contracts` build + `@saymyname/api` `tsc` + `tsc --noEmit` | **PASS** (0 errors) |
| Backend unit & domain suite | `npm run --workspace=@saymyname/api test` (14 suites) | **PASS** (`104/104`, 0 skipped) |
| Web compile & production build | `@saymyname/web` `tsc --noEmit` + `next build` | **PASS** (`31/31` routes) |
| Web state unit tests | `chats-state`, `discover-state`, `likes-state`, `matches-state`, `calling-state` (5 suites) | **PASS** (`21/21`, 0 skipped) |
| Real LiveKit Docker + Edge WebRTC `MATCH-22` E2E | `node scripts/test-phase4-1-livekit-e2e.mjs` (6 live scenarios) | **PASS** |
| Real Next.js BFF + LiveKit 2-Browser UI E2E | `node scripts/test-phase4-1-browser-calling-e2e.mjs` (`1440..375` responsive + live call + unmatch eviction) | **PASS** |
| Phase 3.5.1 Outbox Relay PG+Redis E2E regression | `node scripts/test-phase3-5-1-outbox-e2e.mjs` | **PASS** |
| Phase 3.5.2 Option A Streaming Proxy E2E regression | `node scripts/test-phase3-5-2-media-e2e.mjs` | **PASS** (`11/11` auth + `200/206/416` + abort) |
