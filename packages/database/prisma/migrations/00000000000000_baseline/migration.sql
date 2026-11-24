-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "dating";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "identity";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "messaging";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "platform";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "profiles";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "safety";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "together";

-- CreateTable
CREATE TABLE "identity"."accounts" (
    "id" UUID NOT NULL,
    "auth_subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone_number" TEXT,
    "account_status" TEXT NOT NULL DEFAULT 'registered',
    "display_name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."account_eligibility" (
    "account_id" UUID NOT NULL,
    "age_status" TEXT NOT NULL DEFAULT 'not_started',
    "student_status" TEXT NOT NULL DEFAULT 'not_started',
    "programme_family" TEXT,
    "discovery_eligible" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ,
    "verified_by" TEXT,
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "account_eligibility_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "identity"."verification_cases" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMPTZ,
    "reviewer_id" TEXT,
    "rejection_reason" TEXT,

    CONSTRAINT "verification_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."verification_evidence_refs" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_evidence_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity"."app_sessions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_id" TEXT,
    "user_agent" TEXT,
    "ip_hash" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles"."profiles" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "display_name" TEXT NOT NULL,
    "bio" TEXT,
    "programme_family" TEXT NOT NULL,
    "term_or_year" TEXT,
    "location_city" TEXT,
    "location_state" TEXT,
    "intention" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles"."profile_photos" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "photo_url" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "moderation_status" TEXT NOT NULL DEFAULT 'approved',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profile_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles"."interests" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "icon" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles"."profile_interests" (
    "profile_id" UUID NOT NULL,
    "interest_id" UUID NOT NULL,

    CONSTRAINT "profile_interests_pkey" PRIMARY KEY ("profile_id","interest_id")
);

-- CreateTable
CREATE TABLE "profiles"."profile_prompts" (
    "id" UUID NOT NULL,
    "prompt_text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "profile_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles"."profile_prompt_answers" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "prompt_id" UUID NOT NULL,
    "answer_text" TEXT NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "profile_prompt_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles"."preference_settings" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "min_age" INTEGER NOT NULL DEFAULT 18,
    "max_age" INTEGER NOT NULL DEFAULT 35,
    "allowed_programmes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "max_distance_km" INTEGER,
    "show_in_discovery" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "preference_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dating"."likes" (
    "id" UUID NOT NULL,
    "from_account_id" UUID NOT NULL,
    "to_account_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dating"."passes" (
    "id" UUID NOT NULL,
    "from_account_id" UUID NOT NULL,
    "to_account_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dating"."matches" (
    "id" UUID NOT NULL,
    "user_low_id" UUID NOT NULL,
    "user_high_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,
    "ended_by_account_id" UUID,
    "end_reason" TEXT,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dating"."match_state_events" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "previous_state" TEXT NOT NULL,
    "new_state" TEXT NOT NULL,
    "actor_id" UUID NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_state_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging"."conversations" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_message_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging"."conversation_members" (
    "conversation_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "last_read_message_id" UUID,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("conversation_id","account_id")
);

-- CreateTable
CREATE TABLE "messaging"."messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sequence_no" BIGINT NOT NULL,
    "sender_account_id" UUID NOT NULL,
    "client_assigned_uuid" UUID,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "body_text" TEXT,
    "media_ref_id" UUID,
    "delivery_state" TEXT NOT NULL DEFAULT 'sent',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ,
    "read_at" TIMESTAMPTZ,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging"."message_media" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "media_type" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "s3_key" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging"."call_sessions" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "caller_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "call_status" TEXT NOT NULL DEFAULT 'initiated',
    "livekit_room_id" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "duration_seconds" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "together"."game_catalog" (
    "id" UUID NOT NULL,
    "game_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "min_players" INTEGER NOT NULL DEFAULT 2,
    "max_players" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "together"."game_sessions" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "game_id" UUID NOT NULL,
    "session_status" TEXT NOT NULL DEFAULT 'invited',
    "current_state" JSONB,
    "winner_account_id" UUID,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "together"."game_session_members" (
    "session_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'player',
    "score" INTEGER NOT NULL DEFAULT 0,
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_session_members_pkey" PRIMARY KEY ("session_id","account_id")
);

-- CreateTable
CREATE TABLE "together"."virtual_dates" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "proposed_by_id" UUID NOT NULL,
    "scheduled_for" TIMESTAMPTZ NOT NULL,
    "timezone" TEXT NOT NULL,
    "activity_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "proposal_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "virtual_dates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "together"."relationship_spaces" (
    "id" UUID NOT NULL,
    "match_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "activated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disbanded_at" TIMESTAMPTZ,
    "disbanded_by_id" UUID,

    CONSTRAINT "relationship_spaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "together"."relationship_milestones" (
    "id" UUID NOT NULL,
    "space_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "milestone_date" DATE NOT NULL,
    "description" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationship_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "together"."relationship_journals" (
    "id" UUID NOT NULL,
    "space_id" UUID NOT NULL,
    "entry_text" TEXT NOT NULL,
    "entry_date" DATE NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "relationship_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety"."user_blocks" (
    "id" UUID NOT NULL,
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety"."reports" (
    "id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reported_id" UUID NOT NULL,
    "report_category" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,
    "resolved_by_id" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety"."report_evidence_refs" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "s3_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_evidence_refs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safety"."moderation_actions" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "action_type" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."user_devices" (
    "id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "device_token" TEXT NOT NULL,
    "device_os" TEXT NOT NULL,
    "app_version" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."notification_preferences" (
    "account_id" UUID NOT NULL,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sound_enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "platform"."outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."idempotency_records" (
    "id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "account_id" UUID NOT NULL,
    "request_hash" TEXT NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform"."audit_events" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" UUID,
    "metadata" JSONB,
    "ip_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_auth_subject_key" ON "identity"."accounts"("auth_subject");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "identity"."accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_sessions_refresh_token_hash_key" ON "identity"."app_sessions"("refresh_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_account_id_key" ON "profiles"."profiles"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "interests_name_key" ON "profiles"."interests"("name");

-- CreateIndex
CREATE UNIQUE INDEX "preference_settings_profile_id_key" ON "profiles"."preference_settings"("profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "likes_from_account_id_to_account_id_key" ON "dating"."likes"("from_account_id", "to_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "passes_from_account_id_to_account_id_key" ON "dating"."passes"("from_account_id", "to_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_user_low_id_user_high_id_key" ON "dating"."matches"("user_low_id", "user_high_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_match_id_key" ON "messaging"."conversations"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "messages_client_assigned_uuid_key" ON "messaging"."messages"("client_assigned_uuid");

-- CreateIndex
CREATE UNIQUE INDEX "message_media_message_id_key" ON "messaging"."message_media"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_catalog_game_key_key" ON "together"."game_catalog"("game_key");

-- CreateIndex
CREATE UNIQUE INDEX "relationship_spaces_match_id_key" ON "together"."relationship_spaces"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_blocks_blocker_id_blocked_id_key" ON "safety"."user_blocks"("blocker_id", "blocked_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_idempotency_key_key" ON "platform"."idempotency_records"("idempotency_key");

-- AddForeignKey
ALTER TABLE "identity"."account_eligibility" ADD CONSTRAINT "account_eligibility_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "identity"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."verification_cases" ADD CONSTRAINT "verification_cases_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "identity"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."verification_evidence_refs" ADD CONSTRAINT "verification_evidence_refs_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "identity"."verification_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity"."app_sessions" ADD CONSTRAINT "app_sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "identity"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles"."profiles" ADD CONSTRAINT "profiles_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "identity"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles"."profile_photos" ADD CONSTRAINT "profile_photos_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles"."profile_interests" ADD CONSTRAINT "profile_interests_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles"."profile_interests" ADD CONSTRAINT "profile_interests_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "profiles"."interests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles"."profile_prompt_answers" ADD CONSTRAINT "profile_prompt_answers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles"."profile_prompt_answers" ADD CONSTRAINT "profile_prompt_answers_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "profiles"."profile_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles"."preference_settings" ADD CONSTRAINT "preference_settings_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"."profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dating"."match_state_events" ADD CONSTRAINT "match_state_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "dating"."matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging"."conversations" ADD CONSTRAINT "conversations_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "dating"."matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging"."conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "messaging"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging"."messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "messaging"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging"."message_media" ADD CONSTRAINT "message_media_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messaging"."messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messaging"."call_sessions" ADD CONSTRAINT "call_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "messaging"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "together"."game_sessions" ADD CONSTRAINT "game_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "messaging"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "together"."game_sessions" ADD CONSTRAINT "game_sessions_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "together"."game_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "together"."game_session_members" ADD CONSTRAINT "game_session_members_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "together"."game_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "together"."virtual_dates" ADD CONSTRAINT "virtual_dates_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "messaging"."conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "together"."relationship_spaces" ADD CONSTRAINT "relationship_spaces_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "dating"."matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "together"."relationship_milestones" ADD CONSTRAINT "relationship_milestones_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "together"."relationship_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "together"."relationship_journals" ADD CONSTRAINT "relationship_journals_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "together"."relationship_spaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety"."report_evidence_refs" ADD CONSTRAINT "report_evidence_refs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "safety"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."user_devices" ADD CONSTRAINT "user_devices_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "identity"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform"."notification_preferences" ADD CONSTRAINT "notification_preferences_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "identity"."accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

