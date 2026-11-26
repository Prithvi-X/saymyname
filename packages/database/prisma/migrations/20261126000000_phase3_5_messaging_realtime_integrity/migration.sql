-- Phase 3.5: Additive Messaging, Realtime Cursors, Voice-Note Integrity & Safety Report Context
-- Strictly additive migration preserving all existing Phase 1-3.4 rows cleanly.

ALTER TABLE "messaging"."conversation_members"
  ADD COLUMN IF NOT EXISTS "last_read_seq" BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "last_delivered_seq" BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "conversation_members_account_idx"
  ON "messaging"."conversation_members"("account_id");

CREATE UNIQUE INDEX IF NOT EXISTS "messages_conv_seq_key"
  ON "messaging"."messages"("conversation_id", "sequence_no");

CREATE INDEX IF NOT EXISTS "messages_conv_seq_desc_idx"
  ON "messaging"."messages"("conversation_id", "sequence_no" DESC);

CREATE INDEX IF NOT EXISTS "messages_unread_count_idx"
  ON "messaging"."messages"("conversation_id", "sender_account_id", "sequence_no");

ALTER TABLE "messaging"."message_media"
  ADD COLUMN IF NOT EXISTS "sha256" TEXT,
  ADD COLUMN IF NOT EXISTS "processing_status" TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS "uploader_account_id" UUID;

ALTER TABLE "safety"."reports"
  ADD COLUMN IF NOT EXISTS "conversation_id" UUID,
  ADD COLUMN IF NOT EXISTS "message_id" UUID;

CREATE INDEX IF NOT EXISTS "reports_conversation_idx"
  ON "safety"."reports"("conversation_id");

CREATE INDEX IF NOT EXISTS "outbox_events_status_created_idx"
  ON "platform"."outbox_events"("status", "created_at");
