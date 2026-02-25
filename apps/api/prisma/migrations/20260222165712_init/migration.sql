-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_stores" (
    "id" UUID NOT NULL,
    "store_name" VARCHAR(255) NOT NULL,
    "shopify_domain" VARCHAR(255) NOT NULL,
    "market" VARCHAR(20),
    "access_token_enc" TEXT NOT NULL,
    "token_iv" TEXT NOT NULL,
    "scopes" TEXT,
    "token_last_rotated_at" TIMESTAMPTZ,
    "api_version" VARCHAR(20) NOT NULL DEFAULT '2025-01',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMPTZ,
    "webhook_secret" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shopify_stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "brand_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "logo_url" TEXT,
    "owner_user_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "website" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "terms" TEXT,
    "file_url" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_contacts" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "role" VARCHAR(100),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "brand_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "season" VARCHAR(50),
    "year" INTEGER,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "sku_prefix" VARCHAR(100),
    "category" VARCHAR(100),
    "material" VARCHAR(100),
    "description" TEXT,
    "wholesale_price" DECIMAL(10,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colorways" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "color" VARCHAR(100) NOT NULL,
    "size" VARCHAR(50) NOT NULL,
    "barcode" VARCHAR(50),
    "weight_grams" INTEGER,
    "images" JSONB DEFAULT '[]',
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "colorways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_prices" (
    "id" UUID NOT NULL,
    "colorway_id" UUID NOT NULL,
    "market" VARCHAR(20) NOT NULL,
    "retail_price" DECIMAL(10,2) NOT NULL,
    "compare_price" DECIMAL(10,2),
    "currency" VARCHAR(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_product_mappings" (
    "id" UUID NOT NULL,
    "colorway_id" UUID,
    "shopify_store_id" UUID NOT NULL,
    "shopify_product_id" BIGINT NOT NULL,
    "shopify_variant_id" BIGINT NOT NULL,
    "shopify_inventory_id" BIGINT,
    "shopify_sku" VARCHAR(100),
    "shopify_title" VARCHAR(255),
    "mapping_status" VARCHAR(20) NOT NULL DEFAULT 'unmatched',
    "matched_by" VARCHAR(20),
    "matched_at" TIMESTAMPTZ,
    "last_synced_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shopify_product_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "shopify_store_id" UUID NOT NULL,
    "shopify_order_id" BIGINT NOT NULL,
    "order_number" VARCHAR(50) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "financial_status" VARCHAR(30),
    "fulfillment_status" VARCHAR(30),
    "customer_email" VARCHAR(255),
    "total_price" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "order_date" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_line_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "colorway_id" UUID,
    "brand_id" UUID,
    "shopify_line_item_id" BIGINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "sku" VARCHAR(100),
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "colorway_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
    "quantity_reserved" INTEGER NOT NULL DEFAULT 0,
    "last_sync_source_store_id" UUID,
    "last_synced_at" TIMESTAMPTZ,
    "sync_status" VARCHAR(20) NOT NULL DEFAULT 'synced',
    "last_counted_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "brand_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_url" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'uploaded',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ,
    "review_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" UUID NOT NULL,
    "import_batch_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "raw_data" JSONB NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "errors" JSONB DEFAULT '[]',
    "product_id" UUID,
    "colorway_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_publish_logs" (
    "id" UUID NOT NULL,
    "publish_job_id" UUID NOT NULL,
    "market_price_id" UUID NOT NULL,
    "shopify_store_id" UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "request_payload" JSONB,
    "response_payload" JSONB,
    "error_message" TEXT,
    "published_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_publish_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" UUID NOT NULL,
    "shopify_store_id" UUID NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "sync_type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'running',
    "total_records" INTEGER,
    "synced_records" INTEGER,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "shopify_store_id" UUID NOT NULL,
    "shopify_webhook_id" VARCHAR(100) NOT NULL,
    "topic" VARCHAR(100) NOT NULL,
    "shopify_entity_id" BIGINT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'received',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload_hash" VARCHAR(64),
    "error_message" TEXT,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "changes" JSONB,
    "ip_address" VARCHAR(45),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_stores_shopify_domain_key" ON "shopify_stores"("shopify_domain");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE INDEX "idx_users_brand" ON "users"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_code_key" ON "brands"("code");

-- CreateIndex
CREATE INDEX "idx_brands_status" ON "brands"("status");

-- CreateIndex
CREATE INDEX "idx_brands_owner" ON "brands"("owner_user_id");

-- CreateIndex
CREATE INDEX "idx_contracts_brand" ON "contracts"("brand_id");

-- CreateIndex
CREATE INDEX "idx_bc_brand" ON "brand_contacts"("brand_id");

-- CreateIndex
CREATE INDEX "idx_collections_brand" ON "collections"("brand_id");

-- CreateIndex
CREATE INDEX "idx_products_collection" ON "products"("collection_id");

-- CreateIndex
CREATE INDEX "idx_products_status" ON "products"("status");

-- CreateIndex
CREATE UNIQUE INDEX "colorways_sku_key" ON "colorways"("sku");

-- CreateIndex
CREATE INDEX "idx_colorways_product" ON "colorways"("product_id");

-- CreateIndex
CREATE INDEX "idx_colorways_barcode" ON "colorways"("barcode");

-- CreateIndex
CREATE INDEX "idx_mp_status" ON "market_prices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "market_prices_colorway_id_market_key" ON "market_prices"("colorway_id", "market");

-- CreateIndex
CREATE INDEX "idx_spm_colorway" ON "shopify_product_mappings"("colorway_id");

-- CreateIndex
CREATE INDEX "idx_spm_store" ON "shopify_product_mappings"("shopify_store_id");

-- CreateIndex
CREATE INDEX "idx_spm_status" ON "shopify_product_mappings"("mapping_status");

-- CreateIndex
CREATE INDEX "idx_spm_shopify_sku" ON "shopify_product_mappings"("shopify_sku");

-- CreateIndex
CREATE UNIQUE INDEX "shopify_product_mappings_shopify_store_id_shopify_variant_i_key" ON "shopify_product_mappings"("shopify_store_id", "shopify_variant_id");

-- CreateIndex
CREATE INDEX "idx_orders_status" ON "orders"("status");

-- CreateIndex
CREATE INDEX "idx_orders_date" ON "orders"("order_date");

-- CreateIndex
CREATE UNIQUE INDEX "orders_shopify_store_id_shopify_order_id_key" ON "orders"("shopify_store_id", "shopify_order_id");

-- CreateIndex
CREATE INDEX "idx_oli_order" ON "order_line_items"("order_id");

-- CreateIndex
CREATE INDEX "idx_oli_colorway" ON "order_line_items"("colorway_id");

-- CreateIndex
CREATE INDEX "idx_oli_brand" ON "order_line_items"("brand_id");

-- CreateIndex
CREATE INDEX "idx_inv_colorway" ON "inventory_items"("colorway_id");

-- CreateIndex
CREATE INDEX "idx_inv_warehouse" ON "inventory_items"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_inv_sync_status" ON "inventory_items"("sync_status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_colorway_id_warehouse_id_key" ON "inventory_items"("colorway_id", "warehouse_id");

-- CreateIndex
CREATE INDEX "idx_ib_brand" ON "import_batches"("brand_id");

-- CreateIndex
CREATE INDEX "idx_ib_status" ON "import_batches"("status");

-- CreateIndex
CREATE INDEX "idx_ir_batch" ON "import_rows"("import_batch_id");

-- CreateIndex
CREATE INDEX "idx_ppl_job" ON "price_publish_logs"("publish_job_id");

-- CreateIndex
CREATE INDEX "idx_ppl_mp" ON "price_publish_logs"("market_price_id");

-- CreateIndex
CREATE INDEX "idx_ppl_store" ON "price_publish_logs"("shopify_store_id");

-- CreateIndex
CREATE INDEX "idx_sl_store" ON "sync_logs"("shopify_store_id");

-- CreateIndex
CREATE INDEX "idx_sl_status" ON "sync_logs"("status");

-- CreateIndex
CREATE INDEX "idx_we_store_topic" ON "webhook_events"("shopify_store_id", "topic");

-- CreateIndex
CREATE INDEX "idx_we_status" ON "webhook_events"("status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_shopify_store_id_shopify_webhook_id_key" ON "webhook_events"("shopify_store_id", "shopify_webhook_id");

-- CreateIndex
CREATE INDEX "idx_al_user" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "idx_al_entity" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_al_created" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_contacts" ADD CONSTRAINT "brand_contacts_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colorways" ADD CONSTRAINT "colorways_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_colorway_id_fkey" FOREIGN KEY ("colorway_id") REFERENCES "colorways"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_prices" ADD CONSTRAINT "market_prices_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_product_mappings" ADD CONSTRAINT "shopify_product_mappings_colorway_id_fkey" FOREIGN KEY ("colorway_id") REFERENCES "colorways"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopify_product_mappings" ADD CONSTRAINT "shopify_product_mappings_shopify_store_id_fkey" FOREIGN KEY ("shopify_store_id") REFERENCES "shopify_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shopify_store_id_fkey" FOREIGN KEY ("shopify_store_id") REFERENCES "shopify_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_colorway_id_fkey" FOREIGN KEY ("colorway_id") REFERENCES "colorways"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_line_items" ADD CONSTRAINT "order_line_items_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_colorway_id_fkey" FOREIGN KEY ("colorway_id") REFERENCES "colorways"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_last_sync_source_store_id_fkey" FOREIGN KEY ("last_sync_source_store_id") REFERENCES "shopify_stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_publish_logs" ADD CONSTRAINT "price_publish_logs_market_price_id_fkey" FOREIGN KEY ("market_price_id") REFERENCES "market_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_publish_logs" ADD CONSTRAINT "price_publish_logs_shopify_store_id_fkey" FOREIGN KEY ("shopify_store_id") REFERENCES "shopify_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_publish_logs" ADD CONSTRAINT "price_publish_logs_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_shopify_store_id_fkey" FOREIGN KEY ("shopify_store_id") REFERENCES "shopify_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_shopify_store_id_fkey" FOREIGN KEY ("shopify_store_id") REFERENCES "shopify_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
