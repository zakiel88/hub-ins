-- AlterTable
ALTER TABLE "order_line_items" ADD COLUMN     "item_state" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "mapping_status" VARCHAR(20) NOT NULL DEFAULT 'UNMAPPED',
ADD COLUMN     "shopify_variant_id" BIGINT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customer_name" VARCHAR(255),
ADD COLUMN     "customer_phone" VARCHAR(50),
ADD COLUMN     "flags" JSONB DEFAULT '{}',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "pipeline_state" VARCHAR(40) NOT NULL DEFAULT 'NEW_FROM_SHOPIFY',
ADD COLUMN     "shipping_address" JSONB,
ADD COLUMN     "shipping_city" VARCHAR(100),
ADD COLUMN     "shipping_country" VARCHAR(10),
ADD COLUMN     "shopify_raw_payload" JSONB;

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "order_id" UUID NOT NULL,
    "assignee_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "priority" VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    "due_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_reservations" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "colorway_id" UUID,
    "sku" VARCHAR(100) NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "qty_reserved" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inventory_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_requests" (
    "id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "qty_needed" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "procurement_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" UUID NOT NULL,
    "po_number" VARCHAR(50) NOT NULL,
    "brand_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "issued_at" TIMESTAMPTZ,
    "notes" TEXT,
    "total_amount" DECIMAL(12,2),
    "currency" VARCHAR(3),
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" UUID NOT NULL,
    "po_id" UUID NOT NULL,
    "pr_id" UUID,
    "sku" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255),
    "qty" INTEGER NOT NULL,
    "unit_cost" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_tasks_order" ON "tasks"("order_id");

-- CreateIndex
CREATE INDEX "idx_tasks_type" ON "tasks"("type");

-- CreateIndex
CREATE INDEX "idx_tasks_status" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "idx_tasks_assignee" ON "tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "idx_tc_task" ON "task_comments"("task_id");

-- CreateIndex
CREATE INDEX "idx_ir_order_item" ON "inventory_reservations"("order_item_id");

-- CreateIndex
CREATE INDEX "idx_ir_warehouse" ON "inventory_reservations"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_pr_order_item" ON "procurement_requests"("order_item_id");

-- CreateIndex
CREATE INDEX "idx_pr_brand" ON "procurement_requests"("brand_id");

-- CreateIndex
CREATE INDEX "idx_pr_status" ON "procurement_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_number_key" ON "purchase_orders"("po_number");

-- CreateIndex
CREATE INDEX "idx_po_brand" ON "purchase_orders"("brand_id");

-- CreateIndex
CREATE INDEX "idx_po_status" ON "purchase_orders"("status");

-- CreateIndex
CREATE INDEX "idx_poi_po" ON "purchase_order_items"("po_id");

-- CreateIndex
CREATE INDEX "idx_poi_pr" ON "purchase_order_items"("pr_id");

-- CreateIndex
CREATE INDEX "idx_oli_item_state" ON "order_line_items"("item_state");

-- CreateIndex
CREATE INDEX "idx_orders_pipeline_state" ON "orders"("pipeline_state");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_colorway_id_fkey" FOREIGN KEY ("colorway_id") REFERENCES "colorways"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_pr_id_fkey" FOREIGN KEY ("pr_id") REFERENCES "procurement_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
