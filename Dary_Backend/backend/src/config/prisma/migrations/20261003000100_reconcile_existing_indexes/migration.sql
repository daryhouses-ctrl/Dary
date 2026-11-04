CREATE INDEX IF NOT EXISTS "reports_priority_created_at_idx"
ON "reports"("priority" DESC, "created_at" DESC);

CREATE INDEX IF NOT EXISTS "reports_reporter_id_created_at_idx"
ON "reports"("reporter_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "user_roles_user_id_idx"
ON "user_roles"("user_id");