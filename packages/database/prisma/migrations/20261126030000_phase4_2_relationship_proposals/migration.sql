-- Phase 4.2: Durable Relationship Mode proposal tracking (additive & backwards-compatible)
ALTER TABLE "together"."relationship_spaces"
  ADD COLUMN IF NOT EXISTS "proposal_status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "proposed_by_id" UUID,
  ADD COLUMN IF NOT EXISTS "proposed_at" TIMESTAMPTZ;
