-- Add Lark order fields to orders table
-- Financial details
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "total_line_items_price" DECIMAL(10,2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "total_shipping_price" DECIMAL(10,2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "total_discounts" DECIMAL(10,2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "total_tip" DECIMAL(10,2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "total_weight" DECIMAL(10,2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "total_quantity" INTEGER;

-- Billing address
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "billing_address" JSONB;

-- Discount details
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_codes" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_value" DECIMAL(10,2);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_value_type" VARCHAR(30);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_target_type" VARCHAR(30);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_description" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discount_title" VARCHAR(100);

-- Shipping method
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_method_code" VARCHAR(50);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipping_method_source" VARCHAR(100);

-- Payment & shipment
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_gateway" VARCHAR(100);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shipment_status" VARCHAR(30);
