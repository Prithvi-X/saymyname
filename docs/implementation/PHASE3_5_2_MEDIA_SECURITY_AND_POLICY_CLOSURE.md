# Phase 3.5.2 — Voice-Note Access Security & Messaging Policy Closure Report

**Date:** 2026-11-26  
**Branch:** `phase-3-5-chats`  
**Related ADR:** [ADR-023-authenticated-voice-note-streaming-proxy.md](file:///i:/saymyname/docs/decisions/ADR-023-authenticated-voice-note-streaming-proxy.md)  
**Decision Register:** [`D-P35-01`, `D-P35-02`, `D-P35-03`](file:///i:/saymyname/docs/decisions/DECISION_REGISTER.md)

---

## 1. Selected Architecture: Option A Same-Origin Streaming Proxy

- Message DTOs (`toSanitizedMessageDto`) and `GET /api/v1/messaging/media/:mediaId/url` now emit `/api/bff/v1/messaging/media/${mediaId}/stream` (`accessMode: 'same_origin_proxy'`) with zero pre-signed S3/R2 URLs or raw `s3Key`s ever returned to browsers.
- `GET` & `HEAD /api/v1/messaging/media/:mediaId/stream` in NestJS (`MessagingController` / `MessagingService.streamVoiceNoteMedia`):
  - Enforces `JwtAuthGuard`, `EligibilityGuard`, and `MatchAuthorizationService.assertActiveMatchConversationMember` on every initial fetch and HTTP `Range` request.
  - Returns uniform `403 Forbidden ('Voice-note media is unavailable.')` on both unauthorized and missing `mediaId` requests to eliminate UUID existence oracles.
  - Supports single byte ranges (`206 Partial Content`, `Accept-Ranges: bytes`, `Content-Range`) per RFC 9110 and fails closed with `416 Range Not Satisfiable` on invalid or multi-range specs.
  - Sets strict non-cacheable headers (`Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy: same-origin`, `Vary: Authorization`).
  - Subscribes active stream handlers to `RealtimeEventBusService` (`match_ended`, `account_revoked`) and client `close` events to abort upstream R2/S3 streams mid-flight upon revocation or disconnect.
- Next.js BFF (`apps/web/lib/server-bff.ts` & `apps/web/app/api/bff/v1/[...path]/route.ts`) forwards `Range`, `If-Range`, and `request.signal`, exports `HEAD` alongside existing methods, and streams audio/`206` responses without buffering JSON while preserving cookie clearing/rotation.
- `VoiceNotePlayer` streams directly through the same-origin proxy path, checks `HEAD` on playback error to classify `401`/`403` cleanly, and stores zero signed URLs or client tokens.

## 2. Authorization & Streaming Verification (`PHASE352-MEDIA-STREAM-01` & `test-phase3-5-2-media-e2e.mjs`)

- **11/11 Authorization Cases Verified:** Active Sender (`200`), Active Recipient (`200`), Unauthenticated (`401`), Logged-out Cookie/Refresh Session (`401`), Outsider Non-Member (`403`), Nonexistent `mediaId` (`403` uniform anti-oracle), Unmatched Partner (`403`), Blocked Partner (`403`), Verification Revocation (`403`), Suspended Account (`403`), Deleted Account (`403`).
- **Range & Mid-Stream Revocation Verified:** Forward seek (`bytes=1024-2047` -> `206`), backward seek (`bytes=0-511` -> `206`), out-of-bounds (`416`), and mid-stream slow-drip revocation via unmatch terminating upstream delivery.

## 3. Security Trade-Offs & Remaining Limits

- Audio bytes already flushed to a client socket and decoded before revocation cannot be un-sent by any server.
- Stateless `smn_access_token` JWTs remain valid for their short TTL if copied outside a cookie jar (`ADR-018`); browser logout clears `HttpOnly` cookies and revokes DB refresh sessions immediately (`401`).
- Next.js 15 App Router `HEAD` adapter emits `Content-Length: 0` with `Accept-Ranges: bytes` and `Content-Type: audio/*` on null-body responses; full `GET` (`200`) and partial `GET` (`206`) carry exact byte counts and `Content-Range` bounds.

## 4. Open Product & Legal Policy Governance (`NEEDS HUMAN DECISION`)

All three pending decisions are formalized without unilateral approval in [`DECISION_REGISTER.md`](file:///i:/saymyname/docs/decisions/DECISION_REGISTER.md):
- `D-P35-01` (`Doc 06 OD-07`): Text character cap (`1,000` provisional vs `2,000` vs `4,000`).
- `D-P35-02` (`Doc 04 D04-12` / `OD-07`): Voice-note max upload size (`5 MB` provisional vs `2 MB` vs `10 MB`).
- `D-P35-03` (`Doc 04 §6` / `Doc 06 §15` `D04-11`): Voice-note & message lifecycle retention/deletion policy matrix across Active, Unmatch, Block, Reported Hold (`report_evidence_refs.retention_until`), and Account Deletion (no background physical purge job runs until approved).


---

## Security Boundary Verification Addendum (2026-11-26)

- Authoritative boundary reconciliation published in [`PHASE3_5_SECURITY_BOUNDARIES_AND_DEPENDENCIES.md`](file:///i:/saymyname/docs/implementation/PHASE3_5_SECURITY_BOUNDARIES_AND_DEPENDENCIES.md), clarifying `If-Range` omission under `no-store`, Next.js BFF `HEAD` `Content-Length: 0` behavior, stateless 15-minute access JWT boundary, irreversible already-flushed TCP/browser bytes, legacy `/calling/voice-notes/*` deprecation candidate, and Phase 4 `MATCH-22` LiveKit SFU eviction requirements.
