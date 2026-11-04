-- DropIndex
DROP INDEX "properties_city_trgm_idx";

-- DropIndex
DROP INDEX "properties_district_trgm_idx";

-- DropIndex
DROP INDEX "properties_title_trgm_idx";

-- DropIndex
DROP INDEX "reports_priority_created_at_idx";

-- DropIndex
DROP INDEX "reports_reporter_id_created_at_idx";

-- DropIndex
DROP INDEX "user_roles_user_id_idx";

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
