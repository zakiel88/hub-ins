import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
    ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShopifyStoresService } from '../shopify-stores/shopify-stores.service';

@Injectable()
export class MetafieldsService {
    private readonly logger = new Logger(MetafieldsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly shopifyStores: ShopifyStoresService,
    ) { }

    // ═══════════════════════════════════════
    // Definitions CRUD
    // ═══════════════════════════════════════

    async getDefinitions(params: { ownerType?: string; isActive?: boolean }) {
        const where: any = {};
        if (params.ownerType) where.ownerType = params.ownerType;
        if (params.isActive !== undefined) where.isActive = params.isActive;

        return this.prisma.metafieldDefinition.findMany({
            where,
            orderBy: [{ namespace: 'asc' }, { key: 'asc' }],
            include: {
                _count: { select: { catalogSchemas: true, values: true } },
            },
        });
    }

    async createDefinition(data: {
        namespace?: string;
        key: string;
        type: string;
        ownerType: string;
        label?: string;
        description?: string;
        validationJson?: any;
    }) {
        return this.prisma.metafieldDefinition.create({
            data: {
                namespace: data.namespace || 'custom',
                key: data.key,
                type: data.type,
                ownerType: data.ownerType,
                label: data.label,
                description: data.description,
                validationJson: data.validationJson || null,
            },
        });
    }

    async updateDefinition(id: string, data: {
        label?: string;
        description?: string;
        validationJson?: any;
        isActive?: boolean;
        isRequired?: boolean;
    }) {
        const def = await this.prisma.metafieldDefinition.findUnique({ where: { id } });
        if (!def) throw new NotFoundException('Definition not found');

        return this.prisma.metafieldDefinition.update({
            where: { id },
            data: {
                label: data.label ?? def.label,
                description: data.description ?? def.description,
                validationJson: data.validationJson !== undefined ? data.validationJson : def.validationJson,
                isActive: data.isActive !== undefined ? data.isActive : def.isActive,
                isRequired: data.isRequired !== undefined ? data.isRequired : (def as any).isRequired,
            } as any,
        });
    }

    // ═══════════════════════════════════════
    // Catalog Metafield Schema CRUD
    // ═══════════════════════════════════════

    async getSchemaByCategory(categoryId: string) {
        return this.prisma.catalogMetafieldSchema.findMany({
            where: { shopifyCategoryId: categoryId },
            orderBy: { displayOrder: 'asc' },
            include: { definition: true },
        });
    }

    async addSchemaEntry(data: {
        shopifyCategoryId: string;
        definitionId: string;
        isRequired?: boolean;
        displayOrder?: number;
    }) {
        return this.prisma.catalogMetafieldSchema.create({
            data: {
                shopifyCategoryId: data.shopifyCategoryId,
                definitionId: data.definitionId,
                isRequired: data.isRequired ?? false,
                displayOrder: data.displayOrder ?? 0,
            },
            include: { definition: true },
        });
    }

    async updateSchemaEntry(id: string, data: { isRequired?: boolean; displayOrder?: number }) {
        return this.prisma.catalogMetafieldSchema.update({
            where: { id },
            data,
        });
    }

    async removeSchemaEntry(id: string) {
        return this.prisma.catalogMetafieldSchema.delete({ where: { id } });
    }

    // ═══════════════════════════════════════
    // Options Library CRUD
    // ═══════════════════════════════════════

    async getDefinitionsWithOptions(params: { ownerType?: string; hasCatalogSchema?: boolean }) {
        const where: any = { isActive: true };
        if (params.ownerType) where.ownerType = params.ownerType;

        // If hasCatalogSchema, only return definitions that have catalog schemas
        if (params.hasCatalogSchema === true) {
            where.catalogSchemas = { some: {} };
        } else if (params.hasCatalogSchema === false) {
            where.catalogSchemas = { none: {} };
        }

        return (this.prisma.metafieldDefinition as any).findMany({
            where,
            orderBy: [{ namespace: 'asc' }, { key: 'asc' }],
            include: {
                options: { orderBy: { sortOrder: 'asc' }, where: { isActive: true } },
                _count: { select: { options: true, values: true, catalogSchemas: true } },
            },
        });
    }

    async addOption(definitionId: string, value: string, label?: string) {
        const def = await this.prisma.metafieldDefinition.findUnique({ where: { id: definitionId } });
        if (!def) throw new NotFoundException('Definition not found');

        return (this.prisma as any).metafieldDefinitionOption.create({
            data: { definitionId, value, label: label || null },
        });
    }

    async removeOption(optionId: string) {
        return (this.prisma as any).metafieldDefinitionOption.delete({ where: { id: optionId } });
    }

    async bulkAddOptions(definitionId: string, values: string[]) {
        const def = await this.prisma.metafieldDefinition.findUnique({ where: { id: definitionId } });
        if (!def) throw new NotFoundException('Definition not found');

        let created = 0;
        let skipped = 0;
        for (const val of values) {
            const trimmed = val.trim();
            if (!trimmed) continue;
            try {
                await (this.prisma as any).metafieldDefinitionOption.create({
                    data: { definitionId, value: trimmed },
                });
                created++;
            } catch (err: any) {
                if (err.code === 'P2002') { skipped++; }
                else throw err;
            }
        }
        return { created, skipped };
    }

    /**
     * Auto-populate options by scanning existing metafield values from Shopify products.
     * Fetches metafield values from sample products and extracts distinct values.
     */
    async autoPopulateOptions(definitionId: string) {
        const def = await this.prisma.metafieldDefinition.findUnique({ where: { id: definitionId } });
        if (!def) throw new NotFoundException('Definition not found');

        // Get stores
        const stores = await this.prisma.shopifyStore.findMany({ where: { isActive: true } });
        const distinctValues = new Set<string>();

        for (const store of stores) {
            try {
                const { token } = await this.shopifyStores.getValidToken(store.id);

                // Get product maps
                const maps = await this.prisma.shopifyProductMap.findMany({
                    where: { storeId: store.id },
                    take: 100, // Sample 100 products
                });

                for (const pm of maps) {
                    try {
                        const url = `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/products/${pm.shopifyProductId}/metafields.json?namespace=${def.namespace}&key=${def.key}`;
                        const res = await fetch(url, {
                            headers: { 'X-Shopify-Access-Token': token },
                        });

                        if (res.ok) {
                            const data: any = await res.json();
                            for (const mf of (data.metafields || [])) {
                                if (mf.value) {
                                    // Handle list types (JSON arrays) and single values
                                    try {
                                        const parsed = JSON.parse(mf.value);
                                        if (Array.isArray(parsed)) {
                                            parsed.forEach((v: any) => {
                                                if (typeof v === 'string' && v.trim()) distinctValues.add(v.trim());
                                            });
                                        } else {
                                            distinctValues.add(String(mf.value).trim());
                                        }
                                    } catch {
                                        if (typeof mf.value === 'string' && mf.value.trim()) {
                                            distinctValues.add(mf.value.trim());
                                        }
                                    }
                                }
                            }
                        }
                        await new Promise(r => setTimeout(r, 250)); // Rate limit
                    } catch { /* skip */ }
                }
            } catch (err: any) {
                this.logger.warn(`Auto-populate error for ${store.storeName}: ${err.message}`);
            }
        }

        // Bulk create options
        let created = 0;
        for (const val of distinctValues) {
            try {
                await (this.prisma as any).metafieldDefinitionOption.create({
                    data: { definitionId, value: val },
                });
                created++;
            } catch (err: any) {
                if (err.code !== 'P2002') this.logger.warn(`Option create error: ${err.message}`);
            }
        }

        return { discovered: distinctValues.size, created };
    }

    // ═══════════════════════════════════════
    // Metafield Values CRUD
    // ═══════════════════════════════════════

    async getAllValuesGrouped(params: {
        ownerType?: string;
        page?: number;
        limit?: number;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 100;
        const skip = (page - 1) * limit;
        const where: any = {};
        if (params.ownerType) where.ownerType = params.ownerType;

        const [data, total] = await Promise.all([
            this.prisma.metafieldValue.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ ownerType: 'asc' }, { ownerId: 'asc' }, { createdAt: 'desc' }],
                include: {
                    definition: true,
                    store: { select: { id: true, storeName: true } },
                    submitter: { select: { id: true, fullName: true } },
                    reviewer: { select: { id: true, fullName: true } },
                },
            }),
            this.prisma.metafieldValue.count({ where }),
        ]);

        // Enrich with product names
        const productIds = [...new Set(data.filter(v => v.ownerType === 'PRODUCT').map(v => v.ownerId))];
        const products = productIds.length > 0
            ? await this.prisma.product.findMany({
                where: { id: { in: productIds } },
                select: { id: true, name: true },
            })
            : [];
        const productMap = new Map(products.map(p => [p.id, p.name]));

        const enriched = data.map(v => ({
            ...v,
            ownerName: v.ownerType === 'PRODUCT' ? productMap.get(v.ownerId) || v.ownerId : v.ownerId,
        }));

        return { data: enriched, meta: { page, limit, total } };
    }

    async getValues(params: {
        ownerType: string;
        ownerId: string;
        storeId?: string | null;
    }) {
        const where: any = {
            ownerType: params.ownerType,
            ownerId: params.ownerId,
        };
        // If storeId provided, get both global + store-specific
        // If not provided, get only global
        if (params.storeId) {
            where.OR = [
                { storeId: null },
                { storeId: params.storeId },
            ];
            delete where.ownerType;
            delete where.ownerId;
            return this.prisma.metafieldValue.findMany({
                where: {
                    ownerType: params.ownerType,
                    ownerId: params.ownerId,
                    OR: [{ storeId: null }, { storeId: params.storeId }],
                },
                include: {
                    definition: true,
                    submitter: { select: { id: true, fullName: true } },
                    reviewer: { select: { id: true, fullName: true } },
                },
                orderBy: { createdAt: 'desc' },
            });
        }

        return this.prisma.metafieldValue.findMany({
            where: {
                ownerType: params.ownerType,
                ownerId: params.ownerId,
                storeId: null,
            },
            include: {
                definition: true,
                submitter: { select: { id: true, fullName: true } },
                reviewer: { select: { id: true, fullName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async upsertValue(data: {
        ownerType: string;
        ownerId: string;
        definitionId: string;
        storeId?: string | null;
        valueJson: any;
        submittedBy?: string;
    }) {
        // Check if value already exists
        const existing = await this.prisma.metafieldValue.findFirst({
            where: {
                ownerType: data.ownerType,
                ownerId: data.ownerId,
                definitionId: data.definitionId,
                storeId: data.storeId || null,
            },
        });

        if (existing) {
            return this.prisma.metafieldValue.update({
                where: { id: existing.id },
                data: {
                    valueJson: data.valueJson,
                    status: 'DRAFT', // Reset to draft on edit
                    submittedBy: data.submittedBy || existing.submittedBy,
                    reviewerId: null,
                    reviewedAt: null,
                    rejectionReason: null,
                },
                include: { definition: true },
            });
        }

        return this.prisma.metafieldValue.create({
            data: {
                ownerType: data.ownerType,
                ownerId: data.ownerId,
                definitionId: data.definitionId,
                storeId: data.storeId || null,
                valueJson: data.valueJson,
                status: 'DRAFT',
                submittedBy: data.submittedBy || null,
            },
            include: { definition: true },
        });
    }

    // ═══════════════════════════════════════
    // Approval Workflow
    // ═══════════════════════════════════════

    async submitForReview(valueIds: string[], submittedBy: string) {
        const values = await this.prisma.metafieldValue.findMany({
            where: { id: { in: valueIds }, status: 'DRAFT' },
        });

        if (values.length === 0) {
            throw new BadRequestException('No DRAFT values found to submit');
        }

        await this.prisma.metafieldValue.updateMany({
            where: { id: { in: values.map(v => v.id) } },
            data: {
                status: 'PENDING_REVIEW',
                submittedBy,
            },
        });

        return { submitted: values.length };
    }

    async getApprovalQueue(params: {
        status?: string;
        ownerType?: string;
        page?: number;
        limit?: number;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 50;
        const skip = (page - 1) * limit;

        const where: any = {
            status: params.status || 'PENDING_REVIEW',
        };
        if (params.ownerType) where.ownerType = params.ownerType;

        const [data, total] = await Promise.all([
            this.prisma.metafieldValue.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'asc' },
                include: {
                    definition: true,
                    store: { select: { id: true, storeName: true } },
                    submitter: { select: { id: true, fullName: true } },
                    reviewer: { select: { id: true, fullName: true } },
                },
            }),
            this.prisma.metafieldValue.count({ where }),
        ]);

        return { data, meta: { page, limit, total } };
    }

    async approve(valueId: string, reviewerId: string) {
        const value = await this.prisma.metafieldValue.findUnique({
            where: { id: valueId },
            include: { definition: true },
        });
        if (!value) throw new NotFoundException('MetafieldValue not found');
        if (value.status !== 'PENDING_REVIEW') {
            throw new BadRequestException('Only PENDING_REVIEW values can be approved');
        }

        const updated = await this.prisma.metafieldValue.update({
            where: { id: valueId },
            data: {
                status: 'APPROVED',
                reviewerId,
                reviewedAt: new Date(),
                rejectionReason: null,
            },
            include: { definition: true },
        });

        this.logger.log(`Metafield approved: ${value.definition.namespace}.${value.definition.key} for ${value.ownerType}:${value.ownerId}`);

        return updated;
    }

    async reject(valueId: string, reviewerId: string, reason: string) {
        const value = await this.prisma.metafieldValue.findUnique({ where: { id: valueId } });
        if (!value) throw new NotFoundException('MetafieldValue not found');
        if (value.status !== 'PENDING_REVIEW') {
            throw new BadRequestException('Only PENDING_REVIEW values can be rejected');
        }

        return this.prisma.metafieldValue.update({
            where: { id: valueId },
            data: {
                status: 'REJECTED',
                reviewerId,
                reviewedAt: new Date(),
                rejectionReason: reason,
            },
            include: { definition: true },
        });
    }

    async bulkApprove(valueIds: string[], reviewerId: string) {
        const values = await this.prisma.metafieldValue.findMany({
            where: { id: { in: valueIds }, status: 'PENDING_REVIEW' },
        });

        if (values.length === 0) {
            throw new BadRequestException('No PENDING_REVIEW values found');
        }

        await this.prisma.metafieldValue.updateMany({
            where: { id: { in: values.map(v => v.id) } },
            data: {
                status: 'APPROVED',
                reviewerId,
                reviewedAt: new Date(),
                rejectionReason: null,
            },
        });

        return { approved: values.length, ownerIds: [...new Set(values.map(v => v.ownerId))] };
    }

    // ═══════════════════════════════════════
    // Required Validation (Schema-based)
    // ═══════════════════════════════════════

    async validateRequired(productId: string): Promise<{
        valid: boolean;
        missing: { namespace: string; key: string; label: string | null; ownerType: string }[];
    }> {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            select: { shopifyCategoryId: true, id: true },
        });

        if (!product || !product.shopifyCategoryId) {
            return { valid: true, missing: [] }; // No category = no required metafields
        }

        // Get required definitions for this category
        const requiredSchemas = await this.prisma.catalogMetafieldSchema.findMany({
            where: {
                shopifyCategoryId: product.shopifyCategoryId,
                isRequired: true,
            },
            include: { definition: true },
        });

        if (requiredSchemas.length === 0) return { valid: true, missing: [] };

        // Check which PRODUCT-level required definitions have APPROVED global values
        const productDefs = requiredSchemas.filter(s => s.definition.ownerType === 'PRODUCT');
        const productValues = await this.prisma.metafieldValue.findMany({
            where: {
                ownerType: 'PRODUCT',
                ownerId: productId,
                storeId: null, // V1: only check global
                status: 'APPROVED',
                definitionId: { in: productDefs.map(d => d.definitionId) },
            },
        });

        const approvedDefIds = new Set(productValues.map(v => v.definitionId));
        const missing = productDefs
            .filter(s => !approvedDefIds.has(s.definitionId))
            .map(s => ({
                namespace: s.definition.namespace,
                key: s.definition.key,
                label: s.definition.label,
                ownerType: s.definition.ownerType,
            }));

        // TODO: For VARIANT-level, check all variants of the product

        return { valid: missing.length === 0, missing };
    }

    // ═══════════════════════════════════════
    // Effective Value Resolver (store override > global)
    // ═══════════════════════════════════════

    async getEffectiveValues(ownerType: string, ownerId: string, storeId: string) {
        const [storeValues, globalValues] = await Promise.all([
            this.prisma.metafieldValue.findMany({
                where: { ownerType, ownerId, storeId, status: 'APPROVED' },
                include: { definition: true },
            }),
            this.prisma.metafieldValue.findMany({
                where: { ownerType, ownerId, storeId: null, status: 'APPROVED' },
                include: { definition: true },
            }),
        ]);

        // Store-specific overrides global
        const effectiveMap = new Map<string, typeof globalValues[0]>();
        for (const v of globalValues) effectiveMap.set(v.definitionId, v);
        for (const v of storeValues) effectiveMap.set(v.definitionId, v); // Override

        return Array.from(effectiveMap.values());
    }

    // ═══════════════════════════════════════
    // Stats for sidebar badge
    // ═══════════════════════════════════════

    async getPendingCount() {
        return this.prisma.metafieldValue.count({
            where: { status: 'PENDING_REVIEW' },
        });
    }

    // ═══════════════════════════════════════
    // Sync Definitions from Shopify
    // ═══════════════════════════════════════

    async syncDefinitionsFromShopify(storeId?: string, jobId?: string) {
        const storeFilter: any = { isActive: true };
        if (storeId) storeFilter.id = storeId;

        const stores = await this.prisma.shopifyStore.findMany({ where: storeFilter });
        if (stores.length === 0) throw new NotFoundException('No active stores found');

        await this.addSyncLog(jobId, 'info', `Starting sync for ${stores.length} store(s)`);

        let totalCreated = 0;
        let totalUpdated = 0;
        let totalSkipped = 0;
        const perStore: { storeName: string; created: number; updated: number; discovered: number; errors: string[] }[] = [];

        for (const store of stores) {
            const storeResult = { storeName: store.storeName, created: 0, updated: 0, discovered: 0, errors: [] as string[] };
            await this.addSyncLog(jobId, 'info', `🏪 Processing store: ${store.storeName} (${store.shopifyDomain})`);

            try {
                const { token } = await this.shopifyStores.getValidToken(store.id);
                await this.addSyncLog(jobId, 'info', `✓ Token obtained for ${store.storeName}`);

                // ── Phase 1: Fetch formal definitions from Shopify ──
                for (const { resource, ownerType } of [
                    { resource: 'product', ownerType: 'PRODUCT' },
                    { resource: 'variant', ownerType: 'VARIANT' },
                ]) {
                    try {
                        const defs = await this.fetchShopifyMetafieldDefinitions(
                            store.shopifyDomain, token, store.apiVersion, resource,
                        );
                        await this.addSyncLog(jobId, 'info', `Phase 1: ${defs.length} ${resource} definitions from ${store.storeName}`);

                        for (const def of defs) {
                            const result = await this.upsertDefinition(def.namespace, def.key, ownerType, {
                                label: def.name, description: def.description,
                                type: this.mapShopifyType(def.type),
                                validations: def.validations,
                            });
                            if (result === 'created') { storeResult.created++; totalCreated++; }
                            else if (result === 'updated') { storeResult.updated++; totalUpdated++; }
                            else { totalSkipped++; }
                        }
                    } catch (err: any) {
                        await this.addSyncLog(jobId, 'error', `Phase 1 ${resource} error for ${store.storeName}: ${err.message}`);
                        storeResult.errors.push(`definitions/${resource}: ${err.message}`);
                    }
                }

                // ── Phase 2: Discover definitions from actual product metafield values ──
                try {
                    const discovered = await this.discoverFromProductMetafields(
                        store.shopifyDomain, token, store.apiVersion, store.storeName, jobId,
                    );
                    storeResult.discovered = discovered.total;
                    totalCreated += discovered.created;
                    totalUpdated += discovered.updated;
                    storeResult.created += discovered.created;
                    storeResult.updated += discovered.updated;
                    await this.addSyncLog(jobId, 'info', `Phase 2 done for ${store.storeName}: ${discovered.total} unique keys, ${discovered.created} created`);
                } catch (err: any) {
                    await this.addSyncLog(jobId, 'error', `Phase 2 error for ${store.storeName}: ${err.message}`);
                    storeResult.errors.push(`product-scan: ${err.message}`);
                }

            } catch (err: any) {
                await this.addSyncLog(jobId, 'error', `Auth error for ${store.storeName}: ${err.message}`);
                storeResult.errors.push(`Auth: ${err.message}`);
            }

            await this.addSyncLog(jobId, 'info', `📊 ${store.storeName} result: ${storeResult.created} created, ${storeResult.updated} updated, errors: ${storeResult.errors.length}`);
            perStore.push(storeResult);
        }

        await this.addSyncLog(jobId, 'info', `✅ TOTAL: ${totalCreated} created, ${totalUpdated} updated, ${totalSkipped} skipped`);

        return {
            created: totalCreated,
            updated: totalUpdated,
            skipped: totalSkipped,
            stores: perStore,
        };
    }

    /**
     * Sync metafield VALUES from Shopify products into MetafieldValue table.
     * Iterates all ShopifyProductMap entries, fetches metafields for each product,
     * matches to local definitions, and creates MetafieldValue entries.
     */
    async syncValuesFromShopify(storeId?: string) {
        const storeFilter: any = { isActive: true };
        if (storeId) storeFilter.id = storeId;

        const stores = await this.prisma.shopifyStore.findMany({ where: storeFilter });
        if (stores.length === 0) throw new NotFoundException('No active stores found');

        // Pre-load all definitions for matching
        const allDefs = await this.prisma.metafieldDefinition.findMany();
        const defMap = new Map<string, any>();
        for (const d of allDefs) {
            defMap.set(`${d.namespace}.${d.key}.${d.ownerType}`, d);
        }

        let totalCreated = 0;
        let totalUpdated = 0;
        let totalSkipped = 0;
        let defsCreated = 0;
        const perStore: { storeName: string; products: number; valuesCreated: number; valuesUpdated: number; errors: string[] }[] = [];

        for (const store of stores) {
            const sr = { storeName: store.storeName, products: 0, valuesCreated: 0, valuesUpdated: 0, errors: [] as string[] };

            try {
                const { token } = await this.shopifyStores.getValidToken(store.id);

                const productMaps = await this.prisma.shopifyProductMap.findMany({
                    where: { storeId: store.id },
                    include: { product: { select: { id: true, name: true } } },
                });

                this.logger.log(`Syncing values for ${productMaps.length} products from ${store.storeName}`);

                for (const pm of productMaps) {
                    try {
                        const mfUrl = `https://${store.shopifyDomain}/admin/api/${store.apiVersion}/products/${pm.shopifyProductId}/metafields.json`;
                        const mfRes = await fetch(mfUrl, {
                            headers: { 'X-Shopify-Access-Token': token },
                        });

                        if (!mfRes.ok) {
                            if (mfRes.status === 429) {
                                await new Promise(r => setTimeout(r, 2000));
                                continue;
                            }
                            sr.errors.push(`Product ${pm.shopifyProductId}: HTTP ${mfRes.status}`);
                            continue;
                        }

                        const mfData: any = await mfRes.json();
                        const metafields = mfData.metafields || [];
                        sr.products++;

                        for (const mf of metafields) {
                            const defKey = `${mf.namespace}.${mf.key}.PRODUCT`;
                            let def = defMap.get(defKey);

                            // Auto-create definition if not found
                            if (!def) {
                                try {
                                    def = await this.prisma.metafieldDefinition.create({
                                        data: {
                                            namespace: mf.namespace, key: mf.key,
                                            type: mf.type || 'single_line_text_field',
                                            ownerType: 'PRODUCT', isActive: true,
                                        } as any,
                                    });
                                    defMap.set(defKey, def);
                                    defsCreated++;
                                } catch (err: any) {
                                    if (err.code === 'P2002') {
                                        def = await this.prisma.metafieldDefinition.findFirst({
                                            where: { namespace: mf.namespace, key: mf.key, ownerType: 'PRODUCT' },
                                        });
                                        if (def) defMap.set(defKey, def);
                                    }
                                    if (!def) continue;
                                }
                            }

                            // Upsert MetafieldValue
                            try {
                                const existing = await this.prisma.metafieldValue.findFirst({
                                    where: {
                                        ownerType: 'PRODUCT', ownerId: pm.productId,
                                        definitionId: def.id, storeId: store.id,
                                    },
                                });

                                if (existing) {
                                    const oldVal = JSON.stringify(existing.valueJson);
                                    const newVal = JSON.stringify(mf.value);
                                    if (oldVal !== newVal) {
                                        await this.prisma.metafieldValue.update({
                                            where: { id: existing.id },
                                            data: { valueJson: mf.value },
                                        });
                                        sr.valuesUpdated++;
                                        totalUpdated++;
                                    } else {
                                        totalSkipped++;
                                    }
                                } else {
                                    await this.prisma.metafieldValue.create({
                                        data: {
                                            ownerType: 'PRODUCT', ownerId: pm.productId,
                                            definitionId: def.id, storeId: store.id,
                                            valueJson: mf.value, status: 'APPROVED',
                                        },
                                    });
                                    sr.valuesCreated++;
                                    totalCreated++;
                                }
                            } catch (err: any) {
                                sr.errors.push(`${mf.namespace}.${mf.key} → ${pm.product.name}: ${err.message}`);
                            }
                        }

                        await new Promise(r => setTimeout(r, 500)); // Rate limit
                    } catch (err: any) {
                        sr.errors.push(`Product ${pm.shopifyProductId}: ${err.message}`);
                    }
                }
            } catch (err: any) {
                sr.errors.push(`Auth: ${err.message}`);
            }

            perStore.push(sr);
        }

        return { created: totalCreated, updated: totalUpdated, skipped: totalSkipped, defsCreated, stores: perStore };
    }

    /**
     * Phase 2: Scan actual product metafield values to discover definitions
     * that exist on products but weren't formally registered as definitions.
     */
    private async discoverFromProductMetafields(
        domain: string, token: string, apiVersion: string, storeName: string, jobId?: string,
    ) {
        let created = 0;
        let updated = 0;
        const seen = new Set<string>(); // namespace.key.ownerType

        // Fetch a sample of products (max 50) to discover metafield patterns
        const productsUrl = `https://${domain}/admin/api/${apiVersion}/products.json?limit=20&fields=id,title`;
        const productsRes = await fetch(productsUrl, {
            headers: { 'X-Shopify-Access-Token': token },
        });
        if (!productsRes.ok) throw new Error(`Products API ${productsRes.status}`);
        const productsData: any = await productsRes.json();
        const products = productsData.products || [];

        await this.addSyncLog(jobId, 'info', `Phase 2: Scanning metafields from ${products.length} products on ${storeName}`);

        for (const product of products) {
            // Product-level metafields
            try {
                const mfUrl = `https://${domain}/admin/api/${apiVersion}/products/${product.id}/metafields.json`;
                const mfRes = await fetch(mfUrl, {
                    headers: { 'X-Shopify-Access-Token': token },
                });

                if (mfRes.ok) {
                    const mfData: any = await mfRes.json();
                    const metafields = mfData.metafields || [];

                    for (const mf of metafields) {
                        const dedupeKey = `${mf.namespace}.${mf.key}.PRODUCT`;
                        if (seen.has(dedupeKey)) continue;
                        seen.add(dedupeKey);

                        const result = await this.upsertDefinition(mf.namespace, mf.key, 'PRODUCT', {
                            type: mf.type || 'single_line_text_field',
                            label: null, description: null, validations: null,
                        });
                        if (result === 'created') created++;
                        else if (result === 'updated') updated++;
                    }
                }
            } catch (err: any) {
                this.logger.warn(`Metafield scan error for product ${product.id}: ${err.message}`);
            }

            // Rate limit: Shopify allows ~2 req/sec
            await new Promise(r => setTimeout(r, 500));
        }

        this.logger.log(`Phase 2 done for ${storeName}: ${seen.size} unique metafield keys found, ${created} created, ${updated} updated`);
        return { total: seen.size, created, updated };
    }

    /**
     * Upsert a metafield definition by namespace+key+ownerType
     */
    private async upsertDefinition(
        namespace: string, key: string, ownerType: string,
        meta: { type?: string; label?: string | null; description?: string | null; validations?: any },
    ): Promise<'created' | 'updated' | 'skipped'> {
        try {
            const existing = await this.prisma.metafieldDefinition.findFirst({
                where: { namespace, key, ownerType },
            });

            if (existing) {
                // Only update if we have richer info
                const needsUpdate = (meta.label && !existing.label) ||
                    (meta.description && !existing.description) ||
                    (meta.type && meta.type !== existing.type);

                if (needsUpdate) {
                    await this.prisma.metafieldDefinition.update({
                        where: { id: existing.id },
                        data: {
                            label: meta.label || existing.label,
                            description: meta.description || existing.description,
                            type: meta.type || existing.type,
                        },
                    });
                    return 'updated';
                }
                return 'skipped';
            }

            await this.prisma.metafieldDefinition.create({
                data: {
                    namespace,
                    key,
                    type: meta.type || 'single_line_text_field',
                    ownerType,
                    label: meta.label || null,
                    description: meta.description || null,
                    validationJson: meta.validations?.length ? meta.validations : null,
                    isActive: true,
                },
            });
            return 'created';
        } catch (err: any) {
            if (err.code === 'P2002') return 'skipped';
            throw err;
        }
    }

    private async fetchShopifyMetafieldDefinitions(
        domain: string, token: string, apiVersion: string, ownerResource: string,
    ): Promise<any[]> {
        const allDefs: any[] = [];
        let url: string | null =
            `https://${domain}/admin/api/${apiVersion}/metafield_definitions.json?owner_resource=${ownerResource}&limit=250`;

        while (url) {
            const res = await fetch(url, {
                headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
            });

            if (!res.ok) {
                const body = await res.text();
                throw new Error(`Shopify API ${res.status}: ${body.substring(0, 300)}`);
            }

            const data: any = await res.json();
            allDefs.push(...(data.metafield_definitions || []));

            const linkHeader = res.headers.get('Link') || '';
            const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
            url = nextMatch ? nextMatch[1] : null;

            if (url) await new Promise(r => setTimeout(r, 500));
        }

        return allDefs;
    }

    private mapShopifyType(type: any): string {
        if (typeof type === 'string') return type;
        if (type?.name) return type.name;
        if (type?.key) return type.key;
        return 'single_line_text_field';
    }

    // ─── Sync Job helpers (background job pattern) ───
    async createSyncJob(jobType: string, storeId?: string) {
        return this.prisma.syncJob.create({
            data: {
                storeId: storeId || null,
                jobType,
                status: 'running',
                startedAt: new Date(),
            },
        });
    }

    async completeSyncJob(jobId: string, status: 'success' | 'failed', result?: any, errorMsg?: string) {
        // Collect per-store errors if available
        const storeErrors = result?.stores
            ?.filter((s: any) => s.errors?.length > 0)
            ?.map((s: any) => `${s.storeName}: ${s.errors.join('; ')}`)
            ?.join(' | ') || null;

        await this.prisma.syncJob.update({
            where: { id: jobId },
            data: {
                status,
                completedAt: new Date(),
                processed: (result?.created || 0) + (result?.updated || 0),
                totalItems: (result?.created || 0) + (result?.updated || 0) + (result?.skipped || 0),
                errorMsg: errorMsg || storeErrors || null,
            },
        });
    }

    // ─── Job logging helper ───
    private async addSyncLog(jobId: string | undefined, level: string, message: string, data?: any) {
        this.logger.log(`[Sync] ${message}`);
        if (!jobId) return;
        try {
            await this.prisma.syncJobLog.create({
                data: { jobId, level, message, data: data || undefined },
            });
        } catch { /* ignore log failures */ }
    }
}
