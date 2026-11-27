# Phase 5 Completion Report: DPDP Account Deletion, Safety Legal Holds, Retention Purge Worker & Production Hardening

**Date:** 2026-11-27  
**Branch:** `phase-5-retention-deletion-hardening` (branched from `phase-4-2-together-experience` @ `7dfdfe7`)  
**Decision Authority:** [`ADR-025`](file:///i:/saymyname/docs/decisions/ADR-025-dpdp-retention-account-deletion-and-legal-hold.md), [`DECISION_REGISTER.md`](file:///i:/saymyname/docs/decisions/DECISION_REGISTER.md) (`D-P35-02` & `D-P35-03` Approved 2026-11-27)

---

## 1. Scope Delivered

1. **Governance Decisions Formalized (`DECISION_REGISTER.md` & `ADR-025`):**
   - `D-P35-02` approved: **60s max duration & 5 MB default cap** on voice-note clips.
   - `D-P35-03` approved: **30d Unmatch quarantine -> purge, 90d Block quarantine -> purge, 30d Account Deletion grace -> hard purge, 180d Report/Legal Hold immunity**.
   - (`D-P35-01` text message length limit remains at its 1,000-char default pending separate product freeze.)

2. **Database Migration (`20261127000000_phase5_retention_legal_hold_and_deletion`):**
   - Added `deleted_at`, `purged_at` + index on `messaging.message_media`.
   - Added `legal_hold_until` + index on `safety.reports` and `retention_until`, `deleted_at` on `safety.report_evidence_refs`.
   - Added retention sweep indexes `accounts_status_deleted_idx` and `matches_status_ended_idx`.

3. **Step-Up Account Deletion & Legal-Hold Enforcement (`@saymyname/api`):**
   - Added `DELETE /api/v1/identity/me` ([IdentityController](file:///i:/saymyname/services/api/src/modules/identity/identity.controller.ts), [IdentityService.deleteAccount](file:///i:/saymyname/services/api/src/modules/identity/identity.service.ts), [DeleteAccountDto](file:///i:/saymyname/services/api/src/modules/identity/dto/identity.dto.ts)) requiring password confirmation (when configured) and exact `DELETE MY ACCOUNT` phrase, immediately revoking sessions, matches, calls, eligibility, discovery visibility, and scheduling 30-day permanent purge.
   - Updated [SafetyService.reportUser](file:///i:/saymyname/services/api/src/modules/safety/safety.service.ts) to stamp `legalHoldUntil = now + 180d` and create `ReportEvidenceRef` rows for referenced conversation/message media.

4. **Retention Purge Worker (`RetentionModule` / `RetentionPurgeService`):**
   - Created [RetentionPurgeService](file:///i:/saymyname/services/api/src/modules/retention/retention-purge.service.ts) registered in [AppModule](file:///i:/saymyname/services/api/src/app.module.ts).
   - Deletes private S3/R2 objects strictly outside PostgreSQL transactions (`DeleteObjectCommand`, skipping DB delete if object storage errors), honors 30d unmatch vs 90d block windows (accounting for real `Match.status = 'ended'` + `UserBlock`/`endReason`), enforces 30d deleted-account purge & PII anonymization, and defers legally held conversations/accounts (`skippedLegalHoldCount`).

5. **Production HTTP Security & Web BFF / Profile UI:**
   - Added [http-security.ts](file:///i:/saymyname/services/api/src/modules/platform/http-security.ts) and updated [main.ts](file:///i:/saymyname/services/api/src/main.ts) so production CORS fails closed on unknown origins and Swagger `/docs` is disabled by default in `NODE_ENV=production`.
   - Added [apps/web/app/api/bff/v1/identity/me/route.ts](file:///i:/saymyname/apps/web/app/api/bff/v1/identity/me/route.ts) (clears `HttpOnly` auth cookies on `DELETE` success), `api.deleteAccount` in [api.ts](file:///i:/saymyname/apps/web/lib/api.ts), Profile Delete Account flow in [profile/page.tsx](file:///i:/saymyname/apps/web/app/(app)/profile/page.tsx), and closed-account banner in [login/page.tsx](file:///i:/saymyname/apps/web/app/login/page.tsx).

---

## 2. Verified Checks

- `npx --workspace=@saymyname/database prisma migrate status` (`saymyname_dev` @ `localhost:5433`): **PASS** (`10 migrations`, up to date).
- `npx --workspace=@saymyname/api tsc` & `tsc --noEmit`: **PASS** (`0` errors).
- `npm run --workspace=@saymyname/api test`: **PASS** (`110/110` across `15` suites, including `retention-deletion.test.ts` and new CORS/Swagger production tests in `security-prod.test.ts`).
- `npm run --workspace=@saymyname/web build` + `tsc --noEmit` + `apps/web/test/*.test.ts`: **PASS** (`32/32` routes, `21/21` web unit tests).
- `node scripts/test-phase5-retention-e2e.mjs`: **PASS** (Browser Delete Account UI -> cookie wipe -> `401 /api/auth/me`, 30d unheld conversation & S3 purge, 30d unheld account hard-purge & PII anonymization, 180d legally held report media & message preservation) + screenshots inspected (`01_desktop_1440_delete_modal.png`, `02_desktop_1440_deleted_login_banner.png`).
