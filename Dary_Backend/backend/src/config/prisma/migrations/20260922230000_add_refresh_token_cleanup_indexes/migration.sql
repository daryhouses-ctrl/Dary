-- CreateIndex
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "refresh_tokens_is_revoked_created_at_idx" ON "refresh_tokens"("is_revoked", "created_at");
