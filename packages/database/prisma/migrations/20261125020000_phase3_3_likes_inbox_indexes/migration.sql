-- Additive keyset pagination indexes for Phase 3.3 Likes Inbox & Outbox (Doc 06 §6.1)
CREATE INDEX IF NOT EXISTS "likes_received_inbox_idx"
ON "dating"."likes"("to_account_id", "status", "created_at" DESC, "id" DESC);

CREATE INDEX IF NOT EXISTS "likes_sent_outbox_idx"
ON "dating"."likes"("from_account_id", "status", "created_at" DESC, "id" DESC);
