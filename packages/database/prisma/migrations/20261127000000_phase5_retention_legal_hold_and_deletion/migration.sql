-- Phase 5: DPDP Retention Windows, Account Deletion Grace & Legal Hold Protection
-- Additive, non-destructive schema evolution (existing rows retain safe defaults).

ALTER TABLE "messaging"."message_media"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "purged_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "message_media_deleted_idx"
  ON "messaging"."message_media" ("deleted_at", "created_at");

ALTER TABLE "safety"."reports"
  ADD COLUMN IF NOT EXISTS "legal_hold_until" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "reports_hold_idx"
  ON "safety"."reports" ("reported_id", "status", "legal_hold_until");

ALTER TABLE "safety"."report_evidence_refs"
  ADD COLUMN IF NOT EXISTS "retention_until" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "accounts_status_deleted_idx"
  ON "identity"."accounts" ("account_status", "deleted_at");

CREATE INDEX IF NOT EXISTS "matches_status_ended_idx"
  ON "dating"."matches" ("status", "ended_at");
