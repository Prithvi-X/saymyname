# Phase 3.5.1 — Transactional Outbox Reliability Report

**Date:** 2026-11-26  
**Branch:** `phase-3-5-chats`  
**Related ADR:** [ADR-022-transactional-outbox-relay.md](file:///i:/saymyname/docs/decisions/ADR-022-transactional-outbox-relay.md)  

---

## 1. Root Cause Resolved

Prior to Phase 3.5.1, `MessagingService` wrote `platform.outbox_events` pre-marked `status = 'processed'` inside the PostgreSQL transaction and emitted fire-and-forget Redis Pub/Sub events immediately post-commit without a lease-based retry worker. Any transient Redis outage or pod restart after database commit could drop live WebSocket delivery with no automatic recovery path.

## 2. Implemented Changes

1. **Additive PostgreSQL Migration (`20261126010000_phase3_5_1_outbox_relay_leases`):**
   - Added `next_attempt_at` (`TIMESTAMPTZ`), `locked_by` (`TEXT`), `locked_until` (`TIMESTAMPTZ`), `last_error_code` (`TEXT`), and `last_error_at` (`TIMESTAMPTZ`) to `platform.outbox_events`, plus partial indexes `outbox_events_relay_poll_idx` and `outbox_events_lease_expiry_idx`.
   - `MessagingService.sendMessage` and `MessagingService.sendVoiceNoteToConversation` now insert `OutboxEvent` rows strictly as `status = 'pending'`, `retryCount = 0`, `processedAt = null` inside the transaction and trigger `MessagingOutboxRelayService.triggerImmediateFlush()` post-commit.

2. **Two-Phase Lease-Based Relay Worker (`services/api/src/modules/realtime/messaging-outbox-relay.service.ts`):**
   - Claims batches via `SELECT ... FROM platform.outbox_events ... FOR UPDATE SKIP LOCKED` inside an atomic claim transaction and releases the DB lock BEFORE Redis I/O.
   - Groups claimed events by conversation and sorts ascending by `sequenceNo` prior to publishing.
   - Re-evaluates `MatchAuthorizationService` / conversation/match/block/account status before publishing; unauthorized/closed events transition cleanly to `status = 'suppressed'` (`lastErrorCode = 'connection_closed'`).
   - Transient failures reschedule `status = 'pending'` with bounded exponential backoff + jitter up to `OUTBOX_MAX_ATTEMPTS` (default `8`), after which exhausted or invalid payloads transition to `status = 'failed'`.

3. **Persistent Redis Reconnect Recovery (`RealtimeEventBusService`):**
   - Configured bounded `retryStrategy: (times) => Math.min(times * 400, 4000)`, automatic `REALTIME_REDIS_CHANNEL` resubscribe on `subClient 'ready'`, and `publishEnvelopeReliable` awaiting Redis `PUBLISH` acknowledgment (`OutboxTransientPublishError` on failure).

4. **Safe Local Operator Recovery Tooling (`scripts/outbox-ops.mjs`):**
   - Supports `inspect`, `replay <eventUuid>`, and `replay-failed` via CLI only (no HTTP exposure, zero message bodies or PII printed).

## 3. Verified Failure & Concurrency Matrix

All 10 required failure/concurrency scenarios passed in `PHASE351-OUTBOX-01` (unit harness) and key multi-worker/container failure modes passed against real PostgreSQL + live `docker stop/start saymyname-redis` in `scripts/test-phase3-5-1-outbox-e2e.mjs`:
- Normal transaction commit -> `pending` -> `published` + `processedAt` set.
- Redis outage (`docker stop saymyname-redis` & fault injection): rows stay `pending`, `retryCount` increments with backoff `nextAttemptAt`; automatic recovery upon `docker start saymyname-redis` delivers cross-instance without restart.
- Worker crash lease expiry (`locked_until <= NOW()`): reclaimed cleanly by surviving worker.
- Duplicate publish recovery: deterministic `eventId` passed across retries + REST `?afterSeq=` cursor reconciliation guarantees zero duplicate DB messages.
- Multi-worker competition (`pg-w1` vs `pg-w2`): `FOR UPDATE SKIP LOCKED` partitions `5/5` concurrent events with zero double-claims.
- Database outage resilience, bounded batch drainage (`OUTBOX_BATCH_SIZE`), poison payload dead-lettering + CLI replay, per-conversation ascending `sequenceNo` ordering, and post-unmatch suppression all verified.
