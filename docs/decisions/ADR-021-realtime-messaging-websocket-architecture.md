# ADR-021: Real-Time Messaging Transport, BFF WebSocket Tickets & Redis Fan-Out

- **Status:** Accepted for Phase 3.5 implementation (Open policy limits highlighted for final product lock)
- **Date:** 2026-11-26
- **Decision owner:** Backend + Security + Web Engineering Lead (`Phase 3.5`)
- **Reviewers:** Application Security, Architecture
- **Related tasks / documents:** Document 04 (`MSG-01..24`, `D04-10..12`), Document 05 (§6.2, §6.5, §7, §14.1–14.2, `ADR-09`, `ADR-10`, `ADR-12`), Document 06 (§6.5–6.7, §12, §17), `ADR-018`

---

## Context

Phase 3.4 delivered `/matches` and deep-linked `/chats`, backed by PostgreSQL persistence (`messaging.conversations`, `messaging.conversation_members`, `messaging.messages`, `messaging.message_media`) and Next.js `HttpOnly` cookie sessions (`ADR-018`). However, the application currently has:
1. Zero WebSocket gateway or realtime transport in `services/api`.
2. No browser realtime authentication flow compatible with BFF `HttpOnly` cookies (where raw JWTs are forbidden in browser JS, `localStorage`, and URLs).
3. No multi-instance Redis fan-out bridge, durable `outbox_events` recording, sequence cursor recovery (`?afterSeq=`), personal inbox unread tracking, or server-verified persisted voice-note uploads (`MessageMedia`).

---

## Decision Drivers

1. **Preserve BFF Session Security (`ADR-018`, Part 07 §7.3):** Browser JavaScript must never read JWT access/refresh tokens, and WebSocket connection credentials must never appear in query-string URLs or HTTP access logs.
2. **Database Source of Truth (`Doc 05 §14.2`, `Doc 06 §12`):** PostgreSQL remains canonical; messages + sequence numbers + `outbox_events` commit before any WebSocket notification fires, and WebSocket reconnects reconcile via authenticated REST cursor fetches (`?afterSeq=`).
3. **Privacy-Minimized Envelopes (`Doc 06 §12.2`):** WebSocket notifications emit minimal metadata (`event_id`, `event_type`, `aggregate.id`, `sequence_no`, `message_id`) without raw message text, voice URLs, email, DOB, or partner account identifiers.
4. **Horizontal Scalability (`Doc 05 §14.1`):** Support stateless API instances via Redis Pub/Sub fan-out while degrading safely when Redis is omitted in isolated unit tests.
5. **No Unapproved Providers / Features:** Stay strictly inside the NestJS + PostgreSQL + Redis + R2 stack (`AGENTS.md`); exclude forced read receipts (`D04-10`), last-seen/online presence, typing history, message reactions, and unapproved attachments.

---

## Options Considered

1. **Option A (Selected): Native RFC-6455 WebSockets (`@nestjs/websockets` + `@nestjs/platform-ws` + `ws`) + Single-Use BFF Ticket Frame Auth + Redis Pub/Sub (`ioredis`) + PostgreSQL Outbox & REST Reconciliation.**
   - Lightweight, standards-compliant browser `new WebSocket(...)` (also directly usable in React Native / Expo).
   - No HTTP long-polling downgrade or query-token exposure; client authenticates with a single-use short-lived HMAC/Redis-backed ticket in the **first WebSocket JSON frame** `{ event: 'authenticate', data: { ticket } }` within a strict 5s handshake timeout.
   - Cross-instance event broadcast via Redis Pub/Sub channel `smn:realtime:events` (`ioredis`), automatically dropping/evicting subscribed sockets upon committed `match.ended` / `access.revoked` / `account.revoked` domain events.
2. **Option B: Socket.IO (`@nestjs/platform-socket.io`).**
   - Adds larger client protocol weight, polling transport fallback complexity across strict proxies, and non-standard framing relative to native `WebSocket` clients on Web & React Native.
3. **Option C: Short-interval REST polling.**
   - Rejected: Explicitly fails Part 07 realtime requirements and increases idle database load.

---

## Decision

Adopt **Option A**:
1. **BFF WebSocket Ticket Flow (`Part 07 §7.3`):**
   - Authenticated browser requests `POST /api/auth/ws-ticket` (validated via Next.js Origin/CSRF + `HttpOnly` access/refresh session cookies; `Cache-Control: no-store`).
   - Next.js BFF calls `POST /api/v1/messaging/realtime/ticket` with `Authorization: Bearer <accessToken>` on behalf of the session.
   - `RealtimeTicketService` enforces `JwtAuthGuard` + `EligibilityGuard` (plus active non-suspended/non-deleted verification) and issues a **single-use, 45-second TTL cryptographic ticket** stored hashed in Redis (`SET key payload PX 45000 NX`) or single-use in-memory fallback when `REDIS_URL` is disabled, bound strictly to `accountId`.
   - Browser opens `WebSocket` (`ws://.../ws/messaging` or `wss://.../ws/messaging`) with zero credentials in the URL and immediately sends `{ event: 'authenticate', data: { ticket } }`. Server atomically consumes (`GETDEL` / `DEL`) the ticket (`single-use`, `timingSafeEqual`), closes unauthenticated sockets after `5s`, and rejects expired/replayed tickets (`4401` / `authorization.failed`).
2. **Authorization & Channel Isolation:**
   - Every `conversation.subscribe` action re-runs `MatchAuthorizationService.assertAuthorizedForConversation(accountId, conversationId)`. Server assigns rooms by verified `conversationId` + `accountId`. Client-supplied `conversationId` without active match/membership fails with `authorization.failed`.
   - `DatingService.unmatch`, `SafetyService.blockUser`, and `IdentityService.suspendOrRestrictAccount` publish domain revocation events ONLY after PostgreSQL transaction commit; gateway immediately leaves/evicts affected sockets, sends generic `conversation.closed` / `access.revoked` without moderation reason leakage, and prevents further delivery.
3. **Durable Message & Outbox Path:**
   - `MessagingService.sendMessage` & `sendVoiceNote` lock `messaging.conversations` `FOR UPDATE` + verify `MatchAuthorizationService` (`FOR SHARE`) inside `prisma.$transaction`, enforce idempotency via `(senderAccountId, clientAssignedUuid)` & `IdempotencyRecord`, insert `Message` (+ `MessageMedia`), update `Conversation.lastMessageAt`, advance sender's own `ConversationMember.lastReadSeq`, and insert `platform.outbox_events` (`message.created`) in the same transaction.
   - WebSocket fan-out notifies active authorized sockets after DB commit; clients deduplicate by `message.id`/`sequenceNo` and call REST `?afterSeq=` on reconnect/gap detection.
4. **Voice-Note Verification (`D04-12` Guardrail):**
   - `VOICE_NOTE_MAX_DURATION_SEC = 60` (`Doc 02 §4.3`), `VOICE_NOTE_MAX_BYTES = 5 * 1024 * 1024` (configurable runtime default pending `D04-12` product lock), verified server-side via magic-byte header checks + `ffprobe` audio stream/duration inspection before persisting `MessageMedia`.

---

## Consequences & Known Limitations

- Multi-instance horizontal fan-out requires `REDIS_URL` pointing to Redis 7; unit tests / single-process dev without `REDIS_URL` operate safely via local in-process `EventEmitter` fan-out.
- `MATCH-22` external LiveKit SFU room eviction remains scoped to Phase 4 (`PHASE3_4_FINAL_ACCEPTANCE_AUDIT.md`).
- Read receipts (`D04-10`), E2EE key exchange (`ADR-10`), and permanent retention/deletion schedules (`D04-11`) remain unactivated pending explicit human approval.
