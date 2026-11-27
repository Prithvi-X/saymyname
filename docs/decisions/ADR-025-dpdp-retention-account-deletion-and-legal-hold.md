# ADR-025: DPDP Data Retention, Account Deletion Grace Window & Safety Legal-Hold Immunity (Phase 5)

- **Status:** Accepted (Human Decision Approved 2026-11-27 for `D-P35-02` and `D-P35-03`)
- **Date:** 2026-11-27
- **Governs:** `IdentityService.deleteAccount`, `SafetyService.reportUser`, `RetentionPurgeService`, `services/api/src/main.ts`

## Context
Documents 04 §6 and 06 §15 require immediate access revocation on unmatch, block, or account deletion while ensuring Indian DPDP Act data minimization AND preserving corroborating safety evidence under moderation hold (`safety.reports` / `safety.report_evidence_refs`). Prior to Phase 5, `D-P35-02` and `D-P35-03` held retention purge workers disabled awaiting human approval, and members lacked a self-service `DELETE /api/v1/identity/me` workflow.

## Approved Policy Matrix (2026-11-27)
1. **Voice-Note Limits (`D-P35-02`):** Maximum clip duration locked at **60 seconds** (`Doc 02 §4.3`), default maximum payload locked at **5 MB** (`5 * 1024 * 1024` bytes) across verified WebM/Opus, Ogg/Opus, MP4/AAC, MP3, WAV, and AAC streams.
2. **Unmatch Quarantine (`30 days`):** Immediate `403` access block on all messages, calls, and voice notes; automated retention purge permanently removes unheld conversation `MessageMedia` S3/R2 objects and `Message` rows 30 days after `Match.endedAt`.
3. **Block Quarantine (`90 days`):** Immediate `403` access block; automated retention purge permanently removes unheld conversation `MessageMedia` S3/R2 objects and `Message` rows 90 days after `Match.endedAt` while preserving `UserBlock` enforcement records.
4. **Account Deletion (`30 days` grace window):**
   - Immediate action (`DELETE /api/v1/identity/me` with step-up confirmation): revokes all sessions, ends active matches/conversations/calls/Together spaces, emits `account_revoked` & `match_ended` (evicting active SFU calls & media streams), sets `accountStatus = 'disabled'`, `deletedAt = now`, and pauses discovery/eligibility.
   - Post-grace hard purge (`deletedAt <= now - 30 days`): deletes R2 portrait/media objects (outside DB transactions), purges auth/profile rows, and irreversibly anonymizes `identity.accounts` PII (`deleted+<id>@redacted.invalid`, `displayName: 'Deleted Member'`, null password/phone) with `accountStatus = 'deleted'`.
5. **Safety Report Legal Hold Immunity (`180 days` minimum):**
   - Any `Report` automatically stamps `legalHoldUntil = now + 180 days` and creates pinned `ReportEvidenceRef` rows for referenced conversation voice-note media.
   - Active/pending reports or unexpired `legalHoldUntil > now` **block physical deletion** of referenced conversation messages/media and defer hard account purge for involved safety evidence until hold expiry.

## Consequences & Boundaries
- S3/R2 `DeleteObjectCommand` network I/O NEVER runs inside an open PostgreSQL transaction (`saymyname-database-change` Rule 7).
- Production CORS in `services/api/src/main.ts` fails closed for unknown origins and suppresses Swagger `/docs` unless `ENABLE_SWAGGER_DOCS=true`.
- Automated worker loops honor `DISABLE_RETENTION_WORKER=true` for isolated unit tests and zero-PII audit logs.
