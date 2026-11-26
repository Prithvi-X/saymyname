# Phase 4.1: MATCH-22 LiveKit SFU Eviction & Reconciliation Report

**Date:** 2026-11-26  
**Requirement:** `MATCH-22` (Termination of real-time calling privileges & active external SFU sessions upon unmatch, block, account suspension/deletion, or verification revocation)  
**Key Files:** [`match-authorization.service.ts`](file:///i:/saymyname/services/api/src/modules/safety/match-authorization.service.ts), [`call-eviction-relay.service.ts`](file:///i:/saymyname/services/api/src/modules/calling/call-eviction-relay.service.ts), [`livekit-provider.adapter.ts`](file:///i:/saymyname/services/api/src/modules/calling/livekit-provider.adapter.ts)  

---

## 1. Problem Closed

Prior to Phase 4.1, PostgreSQL `Match`/`Conversation`/`CallSession` closure and WebSocket revocation stopped future HTTP/WS operations, but an already-connected LiveKit WebRTC client could remain in the external SFU room until its `3600s` JWT expired.

---

## 2. Transactional Outbox + Durable Eviction Architecture

1. **Atomic Database Closure & Outbox Write (`MatchAuthorizationService.closeMatchDownstreamState`):**
   - Executed inside the caller's PostgreSQL transaction across all four revocation triggers:
     - **Unmatch:** `DatingService.unmatch`
     - **Block:** `SafetyService.blockUser`
     - **Account Suspension / Disable / Deletion:** `IdentityService.suspendOrRestrictAccount`
     - **Verification / Eligibility Revocation:** `VerificationService` (`submitAgeVerification`, `submitStudentEnrolmentVerification`, `decideCase`)
   - Closes ALL non-terminal `CallSession` rows (`inviting`, `initiated`, `ringing`, `accepted`, `connecting`, `active`, `reconnecting`) to `callStatus: 'ended'`, `endedReason`, `endedByAccountId`, and `evictionStatus: 'pending'`.
   - Writes durable `OutboxEvent` rows (`aggregateType: 'call_session'`, `eventType: 'call.evict'`, `payload: { callSessionId, conversationId, livekitRoomId, participantAccountIds, reason, revokeTokenTs }`) atomically in the same transaction.
2. **Relay Isolation (`MessagingOutboxRelayService`):**
   - Updated `MessagingOutboxRelayService.claimPendingOrExpiredBatch` to strictly filter `aggregate_type = 'conversation' AND event_type = 'message.created'`, ensuring zero cross-relay contention with `call.evict` rows.
3. **Durable Eviction Worker (`CallEvictionRelayService`):**
   - Wakes immediately on `RealtimeEventBusService` signals (`match_ended`, `account_revoked`, `call_eviction_queued`) AND polls cleanly using PostgreSQL `FOR UPDATE SKIP LOCKED` with lease timeouts (`CALL_EVICTION_LEASE_MS`) and bounded exponential backoff (`CALL_EVICTION_RETRY_BASE_MS` .. `CALL_EVICTION_RETRY_MAX_MS`).
   - Calls `LiveKitProviderAdapter.evictSession(...)`: executes `RoomServiceClient.removeParticipant(roomId, identity, { revokeTokenTs })` for both participants + `RoomServiceClient.deleteRoom(roomId)` + verifies `listParticipants(roomId).length === 0`.
   - Handles HTTP `404` / `not_found` idempotently (`evictionStatus = 'already_absent'`).
   - Updates `messaging.call_sessions` (`evictionStatus: 'completed' | 'already_absent' | 'retrying' | 'failed'`, `evictionAttempts`, `lastEvictionError`, `evictedAt`).
4. **Bounded Reconciliation Sweep:**
   - Expires timed-out ring invitations (`invite_timeout` -> `missed`), closes non-terminal calls on already-closed conversations/matches (`match_inactive`), and re-enqueues terminal calls stranded in `pending`/`retrying` without open outbox jobs.

---

## 3. Verified LiveKit Docker + Edge WebRTC Proof

Executed via [`scripts/test-phase4-1-livekit-e2e.mjs`](file:///i:/saymyname/scripts/test-phase4-1-livekit-e2e.mjs) against real PostgreSQL, Redis, local `livekit/livekit-server:latest` Docker container (`room.auto_create: false`), live NestJS API/WS, and two real Headless Microsoft Edge WebRTC peers:

1. **Unmatch mid-call:** Both Edge WebRTC peers disconnected immediately (`listParticipants === []`, stale JWT rejected, `/token` returns `403`, `evictionStatus === 'completed'`).
2. **Block mid-call:** Both Edge WebRTC peers evicted cleanly (`listParticipants === []`, stale JWT rejected).
3. **Account Suspension mid-call:** Both Edge WebRTC peers evicted cleanly (`listParticipants === []`).
4. **Verification Revocation mid-call:** Both Edge WebRTC peers evicted cleanly (`listParticipants === []`).
5. **Transient SFU Outage during Unmatch -> Recovery:** Closing `LIVEKIT_SERVICE_URL` during unmatch closed DB match/call cleanly while advancing `evictionStatus = 'retrying'`; restoring SFU URL completed live Edge disconnection automatically.
6. **Concurrent `/token` reconnect vs `unmatch`:** Zero surviving LiveKit room or active participants post-race.
