-- Phase 3.5.1: Transactional Outbox Relay Leases, Backoff Scheduling & Error Tracking
-- Strictly additive migration preserving all existing outbox_events rows cleanly.

ALTER TABLE "platform"."outbox_events"
  ADD COLUMN IF NOT EXISTS "next_attempt_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS "locked_by" TEXT,
  ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "last_error_code" TEXT,
  ADD COLUMN IF NOT EXISTS "last_error_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "outbox_events_relay_poll_idx"
  ON "platform"."outbox_events"("status", "next_attempt_at", "created_at");

CREATE INDEX IF NOT EXISTS "outbox_events_lease_expiry_idx"
  ON "platform"."outbox_events"("status", "locked_until");
