-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "months_count" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "total_price" DECIMAL(10,2) NOT NULL DEFAULT 0;
