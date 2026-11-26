# ADR-022: Transactional Outbox Relay, Lease Claiming & Retry Backoff

- **Status:** Accepted for Phase 3.5.1 reliability hardening
- **Date:** 2026-11-26
- **Decision owner:** Backend & Infrastructure Engineering (`Phase 3.5.1`)
- **Reviewers:** Security & Reliability Engineering
- **Related tasks / documents:** Document 05 (§14.1–14.2), Document 06 (§12, `platform.outbox_events`), `ADR-021`

---

## Context

`ADR-021` established durable `OutboxEvent` rows written inside PostgreSQL messaging transactions alongside `Message` and `MessageMedia`. However, the initial Phase 3.5 implementation pre-inserted rows with `status: 'processed'` and emitted fire-and-forget Redis Pub/Sub events immediately post-commit without a dedicated asynchronous relay worker. If Redis experienced a transient disconnect, a process crashed after DB commit, or multiple API pods restarted cleanly, undelivered realtime notifications could not be retried cleanly from the database.

---

## Decision Drivers

1. **PostgreSQL as Canonical Truth:** Every `OutboxEvent` row MUST commit atomically as `status = 'pending'`, never optimistically pre-marked `processed` or `published`.
2. **Multi-Instance Safety:** Multiple NestJS API replicas running concurrently MUST NOT claim or publish the same outbox row simultaneously, nor hold database row locks across network Redis I/O.
3. **Crash & Redis Outage Resilience:** Crashed workers holding stale leases MUST have work safely reclaimed cleanly; transient Redis unavailability MUST retry with bounded exponential backoff + jitter and auto-resubscribe upon reconnect.
4. **Post-Unmatch Privacy Invariant:** If a match ends, a block is created, or an account is suspended/deleted between message commit and relay publication, the relay MUST suppress publication before emitting to Redis.
5. **Poison-Event Containment & Zero-PII Telemetry:** Malformed or permanently unrecoverable payloads MUST transition cleanly to `failed` (not retry infinitely), never block healthy events, and never expose private message text or PII in structured logs or operator tooling.

---

## Decision

Adopt an asynchronous PostgreSQL-backed transactional outbox relay (`MessagingOutboxRelayService`) inside `@saymyname/api`:

1. **Schema & Additive Lease Columns (`20261126010000_phase3_5_1_outbox_relay_leases`):**
   - Extend `platform.outbox_events` with `next_attempt_at`, `locked_by`, `locked_until`, `last_error_code`, and `last_error_at`, plus partial composite indexes `outbox_events_relay_poll_idx` and `outbox_events_lease_expiry_idx`.
   - `MessagingService.sendMessage` and `sendVoiceNoteToConversation` insert `OutboxEvent` with `status: 'pending'`, `retryCount: 0`, `nextAttemptAt: now`, `processedAt: null` inside the same database transaction, then invoke `outboxRelay.triggerImmediateFlush()` asynchronously post-commit.

2. **Two-Phase Lease-Based Claiming (`FOR UPDATE SKIP LOCKED`):**
   - Each claim transaction selects eligible rows where `(status = 'pending' AND next_attempt_at <= NOW()) OR (status = 'processing' AND locked_until <= NOW())` ordered by `created_at ASC LIMIT $batch FOR UPDATE SKIP LOCKED`, updates them atomically to `status = 'processing'`, `locked_by = workerId`, `locked_until = NOW() + leaseMs`, `retry_count = retry_count + 1`, and commits the DB lock BEFORE doing any Redis I/O.
   - Events within a batch are grouped by `conversationId` and sorted by `sequenceNo ASC` prior to publishing.

3. **Pre-Publish Authorization Check & Reliable Redis Publish:**
   - Before publishing, `MessagingOutboxRelayService` checks `MatchAuthorizationService` / conversation/match/block/account status; if ineligible, transitions row (fenced by `locked_by = workerId`) to `status = 'suppressed'` (`last_error_code = 'connection_closed'`).
   - `RealtimeEventBusService` configures persistent bounded `retryStrategy` (`Math.min(times * 400, 4000)`) and auto-resubscribes on `subClient 'ready'`. `publishEnvelopeReliable` awaits Redis `PUBLISH` confirmation and throws `OutboxTransientPublishError` when Redis is disconnected.

4. **Bounded Exponential Backoff, Dead-Lettering & Safe CLI Recovery:**
   - Transient failures reschedule `status = 'pending'` with bounded exponential backoff + jitter up to `OUTBOX_MAX_ATTEMPTS` (default `8`, then transitions to `failed`). Permanent payload errors transition directly to `failed`.
   - Local-only CLI [`scripts/outbox-ops.mjs`](../../scripts/outbox-ops.mjs) supports `inspect`, `replay <uuid>`, and `replay-failed` without exposing HTTP endpoints or printing message payloads/PII.

---

## Consequences & Limitations

- Real-time delivery remains **at-least-once** across worker crash windows (`crash after Redis PUBLISH before DB update`); clients safely deduplicate using `eventId` / `message.id` / `sequenceNo` and reconcile missed events via `GET /history?afterSeq=`.
- During complete Redis outages, durable message persistence remains unaffected (`201 Created` after PG commit); live WS notifications pause until Redis reconnects and the backlog drains in bounded batches.
