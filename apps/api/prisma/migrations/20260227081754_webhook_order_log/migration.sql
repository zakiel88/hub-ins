/*
  Warnings:

  - A unique constraint covering the columns `[order_id,shopify_line_item_id]` on the table `order_line_items` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "shopify_stores" ADD COLUMN     "initial_sync_done" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "webhook_events" ADD COLUMN     "raw_payload" JSONB;

-- CreateTable
CREATE TABLE "order_logs" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "shopify_topic" VARCHAR(50),
    "changed_fields" JSONB NOT NULL,
    "raw_payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ol_order" ON "order_logs"("order_id");

-- CreateIndex
CREATE INDEX "idx_ol_created" ON "order_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_line_items_order_id_shopify_line_item_id_key" ON "order_line_items"("order_id", "shopify_line_item_id");

-- AddForeignKey
ALTER TABLE "order_logs" ADD CONSTRAINT "order_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
