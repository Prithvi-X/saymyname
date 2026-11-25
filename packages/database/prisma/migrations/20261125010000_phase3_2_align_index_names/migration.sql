-- Align PostgreSQL index identifiers under 63-byte identifier limit cleanly with schema.prisma map names
DROP INDEX IF EXISTS "profiles"."profiles_profile_status_is_published_is_paused_programme_family";
DROP INDEX IF EXISTS "profiles"."profiles_profile_status_is_published_is_paused_programme_fa_idx";
DROP INDEX IF EXISTS "profiles"."profile_photos_profile_id_moderation_status_deleted_at_display_";
DROP INDEX IF EXISTS "profiles"."profile_photos_profile_id_moderation_status_deleted_at_disp_idx";

CREATE INDEX IF NOT EXISTS "profiles_discovery_status_idx"
ON "profiles"."profiles"("profile_status", "is_published", "is_paused", "programme_family");

CREATE INDEX IF NOT EXISTS "profile_photos_ready_idx"
ON "profiles"."profile_photos"("profile_id", "moderation_status", "deleted_at", "display_order");
