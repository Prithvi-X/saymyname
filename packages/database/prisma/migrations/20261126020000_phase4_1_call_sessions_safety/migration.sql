ALTER TABLE "messaging"."call_sessions"
  ALTER COLUMN "call_status" SET DEFAULT 'inviting',
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "ended_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "ended_by_account_id" UUID,
  ADD COLUMN IF NOT EXISTS "eviction_status" TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS "evicted_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "eviction_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_eviction_error" TEXT,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "call_sessions_conv_status_idx"
  ON "messaging"."call_sessions"("conversation_id", "call_status");

CREATE INDEX IF NOT EXISTS "call_sessions_eviction_status_idx"
  ON "messaging"."call_sessions"("eviction_status");
