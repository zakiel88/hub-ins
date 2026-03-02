-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "tracking_company" VARCHAR(100),
ADD COLUMN     "tracking_number" VARCHAR(255),
ADD COLUMN     "tracking_url" TEXT;
