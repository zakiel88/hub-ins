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

    // ── Startup: ensure all Sprint 2 tables exist (prisma db push doesn't always sync) ──
    try {
        const { PrismaService } = await import('./prisma/prisma.service');
        const prisma = app.get(PrismaService);

        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS metafield_definitions (
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
            );

            CREATE TABLE IF NOT EXISTS metafield_definition_options (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                definition_id UUID NOT NULL REFERENCES metafield_definitions(id) ON DELETE CASCADE,
                value VARCHAR(500) NOT NULL,
                label VARCHAR(255),
                sort_order INT NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_mfopt_def_value UNIQUE (definition_id, value)
            );
            CREATE INDEX IF NOT EXISTS idx_mfopt_definition ON metafield_definition_options(definition_id);

            CREATE TABLE IF NOT EXISTS catalog_metafield_schema (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                shopify_category_id VARCHAR(100) NOT NULL,
                definition_id UUID NOT NULL REFERENCES metafield_definitions(id) ON DELETE CASCADE,
                is_required BOOLEAN NOT NULL DEFAULT false,
                display_order INT NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_cms_cat_def UNIQUE (shopify_category_id, definition_id)
            );
            CREATE INDEX IF NOT EXISTS idx_cms_category ON catalog_metafield_schema(shopify_category_id);

            CREATE TABLE IF NOT EXISTS metafield_values (
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
            );
            CREATE INDEX IF NOT EXISTS idx_mfv_owner ON metafield_values(owner_type, owner_id);
            CREATE INDEX IF NOT EXISTS idx_mfv_definition ON metafield_values(definition_id);
            CREATE INDEX IF NOT EXISTS idx_mfv_store ON metafield_values(store_id);
            CREATE INDEX IF NOT EXISTS idx_mfv_status ON metafield_values(status);

            CREATE TABLE IF NOT EXISTS product_validation_states (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                store_id UUID REFERENCES shopify_stores(id),
                is_valid BOOLEAN NOT NULL DEFAULT false,
                missing_required JSONB NOT NULL DEFAULT '[]',
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_pvs_product_store UNIQUE (product_id, store_id)
            );
            CREATE INDEX IF NOT EXISTS idx_pvs_product ON product_validation_states(product_id);
            CREATE INDEX IF NOT EXISTS idx_pvs_valid ON product_validation_states(is_valid);
        `);

        // Add missing columns to existing tables
        await prisma.$executeRawUnsafe(`
            ALTER TABLE sync_job_logs ADD COLUMN IF NOT EXISTS metafield_value_id UUID;
            ALTER TABLE sync_job_logs ADD COLUMN IF NOT EXISTS store_id UUID;
            ALTER TABLE sync_job_logs ADD COLUMN IF NOT EXISTS shopify_resource_id VARCHAR(50);
            ALTER TABLE sync_job_logs ADD COLUMN IF NOT EXISTS shopify_metafield_id VARCHAR(50);
            ALTER TABLE sync_job_logs ADD COLUMN IF NOT EXISTS payload JSONB;
        `);

        console.log('✅ Sprint 2 tables ensured');
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
