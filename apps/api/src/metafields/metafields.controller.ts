import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
    Req,
} from '@nestjs/common';
import { MetafieldsService } from './metafields.service';
import { MetafieldsPushService, PushParams } from './metafields-push.service';
import { CatalogValidationService } from './catalog-validation.service';
import { Roles } from '../auth/decorators';
import { searchTaxonomy, getTaxonomyCategories } from './taxonomy';

@Controller('api/v1/metafields')
export class MetafieldsController {
    constructor(
        private readonly metafieldsService: MetafieldsService,
        private readonly pushService: MetafieldsPushService,
        private readonly catalogValidation: CatalogValidationService,
    ) { }

    // ─── Definitions ─────────────────────

    @Get('definitions')
    @Roles('admin')
    async getDefinitions(
        @Query('ownerType') ownerType?: string,
        @Query('isActive') isActive?: string,
    ) {
        return {
            data: await this.metafieldsService.getDefinitions({
                ownerType,
                isActive: isActive !== undefined ? isActive === 'true' : undefined,
            }),
        };
    }

    @Post('definitions')
    @Roles('admin')
    async createDefinition(@Body() body: {
        namespace?: string;
        key: string;
        type: string;
        ownerType: string;
        label?: string;
        description?: string;
        validationJson?: any;
    }) {
        return { data: await this.metafieldsService.createDefinition(body) };
    }

    @Patch('definitions/:id')
    @Roles('admin')
    async updateDefinition(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: {
            label?: string;
            description?: string;
            validationJson?: any;
            isActive?: boolean;
            isRequired?: boolean;
        },
    ) {
        return { data: await this.metafieldsService.updateDefinition(id, body) };
    }

    @Post('definitions/sync')
    @Roles('admin')
    async syncDefinitions(@Query('storeId') storeId?: string) {
        // Create a SyncJob and return immediately — run sync in background
        const job = await this.metafieldsService.createSyncJob('sync_definitions', storeId);

        // Fire and forget — run in background
        this.metafieldsService.syncDefinitionsFromShopify(storeId)
            .then(async (result) => {
                await this.metafieldsService.completeSyncJob(job.id, 'success', result);
            })
            .catch(async (err) => {
                await this.metafieldsService.completeSyncJob(job.id, 'failed', null, err.message);
            });

        return { data: { jobId: job.id }, message: 'Sync started in background' };
    }

    @Post('values/sync')
    @Roles('admin')
    async syncValues(@Query('storeId') storeId?: string) {
        const job = await this.metafieldsService.createSyncJob('sync_values', storeId);

        this.metafieldsService.syncValuesFromShopify(storeId)
            .then(async (result) => {
                await this.metafieldsService.completeSyncJob(job.id, 'success', result);
            })
            .catch(async (err) => {
                await this.metafieldsService.completeSyncJob(job.id, 'failed', null, err.message);
            });

        return { data: { jobId: job.id }, message: 'Sync started in background' };
    }

    // ─── Options Library ─────────────────

    @Get('definitions-with-options')
    @Roles('admin', 'sourcing_procurement')
    async getDefinitionsWithOptions(
        @Query('ownerType') ownerType?: string,
        @Query('hasCatalogSchema') hasCatalogSchema?: string,
    ) {
        return {
            data: await this.metafieldsService.getDefinitionsWithOptions({
                ownerType,
                hasCatalogSchema: hasCatalogSchema === 'true' ? true : hasCatalogSchema === 'false' ? false : undefined,
            }),
        };
    }

    @Post('definitions/:id/options')
    @Roles('admin')
    async addOption(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: { value: string; label?: string },
    ) {
        return { data: await this.metafieldsService.addOption(id, body.value, body.label) };
    }

    @Delete('options/:id')
    @Roles('admin')
    async removeOption(@Param('id', ParseUUIDPipe) id: string) {
        await this.metafieldsService.removeOption(id);
        return { message: 'Option removed' };
    }

    @Post('definitions/:id/options/bulk')
    @Roles('admin')
    async bulkAddOptions(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: { values: string[] },
    ) {
        return { data: await this.metafieldsService.bulkAddOptions(id, body.values) };
    }

    @Post('definitions/:id/options/auto-populate')
    @Roles('admin')
    async autoPopulateOptions(@Param('id', ParseUUIDPipe) id: string) {
        return { data: await this.metafieldsService.autoPopulateOptions(id) };
    }

    // ─── Catalog Metafield Schema ────────

    @Get('schemas')
    @Roles('admin', 'sourcing_procurement')
    async getSchemaByCategory(@Query('categoryId') categoryId: string) {
        return { data: await this.metafieldsService.getSchemaByCategory(categoryId) };
    }

    @Post('schemas')
    @Roles('admin')
    async addSchemaEntry(@Body() body: {
        shopifyCategoryId: string;
        definitionId: string;
        isRequired?: boolean;
        displayOrder?: number;
    }) {
        return { data: await this.metafieldsService.addSchemaEntry(body) };
    }

    @Patch('schemas/:id')
    @Roles('admin')
    async updateSchemaEntry(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: { isRequired?: boolean; displayOrder?: number },
    ) {
        return { data: await this.metafieldsService.updateSchemaEntry(id, body) };
    }

    @Delete('schemas/:id')
    @Roles('admin')
    async removeSchemaEntry(@Param('id', ParseUUIDPipe) id: string) {
        await this.metafieldsService.removeSchemaEntry(id);
        return { message: 'Schema entry removed' };
    }

    // ─── Values ──────────────────────────

    @Get('values/all')
    @Roles('admin', 'sourcing_procurement')
    async getAllValues(
        @Query('ownerType') ownerType?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.metafieldsService.getAllValuesGrouped({
            ownerType,
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
        });
    }

    @Get('values')
    @Roles('admin', 'sourcing_procurement')
    async getValues(
        @Query('ownerType') ownerType: string,
        @Query('ownerId') ownerId: string,
        @Query('storeId') storeId?: string,
    ) {
        return {
            data: await this.metafieldsService.getValues({
                ownerType,
                ownerId,
                storeId: storeId || null,
            }),
        };
    }

    @Post('values')
    @Roles('admin', 'sourcing_procurement')
    async upsertValue(
        @Body() body: {
            ownerType: string;
            ownerId: string;
            definitionId: string;
            storeId?: string;
            valueJson: any;
        },
        @Req() req: any,
    ) {
        return {
            data: await this.metafieldsService.upsertValue({
                ...body,
                submittedBy: req.user?.id,
            }),
        };
    }

    @Patch('values/:id')
    @Roles('admin', 'sourcing_procurement')
    async updateValue(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: { valueJson: any },
        @Req() req: any,
    ) {
        const prisma = (this.metafieldsService as any).prisma;
        const existing = await prisma.metafieldValue.findUnique({ where: { id } });
        if (!existing) {
            return { statusCode: 404, message: 'MetafieldValue not found' };
        }
        return {
            data: await this.metafieldsService.upsertValue({
                ownerType: existing.ownerType,
                ownerId: existing.ownerId,
                definitionId: existing.definitionId,
                storeId: existing.storeId,
                valueJson: body.valueJson,
                submittedBy: req.user?.id,
            }),
        };
    }

    // ─── Approval Workflow ───────────────

    @Post('values/submit')
    @Roles('admin', 'sourcing_procurement')
    async submitForReview(
        @Body() body: { valueIds: string[] },
        @Req() req: any,
    ) {
        return await this.metafieldsService.submitForReview(body.valueIds, req.user?.id);
    }

    @Get('approval-queue')
    @Roles('admin')
    async getApprovalQueue(
        @Query('status') status?: string,
        @Query('ownerType') ownerType?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.metafieldsService.getApprovalQueue({
            status,
            ownerType,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }

    @Post('approve')
    @Roles('admin')
    async approveValue(
        @Body() body: { valueId?: string; valueIds?: string[] },
        @Req() req: any,
    ) {
        if (body.valueIds && body.valueIds.length > 0) {
            const result = await this.metafieldsService.bulkApprove(body.valueIds, req.user?.id);
            this.pushService.triggerPushForOwners(result.ownerIds).catch(() => { });
            return result;
        }
        if (body.valueId) {
            const result = await this.metafieldsService.approve(body.valueId, req.user?.id);
            this.pushService.triggerPushForOwners([result.ownerId]).catch(() => { });
            return { data: result };
        }
        return { message: 'No valueId or valueIds provided' };
    }

    @Post('reject')
    @Roles('admin')
    async rejectValue(
        @Body() body: { valueId: string; reason: string },
        @Req() req: any,
    ) {
        return {
            data: await this.metafieldsService.reject(body.valueId, req.user?.id, body.reason),
        };
    }

    // ─── Validation (Sprint 2.1) ─────────

    @Get('validate/:productId')
    @Roles('admin', 'sourcing_procurement')
    async getValidation(@Param('productId', ParseUUIDPipe) productId: string) {
        return this.catalogValidation.getProductValidation(productId);
    }

    @Post('revalidate/:productId')
    @Roles('admin', 'sourcing_procurement')
    async revalidateProduct(@Param('productId', ParseUUIDPipe) productId: string) {
        const results = await this.catalogValidation.revalidateProduct(productId);
        return {
            data: results,
            message: `Revalidated: ${results.filter(r => r.isValid).length}/${results.length} valid`,
        };
    }

    // ─── Pending Count ───────────────────

    @Get('pending-count')
    @Roles('admin')
    async getPendingCount() {
        return { count: await this.metafieldsService.getPendingCount() };
    }

    // ─── Taxonomy ────────────────────────

    @Get('taxonomy')
    @Roles('admin', 'sourcing_procurement')
    async getTaxonomy(@Query('q') q?: string) {
        return { data: q ? searchTaxonomy(q) : getTaxonomyCategories() };
    }

    // ─── Push (Sprint 2.1: scoped push) ──

    @Post('push')
    @Roles('admin')
    async triggerPush(@Body() body: PushParams) {
        const jobId = await this.pushService.triggerPush(body);
        return { data: { jobId }, message: 'Metafields push job started' };
    }

    @Post('push/product/:productId')
    @Roles('admin')
    async pushProduct(
        @Param('productId', ParseUUIDPipe) productId: string,
        @Query('storeId') storeId?: string,
    ) {
        const jobId = await this.pushService.triggerPushForProduct(productId, storeId);
        return { data: { jobId }, message: 'Product metafields push started' };
    }

    @Post('push/brand/:brandId')
    @Roles('admin')
    async pushBrand(
        @Param('brandId', ParseUUIDPipe) brandId: string,
        @Query('storeId') storeId?: string,
    ) {
        const jobId = await this.pushService.triggerPushForBrand(brandId, storeId);
        return { data: { jobId }, message: 'Brand metafields push started' };
    }
}
