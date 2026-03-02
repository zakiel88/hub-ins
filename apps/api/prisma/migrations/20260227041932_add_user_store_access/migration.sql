-- CreateTable
CREATE TABLE "user_store_access" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "shopify_store_id" UUID NOT NULL,
    "access_level" VARCHAR(20) NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_store_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_usa_user" ON "user_store_access"("user_id");

-- CreateIndex
CREATE INDEX "idx_usa_store" ON "user_store_access"("shopify_store_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_store_access_user_id_shopify_store_id_key" ON "user_store_access"("user_id", "shopify_store_id");

-- AddForeignKey
ALTER TABLE "user_store_access" ADD CONSTRAINT "user_store_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_store_access" ADD CONSTRAINT "user_store_access_shopify_store_id_fkey" FOREIGN KEY ("shopify_store_id") REFERENCES "shopify_stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
