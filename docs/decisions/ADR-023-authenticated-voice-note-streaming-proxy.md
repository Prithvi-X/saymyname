# ADR-023: Authenticated Same-Origin Voice-Note Streaming Proxy (Option A)

- **Status:** Accepted for Phase 3.5.2 media access security hardening
- **Date:** 2026-11-26
- **Decision owner:** Security + Backend + Web Engineering (`Phase 3.5.2`)
- **Reviewers:** Application Security, Privacy & Architecture
- **Related tasks / documents:** Document 04 (§6, `MSG-19`, `D04-12`), Document 05 (§6.5, §9.2), Document 06 (`§6.7`, `messaging.message_media`), `ADR-018`, `ADR-021`

---

## Context

In the initial Phase 3.5 implementation, `MessagingService.toSanitizedMessageDto` and `GET /api/v1/messaging/media/:mediaId/url` generated 90-second pre-signed Cloudflare R2 / S3 URLs and returned them directly to the browser `<audio>` element. Even with a short 90-second TTL, direct R2 URLs leave two gaps:
1. Once issued, a pre-signed URL remains valid on the open internet until TTL expiry even if an unmatch, block, suspension, verification revocation, or logout happens 2 seconds later.
2. Direct cross-origin S3 URLs expose private object storage hostnames/parameters in network captures and memory and require permissive storage CORS for web playback.

---

## Decision Drivers

1. **Immediate Access Revocation on Connection Termination:** Unmatching, blocking, account suspension, verification revocation, or deletion MUST take effect immediately on every media fetch and `Range` seek without waiting up to 90 seconds.
2. **Zero Storage Credential / Signed-URL Exposure:** Browser JavaScript, DOM attributes, `<audio src>`, and message JSON DTOs MUST NEVER contain raw `s3Key`s or pre-signed R2/S3 URLs (`X-Amz-*`).
3. **Browser Session & Audio Seeking Compatibility (`ADR-018`):** Playback MUST authenticate cleanly via existing `HttpOnly` SameSite BFF session cookies without putting tokens in URLs, while supporting RFC 9110 HTTP `Range` (`206 Partial Content`, `416 Range Not Satisfiable`) and `HEAD` requests for smooth web `<audio>` timeline seeking.
4. **Anti-Enumeration & Anti-Caching:** Unauthorized or missing `mediaId` requests MUST NOT reveal existence via status/message differences, and media chunks MUST NOT be cached in shared or disk caches (`Cache-Control: private, no-store...`, `X-Content-Type-Options: nosniff`).

---

## Options Considered

1. **Option A (Selected): Authenticated Same-Origin Next.js BFF Streaming Proxy (`VoiceNotePlayer` -> `/api/bff/v1/messaging/media/:mediaId/stream` -> NestJS `/api/v1/messaging/media/:mediaId/stream` -> Private R2/S3).**
   - Preserves `HttpOnly` cookie security (`ADR-018`) without client tokens.
   - Enforces `JwtAuthGuard`, `EligibilityGuard`, and `MatchAuthorizationService` (`active` match, non-blocked, active verified accounts) on every `GET`, `HEAD`, and `Range` seek.
   - Subscribes active stream handlers to `RealtimeEventBusService` (`match_ended`, `account_revoked`) to abort in-flight S3 streams on revocation.
2. **Option B: Ultra-short pre-signed R2 URLs (10–15s) returned directly to browser.**
   - Rejected: leaves a revocation race window, exposes storage host/signed URLs in browser network/DOM, and breaks mid-playback seeking across 15s expiries.

---

## Decision

Adopt **Option A**:
1. **Sanitized API Payloads:** `MessagingService.toSanitizedMessageDto` and `GET /api/v1/messaging/media/:mediaId/url` emit `/api/bff/v1/messaging/media/${mediaId}/stream` (`accessMode: 'same_origin_proxy'`), never raw R2 signed URLs or `s3Key`s.
2. **NestJS Streaming Endpoint (`GET` / `HEAD /api/v1/messaging/media/:mediaId/stream`):**
   - Validates UUID syntax, resolves `MessageMedia`, enforces `MatchAuthorizationService.assertActiveMatchConversationMember`, and returns uniform `403 Forbidden ('Voice-note media is unavailable.')` for BOTH unauthorized and missing `mediaId`s (closing existence oracles).
   - Parses `Range` strictly via `parseHttpByteRange` (RFC 9110 single byte ranges only; multi-range or out-of-range fails closed with `416 Range Not Satisfiable` + `Content-Range: bytes */totalSize`).
   - Streams bytes from R2/S3 using `HeadObjectCommand` + `GetObjectCommand` (`AbortController`), setting `Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0`, `Pragma: no-cache`, `Expires: 0`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Resource-Policy: same-origin`, `Vary: Authorization`, and `Accept-Ranges: bytes`.
   - Subscribes to `RealtimeEventBusService` (`match_ended` / `account_revoked`) and request/response `close` events to destroy the upstream S3 stream immediately if revoked or disconnected mid-flight.
3. **Next.js BFF Streaming Pass-Through (`apps/web/lib/server-bff.ts` & `app/api/bff/v1/[...path]/route.ts`):**
   - Exports `HEAD` alongside `GET`/`POST`/`PUT`/`PATCH`/`DELETE`.
   - Forwards `Range`, `If-Range`, and `request.signal` abort signal cleanly; streams binary/`audio/*`/`206` responses directly (`new NextResponse(backendRes.body, ...)`) without JSON buffering while preserving cookie rotation/clearing semantics.
4. **`VoiceNotePlayer`:** Points `<audio>` directly at the same-origin proxy path, checks `HEAD` on playback error to map `401`/`403` cleanly (`onMediaAccessDenied`), stores nothing in `localStorage`/`sessionStorage`, and clears `audio.src` on unmount.

---

## Security Limits & Honest Disclaimers

- **Bytes already flushed:** Once audio chunks have left the server TCP socket and been decoded into browser memory or speakers before revocation, no HTTP server can unsend already-delivered bytes.
- **Stateless JWT access token window (`ADR-018`):** Browser logout clears `HttpOnly` cookies and revokes the DB refresh session (`POST /api/auth/logout`), immediately failing browser requests (`401`); an independently extracted `smn_access_token` JWT remains valid up to its short access TTL unless token-level introspection is later added.
- **Same-Origin Headless BFF Assumption:** Scaling BFF bandwidth requires streaming through the stateless Next.js tier; if mobile native clients (Phase 4/React Native) later stream audio directly, they call `/api/v1/messaging/media/:mediaId/stream` with `Authorization: Bearer <token>`.


---

## Audit Verification Addendum (2026-11-26)

- **HTTP `If-Range` & `HEAD` Clarifications (Verified Against Source):** Next.js BFF forwards incoming `Range` and `If-Range` headers (`server-bff.ts`), while `streamVoiceNoteMedia` (`messaging.service.ts`) enforces strict single-range `Range` (`206`/`416`) without `ETag`/`Last-Modified` or `If-Range` caching validation because all proxy responses carry `Cache-Control: private, no-store...`. Next.js 15 App Router BFF `HEAD` adapter emits `Content-Length: 0` on null-body responses while preserving `200`, `Accept-Ranges: bytes`, and `Content-Type: audio/*`; full `GET` (`200`) and Range `GET` (`206`) emit exact byte lengths.
- **Unused Legacy Helpers:** `MessagingService.signVoiceNoteUrl` remains defined cleanly unused after Option A cutover; legacy pre-3.5 `CallingController` voice-note routes (`POST /calling/voice-notes/*`) are unreferenced by Web Chats UI and tracked for Phase 4 removal.
