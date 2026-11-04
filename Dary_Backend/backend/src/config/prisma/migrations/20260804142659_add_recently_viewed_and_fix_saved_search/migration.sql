/*
  Warnings:

  - You are about to drop the column `bills_included` on the `saved_searches` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "saved_searches" DROP COLUMN "bills_included",
ADD COLUMN     "electricity_included" BOOLEAN,
ADD COLUMN     "internet_included" BOOLEAN,
ADD COLUMN     "water_included" BOOLEAN;

-- CreateTable
CREATE TABLE "recently_viewed" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recently_viewed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recently_viewed_user_id_viewed_at_idx" ON "recently_viewed"("user_id", "viewed_at");

-- CreateIndex
CREATE UNIQUE INDEX "recently_viewed_user_id_property_id_key" ON "recently_viewed"("user_id", "property_id");

-- AddForeignKey
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
