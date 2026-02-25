-- AlterTable
ALTER TABLE "shopify_stores" ADD COLUMN     "client_id_enc" TEXT,
ADD COLUMN     "client_id_iv" TEXT,
ADD COLUMN     "client_secret_enc" TEXT,
ADD COLUMN     "client_secret_iv" TEXT;
