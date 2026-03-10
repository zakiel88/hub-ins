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
