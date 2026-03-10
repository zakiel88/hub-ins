// Force-load .env BEFORE anything else — system env may have production DATABASE_URL
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), override: true });

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { validateConfig } from './config/configuration';

async function bootstrap() {
    // Fail-fast: validate env before anything else
    const config = validateConfig();

    const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

    // Use pino as the NestJS logger
    app.useLogger(app.get(Logger));

    // CORS — use CORS_ORIGIN env var in production, localhost in dev
    const allowedOrigins: string[] = [];
    if (config.CORS_ORIGIN) {
        allowedOrigins.push(...config.CORS_ORIGIN.split(',').map((o) => o.trim()));
    }
    // Always allow production domains
    const productionOrigins = ['https://hub.inecso.com', 'https://api.inecso.com'];
    for (const o of productionOrigins) {
        if (!allowedOrigins.includes(o)) allowedOrigins.push(o);
    }
    if (config.NODE_ENV === 'development') {
        allowedOrigins.push('http://localhost:3000', `http://localhost:${config.API_PORT}`);
    }
    console.log('🔒 CORS allowed origins:', allowedOrigins);
    app.enableCors({
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, curl, server-to-server)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            console.warn(`⚠️ CORS blocked origin: ${origin}`);
            return callback(null, false);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    });

    // Trust proxy (for Railway / load balancer)
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.set('trust proxy', 1);

    // ── Startup: clean up zombie jobs (stuck in 'running' from previous deploy) ──
    try {
        const { JobsService } = await import('./jobs/jobs.service');
        const jobsService = app.get(JobsService);
        await jobsService.cleanupZombieJobs();
    } catch (err: any) {
        console.warn('⚠️ Zombie cleanup skipped:', err.message);
    }

    // ── Startup: ensure all tables exist (prisma db push doesn't always sync on Railway) ──
    try {
        const { PrismaService } = await import('./prisma/prisma.service');
        const prisma = app.get(PrismaService);

        const migrations = [
            // ── Enums (idempotent DO $$ block) ──
            `DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductStatus') THEN
                    CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VariantStatus') THEN
                    CREATE TYPE "VariantStatus" AS ENUM ('ACTIVE', 'DRAFT', 'DISCONTINUED');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiscountType') THEN
                    CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SyncAction') THEN
                    CREATE TYPE "SyncAction" AS ENUM ('CREATED', 'UPDATED', 'SKIPPED', 'FAILED');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IssueSeverity') THEN
                    CREATE TYPE "IssueSeverity" AS ENUM ('ERROR', 'WARNING', 'INFO');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IssueStatus') THEN
                    CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED');
                END IF;
            END $$`,

            // ── Products table — add ALL columns Prisma expects ──
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id)`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS collection_id UUID REFERENCES collections(id)`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS style_code VARCHAR(100)`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS title VARCHAR(500)`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type VARCHAR(200)`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS category VARCHAR(200)`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS material VARCHAR(200)`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS season VARCHAR(50)`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_image_url TEXT`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS availability_type VARCHAR(50)`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS lead_time_days INT`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'DRAFT'`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()`,
            `CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id)`,
            `CREATE INDEX IF NOT EXISTS idx_products_collection ON products(collection_id)`,
            `CREATE INDEX IF NOT EXISTS idx_products_status ON products(status)`,
            `CREATE INDEX IF NOT EXISTS idx_products_style_code ON products(style_code)`,

            // ── Variant Groups ──
            `CREATE TABLE IF NOT EXISTS variant_groups (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                color VARCHAR(100),
                material VARCHAR(200),
                size_run TEXT[] DEFAULT '{}',
                image_url TEXT,
                position INT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_vg_product ON variant_groups(product_id)`,

            // ── Product Variants ──
            `CREATE TABLE IF NOT EXISTS product_variants (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                variant_group_id UUID REFERENCES variant_groups(id),
                sku VARCHAR(100) NOT NULL UNIQUE,
                title VARCHAR(500),
                color VARCHAR(100),
                size VARCHAR(50),
                option1 VARCHAR(255),
                option2 VARCHAR(255),
                option3 VARCHAR(255),
                barcode VARCHAR(100),
                weight_grams INT,
                price DECIMAL(12,2),
                compare_at_price DECIMAL(12,2),
                vendor_cost DECIMAL(12,2),
                ins_discount_type TEXT,
                ins_discount_value DECIMAL(12,2),
                estimated_margin DECIMAL(5,2),
                image_url TEXT,
                status TEXT NOT NULL DEFAULT 'DRAFT',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id)`,
            `CREATE INDEX IF NOT EXISTS idx_variants_vg ON product_variants(variant_group_id)`,
            `CREATE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode)`,

            // ── Product Images ──
            `CREATE TABLE IF NOT EXISTS product_images (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                src TEXT NOT NULL,
                alt VARCHAR(500),
                position INT NOT NULL DEFAULT 0,
                width INT,
                height INT,
                shopify_id BIGINT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_pimg_product ON product_images(product_id)`,

            // ── Shopify Product Maps ──
            `CREATE TABLE IF NOT EXISTS shopify_product_maps (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                store_id UUID NOT NULL REFERENCES shopify_stores(id),
                product_id UUID NOT NULL REFERENCES products(id),
                shopify_product_id BIGINT NOT NULL,
                handle VARCHAR(255),
                shopify_status VARCHAR(20),
                vendor VARCHAR(255),
                tags TEXT[] DEFAULT '{}',
                body_html TEXT,
                shopify_category_id VARCHAR(100),
                raw_snapshot JSONB,
                last_hash VARCHAR(64),
                synced_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_spmap_store_product UNIQUE (store_id, shopify_product_id)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_spmap_product ON shopify_product_maps(product_id)`,

            // ── Shopify Variant Maps ──
            `CREATE TABLE IF NOT EXISTS shopify_variant_maps (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                store_id UUID NOT NULL REFERENCES shopify_stores(id),
                variant_id UUID NOT NULL REFERENCES product_variants(id),
                shopify_variant_id BIGINT NOT NULL,
                inventory_item_id BIGINT,
                shopify_sku VARCHAR(100),
                raw_snapshot JSONB,
                synced_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_svmap_store_variant UNIQUE (store_id, shopify_variant_id)
            )`,
            // If table existed from old schema, add missing columns
            `ALTER TABLE shopify_variant_maps ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES product_variants(id)`,
            `ALTER TABLE shopify_variant_maps ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES shopify_stores(id)`,
            `ALTER TABLE shopify_variant_maps ADD COLUMN IF NOT EXISTS shopify_variant_id BIGINT`,
            `ALTER TABLE shopify_variant_maps ADD COLUMN IF NOT EXISTS inventory_item_id BIGINT`,
            `ALTER TABLE shopify_variant_maps ADD COLUMN IF NOT EXISTS shopify_sku VARCHAR(100)`,
            `ALTER TABLE shopify_variant_maps ADD COLUMN IF NOT EXISTS raw_snapshot JSONB`,
            `ALTER TABLE shopify_variant_maps ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ`,
            `ALTER TABLE shopify_variant_maps ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`,
            `CREATE INDEX IF NOT EXISTS idx_svmap_variant ON shopify_variant_maps(variant_id)`,
            `CREATE INDEX IF NOT EXISTS idx_svmap_sku ON shopify_variant_maps(shopify_sku)`,

            // ── Product Sync Jobs ──
            `CREATE TABLE IF NOT EXISTS product_sync_jobs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                store_id UUID REFERENCES shopify_stores(id),
                brand_id UUID REFERENCES brands(id),
                source VARCHAR(20) NOT NULL DEFAULT 'shopify',
                status VARCHAR(20) NOT NULL DEFAULT 'running',
                total_items INT NOT NULL DEFAULT 0,
                created INT NOT NULL DEFAULT 0,
                updated INT NOT NULL DEFAULT 0,
                skipped INT NOT NULL DEFAULT 0,
                failed INT NOT NULL DEFAULT 0,
                error_msg TEXT,
                started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                completed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_psj_store ON product_sync_jobs(store_id)`,
            `CREATE INDEX IF NOT EXISTS idx_psj_brand ON product_sync_jobs(brand_id)`,

            // ── Product Sync Logs ──
            `CREATE TABLE IF NOT EXISTS product_sync_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                job_id UUID NOT NULL REFERENCES product_sync_jobs(id) ON DELETE CASCADE,
                action TEXT NOT NULL,
                level VARCHAR(10) NOT NULL DEFAULT 'info',
                message TEXT NOT NULL,
                data JSONB,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_psl_job ON product_sync_logs(job_id)`,

            // ── Product Issues ──
            `CREATE TABLE IF NOT EXISTS product_issues (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                product_id UUID REFERENCES products(id) ON DELETE CASCADE,
                variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
                rule_code VARCHAR(50) NOT NULL,
                severity TEXT NOT NULL DEFAULT 'WARNING',
                status TEXT NOT NULL DEFAULT 'OPEN',
                message TEXT NOT NULL,
                resolved_by UUID,
                resolved_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_pi_product ON product_issues(product_id)`,
            `CREATE INDEX IF NOT EXISTS idx_pi_variant ON product_issues(variant_id)`,
            `CREATE INDEX IF NOT EXISTS idx_pi_status ON product_issues(status)`,
            `CREATE INDEX IF NOT EXISTS idx_pi_rule ON product_issues(rule_code)`,

            // ── Sprint 2: Metafield tables ──
            `CREATE TABLE IF NOT EXISTS metafield_definitions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                namespace VARCHAR(100) NOT NULL DEFAULT 'custom',
                key VARCHAR(100) NOT NULL,
                type VARCHAR(50) NOT NULL,
                owner_type VARCHAR(20) NOT NULL,
                label VARCHAR(255),
                description TEXT,
                validation_json JSONB,
                is_active BOOLEAN NOT NULL DEFAULT true,
                is_required BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_mfdef_ns_key_owner UNIQUE (namespace, key, owner_type)
            )`,
            `CREATE TABLE IF NOT EXISTS metafield_definition_options (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                definition_id UUID NOT NULL REFERENCES metafield_definitions(id) ON DELETE CASCADE,
                value VARCHAR(500) NOT NULL,
                label VARCHAR(255),
                sort_order INT NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_mfopt_def_value UNIQUE (definition_id, value)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_mfopt_definition ON metafield_definition_options(definition_id)`,
            `CREATE TABLE IF NOT EXISTS catalog_metafield_schema (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                shopify_category_id VARCHAR(100) NOT NULL,
                definition_id UUID NOT NULL REFERENCES metafield_definitions(id) ON DELETE CASCADE,
                is_required BOOLEAN NOT NULL DEFAULT false,
                display_order INT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_cms_cat_def UNIQUE (shopify_category_id, definition_id)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_cms_category ON catalog_metafield_schema(shopify_category_id)`,
            `CREATE TABLE IF NOT EXISTS metafield_values (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                owner_type VARCHAR(20) NOT NULL,
                owner_id UUID NOT NULL,
                definition_id UUID NOT NULL REFERENCES metafield_definitions(id),
                store_id UUID REFERENCES shopify_stores(id),
                value_json JSONB NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
                submitted_by UUID,
                reviewer_id UUID,
                reviewed_at TIMESTAMPTZ,
                rejection_reason TEXT,
                last_pushed_at TIMESTAMPTZ,
                last_pushed_hash VARCHAR(64),
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )`,
            `CREATE INDEX IF NOT EXISTS idx_mfv_owner ON metafield_values(owner_type, owner_id)`,
            `CREATE INDEX IF NOT EXISTS idx_mfv_definition ON metafield_values(definition_id)`,
            `CREATE INDEX IF NOT EXISTS idx_mfv_store ON metafield_values(store_id)`,
            `CREATE INDEX IF NOT EXISTS idx_mfv_status ON metafield_values(status)`,
            `CREATE TABLE IF NOT EXISTS product_validation_states (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                store_id UUID REFERENCES shopify_stores(id),
                is_valid BOOLEAN NOT NULL DEFAULT false,
                missing_required JSONB NOT NULL DEFAULT '[]'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_pvs_product_store UNIQUE (product_id, store_id)
            )`,
            `CREATE INDEX IF NOT EXISTS idx_pvs_product ON product_validation_states(product_id)`,
            `CREATE INDEX IF NOT EXISTS idx_pvs_valid ON product_validation_states(is_valid)`,
            // ALTER existing tables
            `ALTER TABLE sync_job_logs ADD COLUMN IF NOT EXISTS metafield_value_id UUID`,
            `ALTER TABLE sync_job_logs ADD COLUMN IF NOT EXISTS store_id UUID`,
            `ALTER TABLE sync_job_logs ADD COLUMN IF NOT EXISTS shopify_resource_id VARCHAR(50)`,
            `ALTER TABLE sync_job_logs ADD COLUMN IF NOT EXISTS shopify_metafield_id VARCHAR(50)`,
            `ALTER TABLE sync_job_logs ADD COLUMN IF NOT EXISTS payload JSONB`,
            // ── Convert TEXT columns to enum types (Prisma requires proper enum types) ──
            `DO $$ BEGIN ALTER TABLE products ALTER COLUMN status TYPE "ProductStatus" USING status::"ProductStatus"; EXCEPTION WHEN others THEN NULL; END $$`,
            `DO $$ BEGIN ALTER TABLE product_variants ALTER COLUMN status TYPE "VariantStatus" USING status::"VariantStatus"; EXCEPTION WHEN others THEN NULL; END $$`,
            `DO $$ BEGIN ALTER TABLE product_variants ALTER COLUMN ins_discount_type TYPE "DiscountType" USING ins_discount_type::"DiscountType"; EXCEPTION WHEN others THEN NULL; END $$`,
            `DO $$ BEGIN ALTER TABLE product_sync_logs ALTER COLUMN action TYPE "SyncAction" USING action::"SyncAction"; EXCEPTION WHEN others THEN NULL; END $$`,
            `DO $$ BEGIN ALTER TABLE product_issues ALTER COLUMN severity TYPE "IssueSeverity" USING severity::"IssueSeverity"; EXCEPTION WHEN others THEN NULL; END $$`,
            `DO $$ BEGIN ALTER TABLE product_issues ALTER COLUMN status TYPE "IssueStatus" USING status::"IssueStatus"; EXCEPTION WHEN others THEN NULL; END $$`,
        ];

        let ok = 0;
        let fail = 0;
        for (const sql of migrations) {
            try {
                await prisma.$executeRawUnsafe(sql);
                ok++;
            } catch (err: any) {
                fail++;
                console.warn(`⚠️ Migration step failed: ${err.message?.substring(0, 100)}`);
            }
        }
        console.log(`✅ DB tables: ${ok} OK, ${fail} failed`);
    } catch (err: any) {
        console.warn('⚠️ Table migration skipped:', err.message);
    }

    // Serve uploaded files statically
    const express = require('express');
    const { join } = require('path');
    expressApp.use('/uploads', express.static(join(process.cwd(), 'uploads')));

    // Railway sets PORT automatically — must use it, fallback to API_PORT for local dev
    const port = process.env.PORT || config.API_PORT;
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 INS Commerce Hub API running on 0.0.0.0:${port}`);
}
bootstrap();
