-- AlterTable
ALTER TABLE "identity"."account_eligibility" ADD COLUMN     "age_verified_at" TIMESTAMPTZ,
ADD COLUMN     "pathway_code" TEXT,
ADD COLUMN     "student_verified_at" TIMESTAMPTZ,
ADD COLUMN     "valid_until" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "identity"."accounts" ADD COLUMN     "email_verified_at" TIMESTAMPTZ,
ADD COLUMN     "password_hash" TEXT;

-- AlterTable
ALTER TABLE "identity"."app_sessions" ADD COLUMN     "last_seen_at" TIMESTAMPTZ,
ADD COLUMN     "rotated_from_session_id" UUID,
ADD COLUMN     "token_family_id" UUID;

-- AlterTable
ALTER TABLE "identity"."verification_cases" ADD COLUMN     "check_type" TEXT NOT NULL DEFAULT 'student_enrolment',
ADD COLUMN     "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "decided_at" TIMESTAMPTZ,
ADD COLUMN     "provider_code" TEXT NOT NULL DEFAULT 'manual_review',
ADD COLUMN     "provider_reference" TEXT,
ADD COLUMN     "reason_code" TEXT,
ADD COLUMN     "reviewer_principal_id" TEXT;

-- AlterTable
ALTER TABLE "identity"."verification_evidence_refs" ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "retention_until" TIMESTAMPTZ,
ADD COLUMN     "sha256" TEXT,
ADD COLUMN     "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "profiles"."profile_photos" ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "height_px" INTEGER,
ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "width_px" INTEGER,
ALTER COLUMN "photo_url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "profiles"."profiles" ADD COLUMN     "age_display_mode" TEXT NOT NULL DEFAULT 'show_calculated_age',
ADD COLUMN     "consent_accepted_at" TIMESTAMPTZ,
ADD COLUMN     "profile_status" TEXT NOT NULL DEFAULT 'draft',
ADD COLUMN     "published_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "identity"."otp_challenges" (
    "id" UUID NOT NULL,
    "account_id" UUID,
    "email" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'email_verification',
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "last_sent_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."password_reset_tokens" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "consumed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_challenges_email_purpose_created_at_idx" ON "identity"."otp_challenges"("email", "purpose", "created_at");

-- CreateIndex
CREATE INDEX "otp_challenges_expires_at_idx" ON "identity"."otp_challenges"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "identity"."password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_account_id_expires_at_idx" ON "identity"."password_reset_tokens"("account_id", "expires_at");

-- CreateIndex
CREATE INDEX "app_sessions_account_id_revoked_at_expires_at_idx" ON "identity"."app_sessions"("account_id", "revoked_at", "expires_at");

-- CreateIndex
CREATE INDEX "app_sessions_token_family_id_idx" ON "identity"."app_sessions"("token_family_id");

-- CreateIndex
CREATE INDEX "verification_cases_account_id_created_at_idx" ON "identity"."verification_cases"("account_id", "created_at");

-- AddForeignKey
ALTER TABLE "identity"."otp_challenges" ADD CONSTRAINT "otp_challenges_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "identity"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "identity"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Safe non-destructive backfill & constraints (Phase 2.0)
UPDATE "profiles"."profiles"
SET "profile_status" = CASE
  WHEN "is_paused" = true THEN 'paused'
  WHEN "is_published" = true THEN 'live'
  ELSE 'draft'
END
WHERE "profile_status" = 'draft';

UPDATE "identity"."accounts"
SET "email_verified_at" = "created_at"
WHERE "email_verified_at" IS NULL
  AND "account_status" <> 'registered';

CREATE UNIQUE INDEX IF NOT EXISTS "verification_cases_provider_ref_uq"
ON "identity"."verification_cases" ("provider_code", "provider_reference")
WHERE "provider_reference" IS NOT NULL;
