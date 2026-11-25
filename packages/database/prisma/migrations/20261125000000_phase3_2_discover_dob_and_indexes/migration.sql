-- Phase 3.2 Discover & Profile Discovery additive migration
-- 1. Persist server-verified date_of_birth on identity.account_eligibility for authoritative server-side age calculation & reciprocal discovery filtering (never exposed in public DTOs).
ALTER TABLE "identity"."account_eligibility"
ADD COLUMN IF NOT EXISTS "date_of_birth" DATE;

-- 2. Discovery feed & eligibility query indexes
CREATE INDEX IF NOT EXISTS "profiles_profile_status_is_published_is_paused_programme_family_idx"
ON "profiles"."profiles"("profile_status", "is_published", "is_paused", "programme_family");

CREATE INDEX IF NOT EXISTS "profile_photos_profile_id_moderation_status_deleted_at_display_order_idx"
ON "profiles"."profile_photos"("profile_id", "moderation_status", "deleted_at", "display_order");

CREATE INDEX IF NOT EXISTS "likes_from_account_id_status_idx"
ON "dating"."likes"("from_account_id", "status");

CREATE INDEX IF NOT EXISTS "likes_to_account_id_status_idx"
ON "dating"."likes"("to_account_id", "status");

CREATE INDEX IF NOT EXISTS "passes_from_account_id_expires_at_idx"
ON "dating"."passes"("from_account_id", "expires_at");

CREATE INDEX IF NOT EXISTS "user_blocks_blocked_id_blocker_id_idx"
ON "safety"."user_blocks"("blocked_id", "blocker_id");
