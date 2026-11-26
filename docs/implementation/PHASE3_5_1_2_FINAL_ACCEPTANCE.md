# Phase 3.5.1 + Phase 3.5.2 Final Acceptance & Verification Summary

**Date:** 2026-11-26  
**Branch:** `phase-3-5-chats` (built atop `9e1a58dd38c173769f46390f06cd07be2859cc54`, uncommitted)  
**Verdict:** **PASS WITH OPEN GOVERNANCE DECISIONS (`D-P35-01`, `D-P35-02`, `D-P35-03` strictly `NEEDS HUMAN DECISION`)**

---

## 1. Summary of Upgrade from Prior Conditional Pass

Phase 3.5 moved from `CONDITIONAL PASS` to hardened closure readiness on engineering & security criteria:
1. **Phase 3.5.1 (Transactional Outbox Reliability):** Eliminated pre-marked `'processed'` outbox writes; implemented atomic `'pending'` TX writes + PostgreSQL `FOR UPDATE SKIP LOCKED` lease claiming + pre-publish authorization suppression + Redis reconnect recovery + exponential backoff + dead-letter operator CLI ([Report](file:///i:/saymyname/docs/implementation/PHASE3_5_1_OUTBOX_RELIABILITY_REPORT.md), [ADR-022](file:///i:/saymyname/docs/decisions/ADR-022-transactional-outbox-relay.md)).
2. **Phase 3.5.2 (Voice-Note Access Hardening & Policy Closure):** Replaced 90s direct R2 URLs with Option A authenticated same-origin Next.js BFF -> NestJS API streaming proxy supporting RFC 9110 `Range` (`200`/`206`/`416`), immediate revocation + mid-stream cancellation, zero R2 URL/`s3Key` exposure, and formalized `D-P35-01..03` as `NEEDS HUMAN DECISION` ([Report](file:///i:/saymyname/docs/implementation/PHASE3_5_2_MEDIA_SECURITY_AND_POLICY_CLOSURE.md), [ADR-023](file:///i:/saymyname/docs/decisions/ADR-023-authenticated-voice-note-streaming-proxy.md)).

## 2. Final Observed Verification Ledger

| Check | Outcome | Observed Result / Scope |
|---|---|---|
| Shared packages + API build (`npm run --workspace=@saymyname/api build`) | **PASS** | `tsc` exit 0 cleanly |
| API typecheck (`npm run --workspace=@saymyname/api typecheck`) | **PASS** | `tsc --noEmit` exit 0 |
| API unit & integration tests (`npm run --workspace=@saymyname/api test`) | **PASS** | **97/97** passed across **12** suites (incl. `PHASE351-OUTBOX-01` & `PHASE352-MEDIA-STREAM-01`) |
| Web typecheck (`npm run --workspace=@saymyname/web typecheck`) | **PASS** | `tsc --noEmit` exit 0 |
| Web unit tests (`node --test apps/web/test/*.test.ts`) | **PASS** | **18/18** passed across **4** suites |
| Web production build (`npm run --workspace=@saymyname/web build`) | **PASS** | All **31/31** Next.js routes compiled |
| Prisma schema & migrations (`validate`, `migrate status`, `migrate diff --exit-code`) | **PASS** | `7` migrations up to date on local PG (`saymyname_phase32_audit`, `saymyname_dev`); zero schema drift |
| Phase 3.5.1 Real PG/Redis Outbox E2E (`scripts/test-phase3-5-1-outbox-e2e.mjs`) | **PASS** | `FOR UPDATE SKIP LOCKED` multi-worker, live `docker stop/start saymyname-redis` outage recovery, lease expiry, CLI inspect/replay, unmatch suppression |
| Phase 3.5.2 Real BFF/API/S3 Streaming E2E (`scripts/test-phase3-5-2-media-e2e.mjs`) | **PASS** | 11/11 auth cases (`200`/`401`/`403`), `206`/`416` Range seeks, mid-stream unmatch abort, zero R2 URL/`s3Key` exposure |
| Phase 3.5 Real Chats & Edge UI E2E (`scripts/test-phase3-5-chats-e2e.mjs`) | **PASS** | `PHASE3_5_REAL_E2E_ALL_PASSED` |
| Phase 3.4 Matches Regression (`scripts/test-phase3-4-matches-e2e.mjs`) | **PASS** | `PHASE3_4_REAL_E2E_ALL_PASSED` |
| Phase 3.3 Likes Regression (`scripts/test-phase3-3-likes-e2e.mjs`) | **PASS** | `PHASE3_3_REAL_E2E_ALL_PASSED` |
| Phase 3.2 PG Closure Regression (`scripts/test-phase3-2-closure-pg.mjs`) | **PASS** | `ALL REAL POSTGRESQL CLOSURE INVARIANTS PASSED` |
| Phase 3.2 Discover Regression (`scripts/test-phase3-2-discover-e2e.mjs`) | **PASS** | `REAL_E2E_INTEGRATION_ALL_PASSED` |

## 3. Remaining Open Scope (Explicitly Deferred / Pending)

- **Human Policy Approvals:** `D-P35-01`, `D-P35-02`, and `D-P35-03` (`NEEDS HUMAN DECISION` in [`DECISION_REGISTER.md`](file:///i:/saymyname/docs/decisions/DECISION_REGISTER.md)).
- **`MATCH-22` LiveKit Room Eviction:** Remains `PARTIAL` (REST/WS/Media revocation complete; SFU media room kick belongs to Phase 4 Calling).
- **Deferred Doc 04/05 Features Preserved Disabled:** `D04-10` read receipts, online/last-seen/typing telemetry, self-delete timers, and Phase 5 physical retention purge workers.
