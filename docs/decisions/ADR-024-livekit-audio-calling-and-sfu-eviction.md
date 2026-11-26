# ADR-024: Server-Authoritative LiveKit 1:1 Audio Calling & Durable SFU Eviction

- **Status:** Accepted for Phase 4.1 implementation
- **Date:** 2026-11-26
- **Decision owner:** Security + Backend + Web Engineering (`Phase 4.1`)
- **Reviewers:** Application Security, Product Safety
- **Related tasks / documents:** Document 01 (§3.4, §3.7), Document 04 (§7, `MATCH-22`), Document 05 (§10.3), Document 06 (§6.8), `ADR-021`, `ADR-022`, [PHASE3_5_SECURITY_BOUNDARIES_AND_DEPENDENCIES.md](file:///i:/saymyname/docs/implementation/PHASE3_5_SECURITY_BOUNDARIES_AND_DEPENDENCIES.md)

---

## Context

Phase 3.5 closed database, REST, WebSocket chat, and voice-note media authorization boundaries across Unmatch, Block, Account Suspension/Deletion, and Verification Revocation, while keeping `MATCH-22` marked **`PARTIAL`** because `CallingService` had prototype 1-hour LiveKit token signing and zero `RoomServiceClient` participant eviction/room deletion. Furthermore, `CallingController` retained unhardened legacy prototype routes `POST /api/v1/calling/voice-notes/{presign,send}`.

---

## Decision Drivers

1. **Product Boundaries (`Doc 01`, `Doc 04 §7`, `Doc 05 §10.3`):** One-to-one audio-only calling between mutually matched, currently eligible adults; explicit invitation + acceptance before issuing room join credentials; zero default call recording, video, group calls, screen sharing, or AI transcription.
2. **Authoritative Backend Control:** PostgreSQL (`messaging.call_sessions`) and `MatchAuthorizationService` own call authorization, state transitions, and participant identity; LiveKit SFU handles encrypted WebRTC audio media forwarding only.
3. **Strict Audio-Only Grants & Short-Lived Credentials:** Participant tokens use `livekit-server-sdk` `AccessToken` restricted to `canPublishSources: [TrackSource.MICROPHONE]`, `canSubscribe: true`, `canPublishData: false`, `roomRecord: false`, `roomAdmin: false`, `roomCreate: false`, pseudonymous identity (`HMAC-SHA256`), and configurable short TTL (`LIVEKIT_JOIN_TOKEN_TTL_SECONDS = 300`, 5 minutes).
4. **Real `MATCH-22` SFU Eviction & Durable Retries:** Authorization revocation (`unmatch`, `block`, `suspend`, `delete`, `verification_revoked`) atomically closes `CallSession` rows AND inserts durable `call.evict` outbox events drained asynchronously with `FOR UPDATE SKIP LOCKED` lease claiming + `RoomServiceClient.removeParticipant(..., { revokeTokenTs })` + `deleteRoom`, plus bounded periodic reconciliation.
5. **Single Canonical Voice-Note Path:** Retire unsafe legacy `CallingController` voice-note endpoints (`POST /calling/voice-notes/*`) so Messaging (`audio-security.ts` + Option A streaming proxy) is the sole voice-note path.

---

## Decision

1. **Provider Abstraction (`LiveKitProviderAdapter`):** Isolate all `livekit-server-sdk` operations (`ensureRoom`, `mintAudioParticipantToken`, `removeParticipant`, `deleteRoom`, `listParticipants`, `computePseudonymousIdentity`) behind an injectable adapter inside `CallingModule` with normalized error handling and test doubles.
2. **State Machine (`calling-state-machine.ts`):** Enforce deterministic transitions across `inviting`/`initiated` -> `ringing` -> `accepted` -> `connecting` -> `active` <-> `reconnecting` -> terminal (`ended`, `rejected`, `missed`, `failed`), forbidding terminal reopening and concurrent duplicate invitations per conversation.
3. **No Pre-Acceptance Media Tokens & Strict Scoped Grants:** `POST /calling/invite` creates the invitation and reserves/creates the private room server-side without returning a LiveKit join token. Join tokens (`LIVEKIT_JOIN_TOKEN_TTL_SECONDS`, default `300s`, audio-only `TrackSource.MICROPHONE`, `roomCreate: false`, `roomRecord: false`, `roomAdmin: false`) issue ONLY upon `accepted` (recipient on `/respond` `accept`; caller/reconnect on `POST /calling/:callId/token` after server re-verification of active Match + eligibility + session state). LiveKit server configuration MUST enforce `room.auto_create: false` so `roomCreate: false` blocks deleted-room recreation with a stale unexpired JWT.
4. **Durable `MATCH-22` Eviction (`OutboxEvent` + Reconciliation):** Store `call.evict` jobs cleanly in `platform.outbox_events` (`aggregate_type = 'call_session'`) within revocation transactions, execute real `RoomServiceClient` removal/room deletion + provider absence verification, treat `404` idempotently, retry with bounded backoff when LiveKit is unreachable, and run a bounded reconciliation sweep on `messaging.call_sessions.eviction_status`.

---

## Known Boundaries Preserved Honestly

- Short `300s` token TTL bounds room-join capability only; already-connected participants rely on active `RoomServiceClient` eviction/room deletion (`MATCH-22`).
- Zero call audio or transcripts are persisted or recorded by SayMyName or LiveKit egress.
