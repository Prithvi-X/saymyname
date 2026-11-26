# Phase 3.5 — Security Boundaries, Residual Risks & Phase 4 Dependencies

**Project:** SayMyName.in  
**Scope Covered:** Phase 3.5 (Chats & Messaging), Phase 3.5.1 (Transactional Outbox), Phase 3.5.2 (Voice-Note Streaming Hardening & Policy Closure)  
**Branch:** `phase-3-5-chats` (HEAD `9e1a58dd38c173769f46390f06cd07be2859cc54` + uncommitted review tree)  
**Review Date:** 2026-11-26  
**Authoritative References:** [ADR-018](file:///i:/saymyname/docs/decisions/ADR-018-auth-password-otp-and-bff-sessions.md), [ADR-021](file:///i:/saymyname/docs/decisions/ADR-021-realtime-messaging-websocket-architecture.md), [ADR-022](file:///i:/saymyname/docs/decisions/ADR-022-transactional-outbox-relay.md), [ADR-023](file:///i:/saymyname/docs/decisions/ADR-023-authenticated-voice-note-streaming-proxy.md), [DECISION_REGISTER.md](file:///i:/saymyname/docs/decisions/DECISION_REGISTER.md)

---

## 1. Executive Summary

This document establishes the independently verified security boundaries and open architectural dependencies of the SayMyName Phase 3.5–3.5.2 messaging subsystem prior to human commit/merge acceptance:

1. **Voice-Note Delivery Upgrade (`Historical Limitation Resolved`):** Earlier Phase 3.5 issued direct 90-second pre-signed S3/R2 GET URLs to browsers. Source verification confirms Phase 3.5.2 replaced that path with an **Option A authenticated same-origin Next.js BFF -> NestJS streaming proxy** (`/api/bff/v1/messaging/media/:mediaId/stream` -> `/api/v1/messaging/media/:mediaId/stream`) enforcing `MatchAuthorizationService` on every GET, HEAD, and `Range` request, with active S3 stream abortion on live revocation.
2. **Irreversible Client-Byte Boundary:** Once encrypted TLS audio chunks leave the server socket and are buffered or decoded inside the browser's `<audio>` pipeline, no server revocation mechanism can retract or un-deliver those already-transmitted bytes.
3. **Access JWT TTL Boundary:** Normal browser logout (`POST /api/auth/logout`) clears `HttpOnly` auth cookies and revokes the database `AppSession` refresh token (`401` immediately). Because [JwtAuthGuard](file:///i:/saymyname/services/api/src/modules/identity/guards/jwt-auth.guard.ts) verifies HMAC signatures statelessly (`expiresInSeconds = 900`, 15 minutes), an independently stolen raw `smn_access_token` JWT remains valid for HTTP Bearer calls until expiry unless downstream DB checks deny access (account/match state).
4. **`MATCH-22` LiveKit SFU Gap (`PARTIAL` — Deferred to Phase 4):** While database rows, REST calling endpoints, WebSocket chat subscriptions, and voice-note streams revoke immediately on Unmatch, Block, Suspension, Deletion, and Verification Revocation, active LiveKit WebRTC media-room participant eviction (`RoomServiceClient`) is not yet integrated.
5. **Legacy Surface Discovery:** Pre-3.5 endpoints `POST /api/v1/calling/voice-notes/presign` and `POST /api/v1/calling/voice-notes/send` in [calling.controller.ts](file:///i:/saymyname/services/api/src/modules/calling/calling.controller.ts) remain mounted from Phase 4 prototype code (unused by Chats UI, flagged for Phase 4 retirement).

---

## 2. Historical 90-Second Presigned URL Architecture (Superseded)

In the initial Phase 3.5 implementation (documented historically in [ADR-021](file:///i:/saymyname/docs/decisions/ADR-021-realtime-messaging-websocket-architecture.md)), `MessagingService.toSanitizedMessageDto` and `GET /api/v1/messaging/media/:mediaId/url` called `signVoiceNoteUrl(media.s3Key, 90)` and returned a direct Cloudflare R2 / S3 pre-signed URL to `VoiceNotePlayer.tsx`.

- **Why issued originally:** To avoid proxying binary audio bytes through the web server while allowing HTML `<audio>` elements to fetch private R2 objects directly via S3 query-string signatures (`X-Amz-Signature`).
- **Security limitation:** A signed URL acts as a bearer capability. While Unmatch, Block, or Suspension immediately prevented *new* calls to `/url` (`403`), any previously issued signed URL remained valid directly against R2/S3 for the remainder of its <=90-second TTL, could not be aborted mid-seek at the storage provider, and exposed object-storage host/key query structures in browser network state.

**Chronology Confirmation:** Independent inspection confirms this 90-second pre-signed browser GET mechanism is **no longer active** for messaging voice-note playback and was replaced by Phase 3.5.2 Option A. (Profile photos under [ADR-020](file:///i:/saymyname/docs/decisions/ADR-020-profile-onboarding-draft-and-private-r2-media.md) intentionally retain `<=300s` presigned GETs; see §17 for the unrelated legacy `CallingController` surface.)

---

## 3. Current Phase 3.5.2 Same-Origin Proxy Architecture

```text
VoiceNotePlayer.tsx (<audio preload="none"> / HEAD probe on error)
       |  Same-origin HttpOnly cookie session
       v
Next.js App Router BFF (/api/bff/v1/messaging/media/:mediaId/stream)
  [apps/web/app/api/bff/v1/[...path]/route.ts -> lib/server-bff.ts]
  - Exports GET & HEAD; checks smn_access_token / smn_refresh_token cookies
  - Forwards Range, If-Range, and AbortSignal (request.signal)
  - Streams binary/audio/206 responses directly (no full-file JSON buffering)
  - Enforces private, no-store, nosniff, Vary: Cookie, same-origin CORP
       |  Authorization: Bearer <accessToken>
       v
NestJS API Media Endpoint (GET / HEAD /api/v1/messaging/media/:mediaId/stream)
  [services/api/src/modules/messaging/messaging.controller.ts -> messaging.service.ts]
  - JwtAuthGuard + EligibilityGuard + ParseUUIDPipe
  - Uniform 403 ('Voice-note media is unavailable.') anti-oracle on missing/unauthorized
       |
       v
MatchAuthorizationService.assertActiveMatchConversationMember(accountId, convId)
  - Checks Account (active, not deleted), AccountEligibility (age+student approved, discoveryEligible),
    ConversationMember, Match (active), Conversation (active), no bidirectional UserBlock
       |
       v
Private S3/R2 Storage (HeadObjectCommand + GetObjectCommand with AbortController)
  - R2 credentials & s3Key remain strictly server-side; zero X-Amz URLs emitted
  - Single-range RFC 9110 parser (200 / 206 Partial Content / 416 Range Not Satisfiable)
       |
       v
Authorized Chunked Audio Stream (destroyed on req/res close or live revocation event)
```

---

## 4. Source Verification Across Every Layer

| Layer | Audited Source Reality | Verified Controls & Discrepancies Noted |
|---|---|---|
| **Browser (`VoiceNotePlayer.tsx`, `api.ts`, WS)** | Streams directly from `/api/bff/v1/messaging/media/${encodeURIComponent(mediaId)}/stream`. `toSanitizedMessageDto` and `GET /messaging/media/:mediaId/url` emit `/api/bff/v1/messaging/media/<id>/stream`. | Zero `X-Amz-*` URLs, zero `s3Key`s, zero `localStorage`/`sessionStorage` URL caching; `<audio>` pauses & clears `src` on unmount; `RealtimeTicket` & WS frames omit media URLs and `s3Key`s. *(Note: unused helper `signVoiceNoteUrl` remains defined in `messaging.service.ts:139`.)* |
| **Next.js BFF (`server-bff.ts`, `route.ts`)** | `route.ts` exports `GET`, `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`. `forwardAuthenticatedRequest` reads `HttpOnly` cookies, rotates tokens via `/identity/refresh` on `401` if refresh cookie valid, forwards `Range` & `If-Range`, and passes `signal: request.signal`. | Streams `backendRes.body` directly on `206`, `416`, `HEAD`, `audio/*`, and `application/octet-stream` without `.text()` buffering. Forces `Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy: same-origin`, `Vary: Cookie`. Zero signed URLs or `s3Key`s logged. |
| **NestJS API (`messaging.controller.ts`, `messaging.service.ts`)** | `@Get('media/:mediaId/stream')` & `@Head('media/:mediaId/stream')` behind `@UseGuards(JwtAuthGuard, EligibilityGuard)` + `ParseUUIDPipe`. | Enforces `assertActiveMatchConversationMember` on initial `GET`, `HEAD`, and every `Range` seek. Missing `mediaId`, outsider, unmatched, blocked, suspended, deleted, and eligibility-revoked accounts all receive identical `403` `'Voice-note media is unavailable.'` (eliminating UUID existence oracles). |
| **HTTP Range & Headers** | `parseHttpByteRange` validates `bytes=start-end`, `bytes=start-`, `bytes=-suffix`; rejects multi-range (`bytes=0-1, 2-3`) & out-of-bounds (`416` + `Content-Range: bytes */totalSize`). | Forward/backward seeks (`206`), full `GET` (`200`), and `416` verified. **Discrepancy noted against `server-bff.ts`/`ADR-023`:** BFF forwards `If-Range`, whereas `streamVoiceNoteMedia` omits `ETag`/`Last-Modified` and ignores `If-Range` because `no-store` forbids caching (each seek receives fresh `206`). Also, Next.js 15 App Router sets `Content-Length: 0` on null-body BFF `HEAD` responses while preserving `200`, `Accept-Ranges: bytes`, and `Content-Type: audio/*`. |
| **Private Storage** | `HeadObjectCommand` + `GetObjectCommand` via server-side `R2_ENDPOINT`/`R2_ACCOUNT_ID` & IAM keys. | Raw storage keys never leave `MessagingService`; R2 bucket accepts zero unauthenticated public playback. |

---

## 5. Active Stream Cancellation & What Cannot Be Revoked

### 5.1 Active Stream Cancellation Event Path Verification

- **Cross-Instance Transport:** [RealtimeEventBusService](file:///i:/saymyname/services/api/src/modules/realtime/realtime-event-bus.service.ts) publishes `match_ended` and `account_revoked` via Redis Pub/Sub channel `smn:realtime:events:v1` AND `localEmitter`, reaching all NestJS instances.
- **Trigger Audit:**
  - **Unmatch** (`DatingService.unmatch`) -> post-commit `publishMatchEnded(..., 'connection_ended')`. **(Live mid-stream slow-drip cancellation + post-unmatch Range `403` verified in E2E.)**
  - **Block** (`SafetyService.blockUser`) -> post-commit `publishMatchEnded(..., 'connection_unavailable')`. **(Verified by source inspection + post-block `403` E2E; shares exact `RealtimeEventBusService` subscriber handler.)**
  - **Suspension / Disable / Delete** (`IdentityService.suspendOrRestrictAccount`) -> post-commit `publishMatchEnded` + `publishAccountRevoked`. **(Verified by source inspection + post-suspension/deletion `403` E2E; shares exact subscriber handler.)**
  - **Verification Revocation** (`VerificationService.submitReviewDecision` when `!canDiscover`) -> post-commit `publishMatchEnded` + `publishAccountRevoked`. **(Verified by source inspection + post-revocation `403` E2E; shares exact subscriber handler.)**
- **Stream Teardown:** `streamVoiceNoteMedia` wires `AbortController` (`GetObjectCommand({ ..., abortSignal })`), `s3BodyStream.destroy()`, `res.end()`, `req.on('close')`, and `res.on('close')`.

### 5.2 Distinction of Revocation Boundaries (No Overclaiming)

| Capability | Enforced? | Honest Technical Boundary |
|---|---|---|
| **1. Deny new playback requests** | **YES (`403`)** | Blocked immediately across REST/BFF for all 5 invalidation triggers. |
| **2. Deny subsequent HTTP `Range` seeks** | **YES (`403`)** | Every byte-range seek re-runs `MatchAuthorizationService` against PostgreSQL. |
| **3. Abort active server stream** | **YES** | Active S3/R2 `GetObjectCommand` & response socket tear down when revocation event arrives or client disconnects. |
| **4. Revoke bytes already written to TCP** | **NO** | Bytes already transmitted into kernel socket buffers or over TLS cannot be pulled back. |
| **5. Revoke bytes already buffered/decoded in browser** | **NO** | Audio already buffered in browser RAM / HTML5 media pipeline remains playable locally in memory until tab navigation/player unmount (`no-store` prevents shared/disk HTTP caching by policy, though browser memory playback of fetched frames cannot be remotely wiped). |

---

## 6. Access JWT & Session Expiration Boundary (`ADR-018`)

- **Verified Configuration:** [IdentityService](file:///i:/saymyname/services/api/src/modules/identity/identity.service.ts#L715-L750) and [CryptoService](file:///i:/saymyname/services/api/src/modules/identity/security/crypto.service.ts#L93-L107) issue stateless HS256 access JWTs with `expiresInSeconds = 900` (**15 minutes**) alongside opaque refresh tokens hashed in `identity.app_sessions` (`7 days` expiry, rotation family tracking).
- **Verified Guard Behavior:** [JwtAuthGuard](file:///i:/saymyname/services/api/src/modules/identity/guards/jwt-auth.guard.ts) validates JWT HMAC signature and `exp` statelessly without querying `AppSession` on every API request.
- **Browser Logout vs. Stolen Bearer JWT:**
  - *Normal Browser Logout (`POST /api/auth/logout`):* Revokes the `AppSession` row in PostgreSQL (`revokedAt = now`) and sends `Set-Cookie` clearing `smn_access_token` and `smn_refresh_token` (`Max-Age=0`). All subsequent browser BFF requests fail immediately with **`401`**, and `/api/auth/refresh` fails with **`401`**.
  - *Separately Exfiltrated Access JWT:* If an attacker extracted the raw `smn_access_token` cookie value prior to logout, that Bearer JWT remains cryptographically accepted by `JwtAuthGuard` for up to its remaining <=15-minute window. (Downstream `MatchAuthorizationService` still blocks access `403` immediately if the underlying match was ended or account suspended/deleted/eligibility-revoked.) Adding Redis token-JTI denylists or short introspection remains an explicit future enhancement outside Phase 3.5 scope.

---

## 7. `MATCH-22` & External LiveKit SFU Eviction Boundary (Deferred to Phase 4)

### 7.1 What IS Enforced Today (Verified)

1. **PostgreSQL State Invalidation ([MatchAuthorizationService.closeMatchDownstreamState](file:///i:/saymyname/services/api/src/modules/safety/match-authorization.service.ts#L407-L610)):** Unmatch, Block, Account Suspension/Disable/Deletion, and Verification Revocation atomically transition:
   - `dating.matches.status = 'ended'` (plus `MatchStateEvent`)
   - `messaging.conversations.status = 'closed'`
   - `messaging.call_sessions` (`initiated`/`ringing`/`accepted`/`active` -> `'ended'`, setting `endedAt`)
   - `together.game_sessions` (`invited`/`active` -> `'ended'`) and `together.virtual_dates` (`proposed`/`accepted` -> `'cancelled'`)
   - `together.relationship_spaces` (`isActive = false`)
2. **REST Calling Endpoints ([CallingService](file:///i:/saymyname/services/api/src/modules/calling/calling.service.ts)):** `inviteCall`, `respondToCall` (`accept`/`decline`), and `getCallSession` all invoke `matchAuth.assertAuthorizedForConversation`, rejecting new call invites/accepts with `403` once ended/blocked/suspended.
3. **WebSocket Gateway:** Chat WebSocket rooms immediately receive `conversation.closed` / `access.revoked` (`4403`) and evict subscriptions.

### 7.2 What Is Missing (`LiveKit SFU Eviction Gap`)

- Inspection of [CallingService](file:///i:/saymyname/services/api/src/modules/calling/calling.service.ts) and [services/api/package.json](file:///i:/saymyname/services/api/package.json) confirms **`livekit-server-sdk` (`RoomServiceClient`) is NOT installed or integrated**:
  - `CallingService.generateLivekitJwt` (lines 401–439) signs HS256 LiveKit room tokens with **`exp = now + 3600` (1 hour)**.
  - No service calls LiveKit `removeParticipant(roomName, identity)` or `deleteRoom(roomName)`.
  - There is zero automatic LiveKit room teardown listener subscribed to `match_ended` or `account_revoked`.
  - Additionally, `CallingService.endCall` (line 330) checks caller/receiver ownership without invoking `matchAuth`, leaving external LiveKit SFU termination entirely unimplemented.

### 7.3 Practical Current Risk Until Phase 4

Because LiveKit SFU tokens carry a 3,600-second expiry and LiveKit Cloud operates externally from PostgreSQL and SayMyName's messaging WebSocket gateway, **two users already connected inside an active LiveKit WebRTC audio room remain able to continue their live audio call until someone hangs up or the token/room ends**, even if Unmatch, Block, Suspension, or Verification Revocation closes the database `CallSession`, denies new calling REST routes, and disconnects the chat WebSocket.

### 7.4 Implementation-Ready Phase 4 Dependency Specification (`MATCH-22`)

1. **Event Detection:** Subscribe a dedicated Phase 4 `CallingRevocationListener` (in `CallingModule`) to `RealtimeEventBusService` (`match_ended`, `account_revoked`) AND inspect all `CallSession` rows in `accepted`/`active`/`ringing` status closed inside `closeMatchDownstreamState`.
2. **Identify Affected Room & Participants:** Resolve `callSession.livekitRoomId`, `callerId`, and `receiverId` directly from PostgreSQL (`messaging.call_sessions`), never from client-supplied payloads.
3. **Invoke Approved LiveKit Server SDK:** Add `livekit-server-sdk` (approved Phase 4 provider) and configure `RoomServiceClient` with server-only `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`.
4. **Evict & Terminate Room:** Execute `roomService.removeParticipant(livekitRoomId, participantIdentity)` and/or `roomService.deleteRoom(livekitRoomId)` for 1:1 privacy closure (`account_revoked` -> remove affected account across active rooms; `match_ended` -> `deleteRoom`).
5. **Idempotent Already-Ended Handling:** Treat LiveKit `404 Not Found` (room/participant already gone) as idempotent success without failing the domain transaction.
6. **Outbox Retry & Provider Failure Handling:** Dispatch SFU eviction via a durable Phase 4 outbox/retry path with bounded backoff so transient LiveKit Cloud API timeouts recover cleanly; emit explicit failure audit events + alert logs (`no secret leakage`) if eviction exhausts retries.
7. **Multi-Instance Safety:** Use PostgreSQL claim/outbox deduplication or leader-safe execution so concurrent Redis subscribers across instances do not loop redundantly.
8. **Prevent Reconnect:** Combine short LiveKit join-token TTL (e.g., `120–300s` for initial room join) with `CallSession.callStatus = 'ended'` checks so evicted participants cannot re-enter with cached join tokens.
9. **Safe Audit Trail:** Record sanitized `platform.audit_events` (`match_id`, `call_session_id`, `eviction_reason`, `outcome`) without PII or tokens.
10. **Mandatory Phase 4 Test Matrix:** Real integration tests covering all 4 triggers (**Unmatch**, **Block**, **Account Suspension/Deletion**, **Verification Revocation**), plus **LiveKit API unreachable/5xx retry** and **idempotent room-already-ended** against a LiveKit test server/mock HTTP SFU endpoint.

---

## 8. Security Findings Summary (Review Observation)

| Severity | Component & Location | Verified Finding | Disposition in Review |
|---|---|---|---|
| **Medium** (Legacy Surface) | [calling.controller.ts](file:///i:/saymyname/services/api/src/modules/calling/calling.controller.ts#L23-L33) & [calling.service.ts](file:///i:/saymyname/services/api/src/modules/calling/calling.service.ts#L88-L170) | Pre-Phase-3.5 prototype routes `POST /api/v1/calling/voice-notes/presign` & `/send` remain mounted without `ffprobe` validation or Option A proxy streaming (`media.saymyname.in`-style placeholder URL). Unused by Chats UI (`/messaging/conversations/:id/voice-notes/*`). | Documented for Phase 4 removal/hardening (unchanged per Part 2.2 review-only rule). |
| **Low / Residual** | [calling.service.ts](file:///i:/saymyname/services/api/src/modules/calling/calling.service.ts#L401-L439) | `MATCH-22`: External LiveKit SFU `RoomServiceClient` participant eviction/room deletion unimplemented (`PARTIAL`). | Explicitly deferred & specified for Phase 4 (§7.4). |
| **Low / Residual** | [jwt-auth.guard.ts](file:///i:/saymyname/services/api/src/modules/identity/guards/jwt-auth.guard.ts) | Stateless 15-minute access JWT (`expiresInSeconds = 900`) remains accepted on direct Bearer calls until expiry if stolen outside cookie jar; browser BFF logout revokes cookies + refresh token immediately. | Documented accurately (§6); auth redesign deferred per Part 3.5. |
| **Low / Residual** | [messaging.service.ts](file:///i:/saymyname/services/api/src/modules/messaging/messaging.service.ts#L1500-L1690) & [server-bff.ts](file:///i:/saymyname/apps/web/lib/server-bff.ts) | Bytes flushed prior to revocation cannot be recalled; `If-Range` ignored (`no-store`); Next BFF `HEAD` emits `Content-Length: 0`; unused helper `signVoiceNoteUrl` remains in `MessagingService`. | Documented accurately (§4–§5). |

---

## 9. Final Security & Acceptance Matrix (`Part 9`)

| Requirement / Boundary | Current Implementation | Verified Evidence | Status | Remaining Action |
|---|---|---|---|---|
| **Historical 90s signed URL issue** | Direct R2 signed URLs in `toSanitizedMessageDto` & `/media/:id/url` removed from playback flow | `messaging.service.ts`, `test-phase3-5-2-media-e2e.mjs` (`signedUrlExposedToBrowser: false`) | **HISTORICAL LIMITATION RESOLVED** | Retire dead `signVoiceNoteUrl` helper cleanly in Phase 4 maintenance |
| **Same-origin proxy replacement** | Option A (`/api/bff/v1/messaging/media/:id/stream` -> `/api/v1/messaging/media/:id/stream`) | `server-bff.ts`, `VoiceNotePlayer.tsx`, `test-phase3-5-2-media-e2e.mjs` | **VERIFIED** | None for Phase 3.5 Web |
| **Browser signed URL exposure** | Browser & DTOs receive `/api/bff/v1/messaging/media/<id>/stream` only | `toSanitizedMessageDto`, `test-phase3-5-messaging.test.ts`, `test-phase3-5-2-media-e2e.mjs` | **VERIFIED** | Deprecate legacy `/calling/voice-notes/*` in Phase 4 |
| **Raw storage key exposure** | `s3Key` never returned in chats DTOs, WS frames, or media responses | `test-phase3-5-chats-e2e.mjs`, `test-phase3-5-2-media-e2e.mjs` | **VERIFIED** | Retire legacy `/calling/voice-notes/presign` returning `s3Key` in Phase 4 |
| **Authorization on full GET** | `JwtAuthGuard` + `EligibilityGuard` + `MatchAuthorizationService` + uniform `403` | `test-phase3-5-messaging.test.ts` + `test-phase3-5-2-media-e2e.mjs` (`200`/`401`/`403`) | **VERIFIED** | None |
| **Authorization on HEAD** | `@Head('media/:mediaId/stream')` + BFF `HEAD` handler (`401`/`403`/`200` + `Accept-Ranges`) | `route.ts`, `test-phase3-5-2-media-e2e.mjs` *(Next adapter sets `CL: 0` on null body)* | **VERIFIED** | None required for audio probing; note `CL: 0` behavior |
| **Authorization on Range requests** | `parseHttpByteRange` + per-Range `assertActiveMatchConversationMember` (`206`/`416`/`403`) | `PHASE352-MEDIA-STREAM-01` + `test-phase3-5-2-media-e2e.mjs` (seek fwd/back/out-of-range/post-unmatch) | **VERIFIED** | Add `If-Range` handling only if caching is ever permitted (not desired under `no-store`) |
| **Active stream cancellation** | `RealtimeEventBusService` (`match_ended`/`account_revoked`) aborts `GetObjectCommand` & destroys stream | Source audit across `Dating`, `Safety`, `Identity`, `Verification`; live unmatch slow-drip E2E (`PASS`) | **VERIFIED** | Add dedicated slow-drip E2E for Block/Suspend mid-stream if desired in Phase 4 |
| **Already-delivered byte limitation** | Browser-received / decoded TCP chunks cannot be remotely wiped | Documented in `ADR-023` & §5.2 (`no-store` prevents disk/proxy caching) | **VERIFIED** | Inherent HTTP transport boundary (document accurately) |
| **Relevant JWT expiration limitation** | Stateless 15m (`900s`) access JWT accepted by `JwtAuthGuard` until expiry if stolen | `crypto.service.ts:93`, `identity.service.ts:715`, `jwt-auth.guard.ts`; BFF logout `401` verified | **VERIFIED** | Optional Redis JTI denylist in future security pass |
| **Match authorization** | Centralized `MatchAuthorizationService` (`FOR SHARE` lock + full PG checks) | `phase3-5-messaging.test.ts`, `test-phase3-2-closure-pg.mjs` | **VERIFIED** | None |
| **Unmatch** | Ends Match, closes Conv/Calls/Games/Dates, emits `match_ended`, keeps `0` `UserBlock`s | `dating.service.ts`, `test-phase3-4-matches-e2e.mjs`, `test-phase3-5-chats-e2e.mjs` | **VERIFIED** | LiveKit SFU eviction tracked in `MATCH-22` |
| **Block** | Bidirectional `UserBlock`, closes Match/Conv, emits `match_ended`, blocks discover/media | `safety.service.ts`, `test-phase3-2-closure-pg.mjs`, `test-phase3-5-2-media-e2e.mjs` | **VERIFIED** | LiveKit SFU eviction tracked in `MATCH-22` |
| **Account suspension** | Disables eligibility, revokes sessions, closes matches, emits `match_ended`+`account_revoked`, media `403` | `identity.service.ts:798`, `test-phase3-2-closure-pg.mjs`, `test-phase3-5-2-media-e2e.mjs` | **VERIFIED** | LiveKit SFU eviction tracked in `MATCH-22` |
| **Verification revocation** | Recalculates `canDiscover`, invalidates matches, emits `match_ended`+`account_revoked`, media `403` | `verification.service.ts:699`, `test-phase3-2-closure-pg.mjs`, `test-phase3-5-2-media-e2e.mjs` | **VERIFIED** | LiveKit SFU eviction tracked in `MATCH-22`; reconcile `main` commit `3e13859` |
| **LiveKit SFU participant eviction** | Not implemented (`livekit-server-sdk` / `RoomServiceClient` absent; `3600s` room tokens) | `calling.service.ts`, `services/api/package.json` | **DEFERRED TO PHASE 4** | Implement §7.4 `RoomServiceClient` eviction & tests in Phase 4 (`MATCH-22` remains `PARTIAL`) |
| **Outbox reliability** | Atomic `'pending'` TX rows, `FOR UPDATE SKIP LOCKED`, leases, backoff, suppression, `outbox-ops.mjs` | `PHASE351-OUTBOX-01` (10 scenarios) + `test-phase3-5-1-outbox-e2e.mjs` (live PG/Redis restart) | **VERIFIED** | None |
| **Pending product decisions** | `D-P35-01` (text len), `D-P35-02` (voice cap), `D-P35-03` (retention matrix) | `DECISION_REGISTER.md` (strictly `NEEDS HUMAN DECISION`, zero purge workers enabled) | **NEEDS HUMAN DECISION** | Owner + Legal/Safety sign-off before public launch |
| **Migration integrity** | Additive SQL (`20261126000000` & `20261126010000`), zero drops/rewrites, `migrate diff` clean | `prisma validate`, `migrate status`, `migrate diff --exit-code` (`saymyname_phase32_audit` & `saymyname_dev`) | **VERIFIED** | Apply migrations carefully in staging promotion per runbook |
| **Git diff hygiene** | `28` modified, `30` untracked, `0` staged, `0` deleted, `0` `.env*` modified, secret scan clean | `git status`, `git diff --check`, secret scan | **VERIFIED** | Resolve `main` `3e13859` divergence cleanly when merging |
