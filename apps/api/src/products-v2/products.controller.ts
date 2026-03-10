import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProductsV2Service } from './products.service';
import { ProductRulesService } from './product-rules.service';
import { IntakeService } from './intake.service';
import { ShopifyListingService } from './shopify-listing.service';
import { Roles, CurrentUser, JwtPayload } from '../auth/decorators';

@Controller('api/v1')
export class ProductsV2Controller {
    constructor(
        private readonly products: ProductsV2Service,
        private readonly rules: ProductRulesService,
        private readonly intake: IntakeService,
        private readonly listing: ShopifyListingService,
    ) { }

    // ═══════════════════════════════════════
    //  Diagnostic (TEMP — remove after debugging)
    // ═══════════════════════════════════════

    @Get('products/debug')
    async debug() {
        const prisma = this.products['prisma'];
        const results: Record<string, any> = {};
        try { results.productCount = await prisma.product.count(); } catch (e: any) { results.productCountError = e.message?.substring(0, 200); }
        try { results.variantCount = await prisma.productVariant.count(); } catch (e: any) { results.variantCountError = e.message?.substring(0, 200); }
        try { results.variantGroupCount = await prisma.variantGroup.count(); } catch (e: any) { results.variantGroupCountError = e.message?.substring(0, 200); }
        try { results.syncJobCount = await prisma.productSyncJob.count(); } catch (e: any) { results.syncJobCountError = e.message?.substring(0, 200); }
        try { results.issueCount = await prisma.productIssue.count(); } catch (e: any) { results.issueCountError = e.message?.substring(0, 200); }
        try { results.imageCount = await prisma.productImage.count(); } catch (e: any) { results.imageCountError = e.message?.substring(0, 200); }
        // Check product table columns
        try {
            const cols = await prisma.$queryRawUnsafe("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products' ORDER BY ordinal_position");
            results.productColumns = cols;
        } catch (e: any) { results.productColumnsError = e.message?.substring(0, 200); }
        // Try a simple findMany
        try {
            const data = await prisma.product.findMany({ take: 1 });
            results.findManyResult = data;
        } catch (e: any) { results.findManyError = e.message?.substring(0, 300); }
        // Try findMany with includes
        try {
            const data = await prisma.product.findMany({
                take: 1,
                include: { brand: true, _count: { select: { variants: true, issues: true } } },
            });
            results.findManyWithIncludeResult = data;
        } catch (e: any) { results.findManyWithIncludeError = e.message?.substring(0, 300); }
        return { data: results };
    }

    @Post('products/run-migration')
    @Roles('admin')
    async runMigration() {
        const prisma = this.products['prisma'];
        const migrations = [
            `DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ProductStatus') THEN CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED'); END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'VariantStatus') THEN CREATE TYPE "VariantStatus" AS ENUM ('ACTIVE', 'DRAFT', 'DISCONTINUED'); END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DiscountType') THEN CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED'); END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SyncAction') THEN CREATE TYPE "SyncAction" AS ENUM ('CREATED', 'UPDATED', 'SKIPPED', 'FAILED'); END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IssueSeverity') THEN CREATE TYPE "IssueSeverity" AS ENUM ('ERROR', 'WARNING', 'INFO'); END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IssueStatus') THEN CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'RESOLVED', 'IGNORED'); END IF;
            END $$`,
            // ── Fix old products table legacy columns with NOT NULL constraints ──
            `ALTER TABLE products ALTER COLUMN name SET DEFAULT ''`,
            `ALTER TABLE products ALTER COLUMN name DROP NOT NULL`,
            `ALTER TABLE products ALTER COLUMN slug SET DEFAULT ''`,
            `ALTER TABLE products ALTER COLUMN slug DROP NOT NULL`,
            `ALTER TABLE products ALTER COLUMN sku_prefix SET DEFAULT ''`,
            `ALTER TABLE products ALTER COLUMN sku_prefix DROP NOT NULL`,
            `ALTER TABLE products ALTER COLUMN handle SET DEFAULT ''`,
            `ALTER TABLE products ALTER COLUMN handle DROP NOT NULL`,
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
            `CREATE TABLE IF NOT EXISTS variant_groups (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(), product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                color VARCHAR(100), material VARCHAR(200), size_run TEXT[] DEFAULT '{}', image_url TEXT,
                position INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
            `CREATE INDEX IF NOT EXISTS idx_vg_product ON variant_groups(product_id)`,
            `CREATE TABLE IF NOT EXISTS product_variants (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(), product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                variant_group_id UUID REFERENCES variant_groups(id), sku VARCHAR(100) NOT NULL UNIQUE,
                title VARCHAR(500), color VARCHAR(100), size VARCHAR(50),
                option1 VARCHAR(255), option2 VARCHAR(255), option3 VARCHAR(255),
                barcode VARCHAR(100), weight_grams INT, price DECIMAL(12,2),
                compare_at_price DECIMAL(12,2), vendor_cost DECIMAL(12,2),
                ins_discount_type TEXT, ins_discount_value DECIMAL(12,2), estimated_margin DECIMAL(5,2),
                image_url TEXT, status TEXT NOT NULL DEFAULT 'DRAFT',
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
            `CREATE INDEX IF NOT EXISTS idx_variants_product ON product_variants(product_id)`,
            `CREATE INDEX IF NOT EXISTS idx_variants_vg ON product_variants(variant_group_id)`,
            `CREATE INDEX IF NOT EXISTS idx_variants_barcode ON product_variants(barcode)`,
            `CREATE TABLE IF NOT EXISTS product_images (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(), product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                src TEXT NOT NULL, alt VARCHAR(500), position INT NOT NULL DEFAULT 0,
                width INT, height INT, shopify_id BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
            `CREATE INDEX IF NOT EXISTS idx_pimg_product ON product_images(product_id)`,
            `CREATE TABLE IF NOT EXISTS shopify_product_maps (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(), store_id UUID NOT NULL REFERENCES shopify_stores(id),
                product_id UUID NOT NULL REFERENCES products(id), shopify_product_id BIGINT NOT NULL,
                handle VARCHAR(255), shopify_status VARCHAR(20), vendor VARCHAR(255),
                tags TEXT[] DEFAULT '{}', body_html TEXT, shopify_category_id VARCHAR(100),
                raw_snapshot JSONB, last_hash VARCHAR(64), synced_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_spmap_store_product UNIQUE (store_id, shopify_product_id))`,
            `CREATE INDEX IF NOT EXISTS idx_spmap_product ON shopify_product_maps(product_id)`,
            `CREATE TABLE IF NOT EXISTS shopify_variant_maps (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(), store_id UUID NOT NULL REFERENCES shopify_stores(id),
                variant_id UUID NOT NULL REFERENCES product_variants(id),
                shopify_variant_id BIGINT NOT NULL, inventory_item_id BIGINT,
                shopify_sku VARCHAR(100), raw_snapshot JSONB, synced_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_svmap_store_variant UNIQUE (store_id, shopify_variant_id))`,
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
            `CREATE TABLE IF NOT EXISTS product_sync_jobs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(), store_id UUID REFERENCES shopify_stores(id),
                brand_id UUID REFERENCES brands(id), source VARCHAR(20) NOT NULL DEFAULT 'shopify',
                status VARCHAR(20) NOT NULL DEFAULT 'running', total_items INT NOT NULL DEFAULT 0,
                created INT NOT NULL DEFAULT 0, updated INT NOT NULL DEFAULT 0,
                skipped INT NOT NULL DEFAULT 0, failed INT NOT NULL DEFAULT 0,
                error_msg TEXT, started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
            `CREATE INDEX IF NOT EXISTS idx_psj_store ON product_sync_jobs(store_id)`,
            `CREATE TABLE IF NOT EXISTS product_sync_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(), job_id UUID NOT NULL REFERENCES product_sync_jobs(id) ON DELETE CASCADE,
                action TEXT NOT NULL, level VARCHAR(10) NOT NULL DEFAULT 'info',
                message TEXT NOT NULL, data JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
            `CREATE INDEX IF NOT EXISTS idx_psl_job ON product_sync_logs(job_id)`,
            `CREATE TABLE IF NOT EXISTS product_issues (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                product_id UUID REFERENCES products(id) ON DELETE CASCADE,
                variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
                rule_code VARCHAR(50) NOT NULL, severity TEXT NOT NULL DEFAULT 'WARNING',
                status TEXT NOT NULL DEFAULT 'OPEN', message TEXT NOT NULL,
                resolved_by UUID, resolved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
            `CREATE INDEX IF NOT EXISTS idx_pi_product ON product_issues(product_id)`,
            `CREATE INDEX IF NOT EXISTS idx_pi_variant ON product_issues(variant_id)`,
            `CREATE INDEX IF NOT EXISTS idx_pi_status ON product_issues(status)`,
            // ── Convert TEXT columns to enum types (Prisma requires proper enum types) ──
            `DO $$ BEGIN ALTER TABLE products ALTER COLUMN status TYPE "ProductStatus" USING status::"ProductStatus"; EXCEPTION WHEN others THEN NULL; END $$`,
            `DO $$ BEGIN ALTER TABLE product_variants ALTER COLUMN status TYPE "VariantStatus" USING status::"VariantStatus"; EXCEPTION WHEN others THEN NULL; END $$`,
            `DO $$ BEGIN ALTER TABLE product_variants ALTER COLUMN ins_discount_type TYPE "DiscountType" USING ins_discount_type::"DiscountType"; EXCEPTION WHEN others THEN NULL; END $$`,
            `DO $$ BEGIN ALTER TABLE product_sync_logs ALTER COLUMN action TYPE "SyncAction" USING action::"SyncAction"; EXCEPTION WHEN others THEN NULL; END $$`,
            `DO $$ BEGIN ALTER TABLE product_issues ALTER COLUMN severity TYPE "IssueSeverity" USING severity::"IssueSeverity"; EXCEPTION WHEN others THEN NULL; END $$`,
            `DO $$ BEGIN ALTER TABLE product_issues ALTER COLUMN status TYPE "IssueStatus" USING status::"IssueStatus"; EXCEPTION WHEN others THEN NULL; END $$`,
        ];
        let ok = 0; let fail = 0; const errors: string[] = [];
        for (const sql of migrations) {
            try { await prisma.$executeRawUnsafe(sql); ok++; } catch (e: any) { fail++; errors.push(e.message?.substring(0, 150)); }
        }
        return { data: { ok, fail, errors, total: migrations.length } };
    }

    // ═══════════════════════════════════════
    //  Products Core
    // ═══════════════════════════════════════

    @Get('products')
    async findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('brandId') brandId?: string,
        @Query('collectionId') collectionId?: string,
        @Query('category') category?: string,
        @Query('status') status?: string,
        @Query('hasIssues') hasIssues?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortDir') sortDir?: string,
    ) {
        return this.products.findAllProducts({
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            search,
            brandId,
            collectionId,
            category,
            status,
            hasIssues: hasIssues === 'true',
            sortBy,
            sortDir,
        });
    }

    @Get('products/summary')
    async getSummary() {
        return this.products.getProductsSummary();
    }

    @Get('products/sync-jobs')
    async findSyncJobs(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('source') source?: string,
        @Query('status') status?: string,
    ) {
        return this.products.findSyncJobs({
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            source,
            status,
        });
    }

    @Get('products/sync-jobs/:id')
    async findSyncJobById(@Param('id', ParseUUIDPipe) id: string) {
        return this.products.findSyncJobById(id);
    }

    @Get('products/issues')
    async findIssues(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('severity') severity?: string,
        @Query('status') status?: string,
        @Query('ruleCode') ruleCode?: string,
        @Query('productId') productId?: string,
    ) {
        return this.products.findIssues({
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            severity,
            status,
            ruleCode,
            productId,
        });
    }

    @Patch('products/issues/:id/resolve')
    async resolveIssue(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.products.resolveIssue(id, user.sub);
    }

    @Patch('products/issues/:id/ignore')
    async ignoreIssue(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.products.ignoreIssue(id, user.sub);
    }

    @Get('products/next-style-code')
    async getNextStyleCode(@Query('brandId') brandId?: string) {
        return this.products.getNextStyleCode(brandId);
    }

    @Post('products')
    async createProduct(
        @Body() body: {
            title: string;
            styleCode: string;
            brandId?: string;
            collectionId?: string;
            productType?: string;
            category?: string;
            description?: string;
            material?: string;
            season?: string;
            featuredImageUrl?: string;
            availabilityType?: string;
            leadTimeDays?: number;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        return this.products.createProduct(body, user.sub);
    }

    @Get('products/:id')
    async findById(@Param('id', ParseUUIDPipe) id: string) {
        return this.products.findProductById(id);
    }

    @Put('products/:id')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: {
            title?: string;
            description?: string;
            productType?: string;
            category?: string;
            material?: string;
            season?: string;
            styleCode?: string;
            brandId?: string;
            collectionId?: string;
            status?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const result = await this.products.updateProduct(id, body, user.sub);
        // Run rules after product update
        await this.rules.runRulesForProduct(id);
        return result;
    }

    @Patch('products/:id/archive')
    async archive(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.products.archiveProduct(id, user.sub);
    }

    // ═══════════════════════════════════════
    //  Variants / SKUs (nested under product)
    // ═══════════════════════════════════════

    @Post('products/:id/skus')
    async createSku(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: {
            sku: string;
            color?: string;
            size?: string;
            price?: number;
            compareAtPrice?: number;
            vendorCost?: number;
            barcode?: string;
            weightGrams?: number;
            status?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const result = await this.products.createSku(id, body, user.sub);
        await this.rules.runRulesForProduct(id);
        return result;
    }

    @Get('products/:id/variants')
    async findProductVariants(
        @Param('id', ParseUUIDPipe) id: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
    ) {
        return this.products.findProductVariants(id, {
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            status,
        });
    }

    @Put('products/:id/variants/:vid')
    async updateVariant(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('vid', ParseUUIDPipe) vid: string,
        @Body() body: {
            title?: string;
            color?: string;
            size?: string;
            barcode?: string;
            weightGrams?: number;
            price?: number;
            compareAtPrice?: number;
            vendorCost?: number;
            insDiscountType?: string;
            insDiscountValue?: number;
            imageUrl?: string;
            status?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const result = await this.products.updateVariant(id, vid, body, user.sub);
        // Run rules after variant update (margin may have changed)
        await this.rules.runRulesForProduct(id);
        return result;
    }

    @Patch('products/:id/variants/bulk')
    async bulkUpdateVariants(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: {
            updates: Array<{
                variantId: string;
                vendorCost?: number;
                insDiscountType?: string;
                insDiscountValue?: number;
                price?: number;
            }>;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const result = await this.products.bulkUpdateVariants(id, body.updates, user.sub);
        // Run rules after bulk update
        await this.rules.runRulesForProduct(id);
        return result;
    }

    // ═══════════════════════════════════════
    //  Global Variant Routes
    // ═══════════════════════════════════════

    @Get('product-variants')
    async findAllVariants(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('sku') sku?: string,
        @Query('brandId') brandId?: string,
        @Query('storeId') storeId?: string,
        @Query('status') status?: string,
        @Query('hasIssues') hasIssues?: string,
        @Query('missingCost') missingCost?: string,
        @Query('missingDiscount') missingDiscount?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortDir') sortDir?: string,
    ) {
        return this.products.findAllVariants({
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            search,
            sku,
            brandId,
            storeId,
            status,
            hasIssues: hasIssues === 'true',
            missingCost: missingCost === 'true',
            missingDiscount: missingDiscount === 'true',
            sortBy,
            sortDir,
        });
    }

    @Get('product-variants/by-sku/:sku')
    async findVariantBySku(@Param('sku') sku: string) {
        return this.products.findVariantBySku(sku);
    }

    // ═══════════════════════════════════════
    //  Variant Groups (real entity)
    // ═══════════════════════════════════════

    @Get('variant-groups')
    async findVariantGroups(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('brandId') brandId?: string,
        @Query('color') color?: string,
        @Query('material') material?: string,
        @Query('status') status?: string,
        @Query('hasIssues') hasIssues?: string,
    ) {
        return this.products.getVariantGroups({
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            search,
            brandId,
            color,
            material,
            status,
            hasIssues: hasIssues === 'true',
        });
    }

    @Post('products/:id/variant-groups')
    async createVariantGroup(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: {
            color?: string;
            material?: string;
            sizeRun: string[];
            imageUrl?: string;
            price?: number;
            vendorCost?: number;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const result = await this.products.createVariantGroup(id, body, user.sub);
        await this.rules.runRulesForProduct(id);
        return result;
    }

    @Post('variant-groups/:id/sizes')
    async addSizeToGroup(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: { size: string; price?: number; vendorCost?: number },
        @CurrentUser() user: JwtPayload,
    ) {
        return this.products.addSizeToGroup(id, body, user.sub);
    }

    @Delete('variant-groups/:id/sizes/:size')
    async removeSizeFromGroup(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('size') size: string,
        @CurrentUser() user: JwtPayload,
    ) {
        return this.products.removeSizeFromGroup(id, size, user.sub);
    }

    // ═══════════════════════════════════════
    //  Global Bulk Variant Operations
    // ═══════════════════════════════════════

    @Patch('product-variants/bulk')
    async globalBulkUpdate(
        @Body() body: {
            action: 'update_cost' | 'update_discount' | 'activate' | 'archive' | 'resolve_issues';
            variantIds: string[];
            data?: {
                vendorCost?: number;
                insDiscountType?: string;
                insDiscountValue?: number;
            };
        },
        @CurrentUser() user: JwtPayload,
    ) {
        return this.products.globalBulkUpdate(body.action, body.variantIds, body.data || {}, user.sub);
    }

    // ═══════════════════════════════════════
    //  Intake Import
    // ═══════════════════════════════════════

    @Post('products/import/preview')
    @UseInterceptors(FileInterceptor('file'))
    async importPreview(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new BadRequestException('No file uploaded');
        return this.intake.preview(file.buffer, file.mimetype);
    }

    @Post('products/import/commit')
    @UseInterceptors(FileInterceptor('file'))
    async importCommit(
        @UploadedFile() file: Express.Multer.File,
        @CurrentUser() user: JwtPayload,
    ) {
        if (!file) throw new BadRequestException('No file uploaded');
        return this.intake.commit(file.buffer, file.mimetype, user.sub);
    }

    // ═══════════════════════════════════════
    //  Shopify Draft Listing
    // ═══════════════════════════════════════

    @Post('products/:id/list-to-shopify')
    async createDraftListing(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: { storeId: string },
        @CurrentUser() user: JwtPayload,
    ) {
        return this.listing.createDraftListing(id, body.storeId, user.sub);
    }

    @Post('products/list-to-shopify/bulk')
    async bulkCreateDraftListings(
        @Body() body: { productIds: string[]; storeId: string },
        @CurrentUser() user: JwtPayload,
    ) {
        return this.listing.bulkCreateDraftListings(body.productIds, body.storeId, user.sub);
    }

    // ═══════════════════════════════════════
    //  Admin Actions
    // ═══════════════════════════════════════

    @Patch('products/rules/run-all')
    @Roles('admin')
    async runRulesAll() {
        return this.rules.runRulesAll();
    }
}
