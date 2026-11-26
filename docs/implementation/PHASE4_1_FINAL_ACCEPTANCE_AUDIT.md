# Phase 4.1 Final Acceptance Audit

**Date:** 2026-11-26  
**Branch:** `phase-4-1-calling-safety`  
**Audit Classification:** **PASS (Local Dev/Docker LiveKit & Local Postgres/Redis Verified; Staging/Production Deploy & LiveKit Cloud Credentials Remain Out of Scope)**

---

## 1. Security & Product Invariants Verified

1. **Eligibility & Mutual Match Gate:** Server verifies active verified 18+ eligibility, active mutual match, zero bidirectional block, and active conversation across invite, accept, decline/cancel/busy, state transition, `/token` (join & reconnect), and active call lookup (`MatchAuthorizationService`).
2. **Consent & Audio-Only Invariant:** `invite` returns no LiveKit token (`0` pre-acceptance room joins). Recipient UI shows explicit Accept/Decline controls without auto-accept or microphone activation. Tokens lock `canPublishSources: ['microphone']`, `canPublishData: false`, `canUpdateOwnMetadata: false`, `roomCreate: false`, `roomRecord: false`, `roomAdmin: false`, TTL `<= 300s`.
3. **Privacy Minimization:** LiveKit participant identities are HMAC-SHA256 pseudonyms (`smn_p_<24-hex>`) with `'Member'` label; zero raw `accountId`, email, roll number, or display names reach LiveKit. WebSocket signals (`call.invited`, `call.accepted`, `call.state_changed`, `call.ended`) omit join tokens, room IDs, and PII.
4. **LiveKit Server Configuration Requirement Recorded:** LiveKit E2E proved that if server-wide `room.auto_create: true` (`--dev` default), `DeleteRoom` wipes per-room revocation state and an unexpired token can reopen a deleted room despite `roomCreate: false`. Setting `room.auto_create: false` cleanly closes stale unexpired JWT replay across `DeleteRoom`. Documented as a mandatory production/LiveKit-Cloud prerequisite in [`ADR-024`](file:///i:/saymyname/docs/decisions/ADR-024-livekit-audio-calling-and-sfu-eviction.md).
5. **Legacy Surface Cleanup & Streaming Proxy:** Retired `/calling/voice-notes/presign`, `/calling/voice-notes/send`, and `MessagingService.signVoiceNoteUrl`; verified RFC 9110 `ETag` + `If-Range` + `HEAD`/`Range` `200`/`206`/`416` and mid-stream revocation abort.
6. **Governance Boundaries Preserved:** `D-P35-01`, `D-P35-02`, and `D-P35-03` remain strictly **`NEEDS HUMAN DECISION`** in [`DECISION_REGISTER.md`](file:///i:/saymyname/docs/decisions/DECISION_REGISTER.md).

---

## 2. Residual Operational Notes (Honest Scope)

- **Prisma DLL Lock on Windows Dev Server:** When an external local `dist/src/main.js` process holds `query_engine-windows.dll.node` open, `packages/database`'s `prisma generate` prebuild encounters `EPERM` rename until that process stops; direct TypeScript compilation (`tsc -p services/api/tsconfig.json`) against the already-generated Phase 4.1 Prisma Client succeeded cleanly.
- **Not Executed in Phase 4.1 (Out of Scope):** Live LiveKit Cloud project connection (`wss://*.livekit.cloud`), TURN/coturn relay traversal behind strict mobile carrier NAT, native Android/iOS client audio (`apps/mobile` remains Expo scaffold), and `scripts/test-phase3-2-closure-pg.mjs` (superseded on calling by `calling.test.ts` + `phase3-2-closure.test.ts` + `test-phase4-1-livekit-e2e.mjs`).
