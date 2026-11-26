# Phase 4.1: Audio Calling Architecture & Scope

**Date:** 2026-11-26  
**Branch:** `phase-4-1-calling-safety` (branched from `phase-3-5-chats` merge commit `6ae6f5c`)  
**Decision Authority:** [`ADR-024`](file:///i:/saymyname/docs/decisions/ADR-024-livekit-audio-calling-and-sfu-eviction.md), Document 01, Document 04, Document 05, Document 06  

---

## 1. Delivered Scope (Strict 1:1 Audio-Only Calling)

Phase 4.1 replaces the pre-existing partial `CallingService` stub with an end-to-end, consent-gated, server-authoritative **1:1 audio-only LiveKit calling system**:

- **LiveKit Server SDK Integration:** Installed `livekit-server-sdk@2.20.1` (`@saymyname/api`) and `livekit-client` (`@saymyname/web`), wrapped inside `LiveKitProviderAdapter` ([`livekit-provider.adapter.ts`](file:///i:/saymyname/services/api/src/modules/calling/livekit-provider.adapter.ts)).
- **Server-Authoritative Room & Identity Generation:**
  - Unpredictable server room names (`smn_call_<32-hex>`).
  - Pseudonymous deterministic participant identities (`smn_p_<24-hex>`) via HMAC-SHA256 (`CALLING_IDENTITY_HMAC_SECRET` / key-derived secret), ensuring zero raw `accountId`, email, student roll number, or display name reaches LiveKit telemetry.
  - Room reservation on invite via `RoomServiceClient.createRoom({ maxParticipants: 2, ... })`.
- **Audio-Only Least-Privilege Tokens (`<= 300s`):**
  - Default `LIVEKIT_JOIN_TOKEN_TTL_SECONDS = 300` (bounded `60..300`).
  - Video, screen share, data channel publishing (`canPublishData: false`), metadata updates (`canUpdateOwnMetadata: false`), room creation (`roomCreate: false`), room listing (`roomList: false`), recording (`roomRecord: false`), and admin rights (`roomAdmin: false`) are disabled in all grants (`canPublishSources: [TrackSource.MICROPHONE]`).
  - LiveKit deployments MUST set `room.auto_create: false` so `DeleteRoom` + `roomCreate: false` prevents stale unexpired token replay.
- **Zero Pre-Acceptance Tokens & Single Active Call Per Conversation:**
  - `POST /api/v1/calling/invite` (and alias `/calling/call-sessions/invite`) verifies `MatchAuthorizationService`, checks for conflicting non-terminal calls under row lock, enforces `CALL_INVITE_TTL_SECONDS` (default `45s`), reserves the SFU room, and returns `{ callSession, expiresAt }` with **zero participant join tokens**.
  - Only upon recipient acceptance (`POST /api/v1/calling/:callId/respond` with `action: 'accept'`) does the recipient receive their scoped token; caller and reconnecting participants fetch fresh tokens via `POST /api/v1/calling/:callId/token` after server re-verification of active match, block, account status, verification eligibility, and joinable session state.
- **Deterministic State Machine ([`calling-state-machine.ts`](file:///i:/saymyname/services/api/src/modules/calling/calling-state-machine.ts)):**
  - Enforces valid transitions across `inviting` / `initiated` -> `ringing` -> `accepted` -> `connecting` -> `active` <-> `reconnecting` -> terminal (`ended`, `rejected`, `missed`, `failed`).
  - Blocks terminal reopening (`409 ConflictException`).
- **Additive Schema Migration (`20261126020000_phase4_1_call_sessions_safety`):**
  - Extends `messaging.call_sessions` cleanly with `expires_at`, `ended_reason`, `ended_by_account_id`, `eviction_status`, `evicted_at`, `eviction_attempts`, `last_eviction_error`, `updated_at`, and indexes `(conversation_id, call_status)` and `(eviction_status)`.

---

## 2. Explicit Non-Scope Preserved

Per Phase 4.1 boundaries and Document 01 invariants:

- Video calling, screen sharing, group calls, call recording, AI transcription, mini-games expansion, virtual date expansion, Relationship Mode changes, LiveKit Cloud production deployment, and modification of `main` or `landing-page-repositioning` were excluded and untouched.
- Legacy prototype endpoints `POST /api/v1/calling/voice-notes/presign`, `POST /api/v1/calling/voice-notes/send`, and dead `MessagingService.signVoiceNoteUrl` were retired in favour of Phase 3.5.2 Option A streaming proxy (`/api/bff/v1/messaging/media/:mediaId/stream`).
