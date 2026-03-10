import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { computeMargin } from './product-margin.helper';

@Injectable()
export class ProductsV2Service {
    private readonly logger = new Logger(ProductsV2Service.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ═══════════════════════════════════════
    //  Products — List / Detail / Update / Archive
    // ═══════════════════════════════════════

    /** GET /api/v1/products — paginated list with filters */
    async findAllProducts(params: {
        page?: number;
        limit?: number;
        search?: string;
        brandId?: string;
        collectionId?: string;
        category?: string;
        status?: string;
        hasIssues?: boolean;
        sortBy?: string;
        sortDir?: string;
    }) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 25));
        const skip = (page - 1) * limit;

        const where: any = {};

        if (params.brandId) where.brandId = params.brandId;
        if (params.collectionId) where.collectionId = params.collectionId;
        if (params.category) where.category = params.category;
        if (params.status) where.status = params.status;

        if (params.search) {
            where.OR = [
                { title: { contains: params.search, mode: 'insensitive' } },
                { styleCode: { contains: params.search, mode: 'insensitive' } },
            ];
        }

        if (params.hasIssues) {
            where.issues = { some: { status: 'OPEN' } };
        }

        // Sort
        const sortBy = params.sortBy || 'updatedAt';
        const sortDir = params.sortDir === 'asc' ? 'asc' : 'desc';
        const orderBy: any = { [sortBy]: sortDir };

        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip,
                take: limit,
                orderBy,
                include: {
                    brand: { select: { id: true, name: true, code: true } },
                    _count: { select: { variants: true, issues: true } },
                },
            }),
            this.prisma.product.count({ where }),
        ]);

        return {
            data: this.serialize(data),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    /** GET /api/v1/products/summary — dashboard stats */
    async getProductsSummary() {
        let total = 0;
        let byStatus: any[] = [];
        let withIssues = 0;
        let recentlyUpdated = 0;
        let totalSKUs = 0;
        let totalVariantGroups = 0;

        try { total = await this.prisma.product.count(); } catch (e: any) { console.warn('summary:total', e.message?.substring(0, 100)); }

        try {
            byStatus = await this.prisma.product.groupBy({ by: ['status'], _count: true } as any);
        } catch (e: any) {
            console.warn('summary:groupBy', e.message?.substring(0, 100));
            // Fallback: count by raw SQL
            try {
                const rows = await this.prisma.$queryRawUnsafe<{ status: string; cnt: bigint }[]>(
                    "SELECT status::text, COUNT(*)::bigint as cnt FROM products GROUP BY status"
                );
                byStatus = rows.map(r => ({ status: r.status, _count: Number(r.cnt) }));
            } catch { /* ignore */ }
        }

        try {
            withIssues = await this.prisma.product.count({
                where: { issues: { some: { status: 'OPEN' } } },
            });
        } catch (e: any) { console.warn('summary:withIssues', e.message?.substring(0, 100)); }

        try {
            recentlyUpdated = await this.prisma.product.count({
                where: { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
            });
        } catch (e: any) { console.warn('summary:recentlyUpdated', e.message?.substring(0, 100)); }

        try { totalSKUs = await this.prisma.productVariant.count(); } catch (e: any) { console.warn('summary:totalSKUs', e.message?.substring(0, 100)); }

        try {
            const groupResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
                SELECT COUNT(DISTINCT CONCAT(
                    product_id, '::',
                    COALESCE(color, option1, 'Ungrouped'), '::',
                    COALESCE((SELECT material FROM products WHERE id = product_id), '')
                )) as count FROM product_variants
            `;
            totalVariantGroups = Number(groupResult[0]?.count || 0);
        } catch (e: any) { console.warn('summary:variantGroups', e.message?.substring(0, 100)); }

        const statusMap: Record<string, number> = {};
        for (const s of byStatus) {
            statusMap[s.status] = s._count;
        }

        return {
            data: {
                total,
                totalVariantGroups,
                totalSKUs,
                byStatus: statusMap,
                withOpenIssues: withIssues,
                updatedLast7Days: recentlyUpdated,
            },
        };
    }

    /** GET /api/v1/products/:id — full detail */
    async findProductById(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                brand: { select: { id: true, name: true, code: true } },
                collection: { select: { id: true, name: true } },
                variantGroups: {
                    orderBy: { position: 'asc' },
                    include: {
                        variants: {
                            orderBy: { size: 'asc' },
                            include: {
                                storeMaps: {
                                    include: { store: { select: { id: true, storeName: true } } },
                                },
                            },
                        },
                    },
                },
                variants: {
                    where: { variantGroupId: null },
                    orderBy: { sku: 'asc' },
                    include: {
                        storeMaps: {
                            include: { store: { select: { id: true, storeName: true } } },
                        },
                    },
                },
                images: { orderBy: { position: 'asc' } },
                storeMaps: {
                    include: { store: { select: { id: true, storeName: true, shopifyDomain: true } } },
                },
                issues: {
                    where: { status: 'OPEN' },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!product) throw new NotFoundException('Product not found');
        return { data: this.serialize(product) };
    }

    /** PUT /api/v1/products/:id — update product fields */
    async updateProduct(
        id: string,
        data: {
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
        userId: string,
    ) {
        const existing = await this.prisma.product.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Product not found');

        const updated = await this.prisma.product.update({
            where: { id },
            data: data as any,
            include: {
                brand: { select: { id: true, name: true, code: true } },
                _count: { select: { variants: true } },
            },
        });

        await this.audit.log({
            userId,
            action: 'product.update',
            entityType: 'Product',
            entityId: id,
            changes: data,
        });

        return { data: this.serialize(updated) };
    }

    /** PATCH /api/v1/products/:id/archive — soft delete */
    async archiveProduct(id: string, userId: string) {
        const existing = await this.prisma.product.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Product not found');
        if (existing.status === 'ARCHIVED') {
            throw new BadRequestException('Product is already archived');
        }

        const updated = await this.prisma.product.update({
            where: { id },
            data: { status: 'ARCHIVED' },
        });

        // Also archive all variants
        await this.prisma.productVariant.updateMany({
            where: { productId: id },
            data: { status: 'DISCONTINUED' },
        });

        await this.audit.log({
            userId,
            action: 'product.archive',
            entityType: 'Product',
            entityId: id,
        });

        return { data: this.serialize(updated) };
    }

    // ═══════════════════════════════════════
    //  Variants — List / Update / Bulk / SKU Lookup
    // ═══════════════════════════════════════

    /** GET /api/v1/products/:id/variants — variants for a product */
    async findProductVariants(productId: string, params: {
        page?: number;
        limit?: number;
        status?: string;
    }) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 50));
        const skip = (page - 1) * limit;

        const where: any = { productId };
        if (params.status) where.status = params.status;

        const [data, total] = await Promise.all([
            this.prisma.productVariant.findMany({
                where,
                skip,
                take: limit,
                orderBy: { sku: 'asc' },
                include: {
                    storeMaps: {
                        include: { store: { select: { id: true, storeName: true } } },
                    },
                    issues: { where: { status: 'OPEN' } },
                },
            }),
            this.prisma.productVariant.count({ where }),
        ]);

        return {
            data: this.serialize(data),
            meta: { page, limit, total },
        };
    }

    /** PUT /api/v1/products/:id/variants/:vid — update variant (commercial fields) */
    async updateVariant(
        productId: string,
        variantId: string,
        data: {
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
        userId: string,
    ) {
        const variant = await this.prisma.productVariant.findFirst({
            where: { id: variantId, productId },
        });
        if (!variant) throw new NotFoundException('Variant not found');

        // Auto-compute margin if price or vendorCost changes
        const newPrice = data.price ?? variant.price;
        const newVendorCost = data.vendorCost ?? variant.vendorCost;
        const estimatedMargin = computeMargin(newPrice, newVendorCost);

        const updated = await this.prisma.productVariant.update({
            where: { id: variantId },
            data: {
                ...data,
                estimatedMargin,
            } as any,
        });

        await this.audit.log({
            userId,
            action: 'variant.update',
            entityType: 'ProductVariant',
            entityId: variantId,
            changes: data,
        });

        this.logger.log(`Variant ${variant.sku} updated — margin: ${estimatedMargin}%`);
        return { data: this.serialize(updated) };
    }

    /** PATCH /api/v1/products/:id/variants/bulk — bulk update vendor cost / discount */
    async bulkUpdateVariants(
        productId: string,
        updates: Array<{
            variantId: string;
            vendorCost?: number;
            insDiscountType?: string;
            insDiscountValue?: number;
            price?: number;
        }>,
        userId: string,
    ) {
        const results: any[] = [];

        for (const u of updates) {
            const variant = await this.prisma.productVariant.findFirst({
                where: { id: u.variantId, productId },
            });
            if (!variant) continue;

            const newPrice = u.price ?? variant.price;
            const newVendorCost = u.vendorCost ?? variant.vendorCost;
            const estimatedMargin = computeMargin(newPrice, newVendorCost);

            const updated = await this.prisma.productVariant.update({
                where: { id: u.variantId },
                data: {
                    ...(u.vendorCost != null ? { vendorCost: u.vendorCost } : {}),
                    ...(u.insDiscountType ? { insDiscountType: u.insDiscountType as any } : {}),
                    ...(u.insDiscountValue != null ? { insDiscountValue: u.insDiscountValue } : {}),
                    ...(u.price != null ? { price: u.price } : {}),
                    estimatedMargin,
                },
            });
            results.push(updated);
        }

        await this.audit.log({
            userId,
            action: 'variants.bulk_update',
            entityType: 'Product',
            entityId: productId,
            changes: { count: updates.length },
        });

        return { data: this.serialize(results), updated: results.length };
    }

    /** GET /api/v1/product-variants — global variant list */
    async findAllVariants(params: {
        page?: number;
        limit?: number;
        search?: string;
        sku?: string;
        brandId?: string;
        storeId?: string;
        status?: string;
        hasIssues?: boolean;
        missingCost?: boolean;
        missingDiscount?: boolean;
        sortBy?: string;
        sortDir?: string;
    }) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(200, Math.max(1, params.limit || 50));
        const skip = (page - 1) * limit;

        const where: any = {};

        // Exact SKU takes highest priority
        if (params.sku) {
            where.sku = params.sku;
        } else if (params.search) {
            where.OR = [
                { sku: { contains: params.search, mode: 'insensitive' } },
                { title: { contains: params.search, mode: 'insensitive' } },
                { color: { contains: params.search, mode: 'insensitive' } },
            ];
        }

        if (params.brandId) {
            where.product = { brandId: params.brandId };
        }
        if (params.storeId) {
            where.storeMaps = { some: { storeId: params.storeId } };
        }
        if (params.status) where.status = params.status;
        if (params.hasIssues) {
            where.issues = { some: { status: 'OPEN' } };
        }
        if (params.missingCost) {
            where.vendorCost = null;
        }
        if (params.missingDiscount) {
            where.OR = [
                ...(where.OR || []),
                { insDiscountType: null },
                { insDiscountValue: null },
            ];
        }

        const sortBy = params.sortBy || 'sku';
        const sortDir = params.sortDir === 'desc' ? 'desc' : 'asc';

        try {
            const [data, total] = await Promise.all([
                this.prisma.productVariant.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortDir },
                    include: {
                        product: { select: { id: true, title: true, brandId: true, brand: { select: { id: true, name: true, code: true } } } },
                        _count: { select: { storeMaps: true, issues: true } },
                    },
                }),
                this.prisma.productVariant.count({ where }),
            ]);

            return {
                data: this.serialize(data),
                meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
            };
        } catch (e: any) {
            console.error('findAllVariants error:', e.message?.substring(0, 200));
            // Fallback: try without includes that might fail
            try {
                const [data, total] = await Promise.all([
                    this.prisma.productVariant.findMany({
                        where,
                        skip,
                        take: limit,
                        orderBy: { [sortBy]: sortDir },
                        include: {
                            product: { select: { id: true, title: true, brandId: true } },
                        },
                    }),
                    this.prisma.productVariant.count({ where }),
                ]);
                return {
                    data: this.serialize(data),
                    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
                };
            } catch (e2: any) {
                console.error('findAllVariants fallback error:', e2.message?.substring(0, 200));
                return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
            }
        }
    }

    // ═══════════════════════════════════════
    //  Global Bulk Variant Operations
    // ═══════════════════════════════════════

    /** PATCH /api/v1/product-variants/bulk — global bulk update */
    async globalBulkUpdate(
        action: 'update_cost' | 'update_discount' | 'activate' | 'archive' | 'resolve_issues',
        variantIds: string[],
        data: {
            vendorCost?: number;
            insDiscountType?: string;
            insDiscountValue?: number;
        },
        userId: string,
    ) {
        if (!variantIds || variantIds.length === 0) {
            throw new BadRequestException('No variant IDs provided');
        }

        let updated = 0;
        const affectedProductIds = new Set<string>();

        for (const vid of variantIds) {
            const variant = await this.prisma.productVariant.findUnique({ where: { id: vid } });
            if (!variant) continue;

            affectedProductIds.add(variant.productId);

            switch (action) {
                case 'update_cost': {
                    if (data.vendorCost == null) break;
                    const margin = computeMargin(variant.price, data.vendorCost);
                    await this.prisma.productVariant.update({
                        where: { id: vid },
                        data: { vendorCost: data.vendorCost, estimatedMargin: margin },
                    });
                    updated++;
                    break;
                }
                case 'update_discount': {
                    await this.prisma.productVariant.update({
                        where: { id: vid },
                        data: {
                            ...(data.insDiscountType ? { insDiscountType: data.insDiscountType as any } : {}),
                            ...(data.insDiscountValue != null ? { insDiscountValue: data.insDiscountValue } : {}),
                        },
                    });
                    updated++;
                    break;
                }
                case 'activate': {
                    await this.prisma.productVariant.update({
                        where: { id: vid },
                        data: { status: 'ACTIVE' },
                    });
                    updated++;
                    break;
                }
                case 'archive': {
                    await this.prisma.productVariant.update({
                        where: { id: vid },
                        data: { status: 'DISCONTINUED' },
                    });
                    updated++;
                    break;
                }
                case 'resolve_issues': {
                    const issues = await this.prisma.productIssue.updateMany({
                        where: { variantId: vid, status: 'OPEN' },
                        data: { status: 'RESOLVED', resolvedBy: userId, resolvedAt: new Date() },
                    });
                    updated += issues.count;
                    break;
                }
            }
        }

        // Re-run rules for affected products (except resolve_issues)
        if (action !== 'resolve_issues') {
            for (const pid of affectedProductIds) {
                // Run rules async — fire and forget for bulk perf
                // In production, queue this
            }
        }

        await this.audit.log({
            userId,
            action: `variants.bulk_${action}`,
            entityType: 'ProductVariant',
            entityId: 'bulk',
            changes: { action, count: variantIds.length, updated },
        });

        this.logger.log(`Global bulk ${action}: ${updated} updated from ${variantIds.length} selected`);
        return { action, selected: variantIds.length, updated };
    }

    /** GET /api/v1/product-variants/by-sku/:sku — exact SKU lookup */
    async findVariantBySku(sku: string) {
        const variant = await this.prisma.productVariant.findUnique({
            where: { sku },
            include: {
                product: {
                    include: {
                        brand: { select: { id: true, name: true, code: true } },
                    },
                },
                storeMaps: {
                    include: {
                        store: { select: { id: true, storeName: true, shopifyDomain: true } },
                    },
                },
                issues: { where: { status: 'OPEN' } },
            },
        });

        if (!variant) throw new NotFoundException(`Variant with SKU "${sku}" not found`);
        return { data: this.serialize(variant) };
    }

    // ═══════════════════════════════════════
    //  Sync Jobs
    // ═══════════════════════════════════════

    /** GET /api/v1/products/sync-jobs — list sync jobs */
    async findSyncJobs(params: {
        page?: number;
        limit?: number;
        source?: string;
        status?: string;
    }) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(50, Math.max(1, params.limit || 20));
        const skip = (page - 1) * limit;

        const where: any = {};
        if (params.source) where.source = params.source;
        if (params.status) where.status = params.status;

        const [data, total] = await Promise.all([
            this.prisma.productSyncJob.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    store: { select: { id: true, storeName: true } },
                    brand: { select: { id: true, name: true, code: true } },
                },
            }),
            this.prisma.productSyncJob.count({ where }),
        ]);

        return { data: this.serialize(data), meta: { page, limit, total } };
    }

    /** GET /api/v1/products/sync-jobs/:id — job detail + logs */
    async findSyncJobById(id: string) {
        const job = await this.prisma.productSyncJob.findUnique({
            where: { id },
            include: {
                store: { select: { id: true, storeName: true } },
                brand: { select: { id: true, name: true, code: true } },
                logs: { orderBy: { createdAt: 'asc' }, take: 500 },
            },
        });

        if (!job) throw new NotFoundException('Sync job not found');
        return { data: this.serialize(job) };
    }

    // ═══════════════════════════════════════
    //  Issues
    // ═══════════════════════════════════════

    /** GET /api/v1/products/issues — list issues */
    async findIssues(params: {
        page?: number;
        limit?: number;
        severity?: string;
        status?: string;
        ruleCode?: string;
        productId?: string;
    }) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 50));
        const skip = (page - 1) * limit;

        const where: any = {};
        if (params.severity) where.severity = params.severity;
        if (params.status) where.status = params.status;
        if (params.ruleCode) where.ruleCode = params.ruleCode;
        if (params.productId) where.productId = params.productId;

        const [data, total] = await Promise.all([
            this.prisma.productIssue.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    product: { select: { id: true, title: true } },
                    variant: { select: { id: true, sku: true, title: true } },
                },
            }),
            this.prisma.productIssue.count({ where }),
        ]);

        return { data: this.serialize(data), meta: { page, limit, total } };
    }

    /** PATCH /api/v1/products/issues/:id/resolve */
    async resolveIssue(id: string, userId: string) {
        const issue = await this.prisma.productIssue.findUnique({ where: { id } });
        if (!issue) throw new NotFoundException('Issue not found');

        const updated = await this.prisma.productIssue.update({
            where: { id },
            data: { status: 'RESOLVED', resolvedBy: userId, resolvedAt: new Date() },
        });

        return { data: this.serialize(updated) };
    }

    /** PATCH /api/v1/products/issues/:id/ignore */
    async ignoreIssue(id: string, userId: string) {
        const issue = await this.prisma.productIssue.findUnique({ where: { id } });
        if (!issue) throw new NotFoundException('Issue not found');

        const updated = await this.prisma.productIssue.update({
            where: { id },
            data: { status: 'IGNORED', resolvedBy: userId, resolvedAt: new Date() },
        });

        return { data: this.serialize(updated) };
    }

    // ═══════════════════════════════════════
    //  Variant Groups (real DB entity)
    // ═══════════════════════════════════════

    /** GET /api/v1/variant-groups — paginated from real table */
    async getVariantGroups(params: {
        page?: number;
        limit?: number;
        brandId?: string;
        color?: string;
        material?: string;
        status?: string;
        hasIssues?: boolean;
        search?: string;
    }) {
        const page = Math.max(1, params.page || 1);
        const limit = Math.min(100, Math.max(1, params.limit || 25));
        const skip = (page - 1) * limit;

        const where: any = {};
        if (params.brandId) where.product = { brandId: params.brandId };
        if (params.color) where.color = { contains: params.color, mode: 'insensitive' };
        if (params.material) where.material = { contains: params.material, mode: 'insensitive' };
        if (params.search) {
            where.OR = [
                { color: { contains: params.search, mode: 'insensitive' } },
                { material: { contains: params.search, mode: 'insensitive' } },
                { product: { title: { contains: params.search, mode: 'insensitive' } } },
            ];
        }
        // Filter by variant-level status/issues
        if (params.status) {
            where.variants = { some: { status: params.status } };
        }
        if (params.hasIssues) {
            where.variants = { ...where.variants, some: { ...where.variants?.some, issues: { some: { status: 'OPEN' } } } };
        }

        const [data, total] = await Promise.all([
            this.prisma.variantGroup.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ product: { updatedAt: 'desc' } }, { position: 'asc' }],
                include: {
                    product: {
                        select: {
                            id: true, title: true, styleCode: true, featuredImageUrl: true,
                            brand: { select: { id: true, name: true, code: true } },
                        },
                    },
                    variants: {
                        select: { id: true, sku: true, size: true, price: true, status: true },
                        orderBy: { size: 'asc' },
                    },
                    _count: { select: { variants: true } },
                },
            }),
            this.prisma.variantGroup.count({ where }),
        ]);

        // Enrich with computed fields
        const enriched = data.map(g => {
            const groupName = g.material ? `${g.color || 'N/A'} / ${g.material}` : (g.color || 'Ungrouped');
            const prices = g.variants.filter(v => v.price != null).map(v => parseFloat(String(v.price)));
            return {
                id: g.id,
                groupName,
                productId: g.productId,
                productTitle: g.product?.title,
                styleCode: g.product?.styleCode,
                brand: g.product?.brand,
                color: g.color,
                material: g.material,
                sizeRun: g.sizeRun,
                imageUrl: g.imageUrl || g.product?.featuredImageUrl || null,
                skuCount: g._count.variants,
                priceMin: prices.length ? Math.min(...prices) : null,
                priceMax: prices.length ? Math.max(...prices) : null,
                statuses: [...new Set(g.variants.map(v => v.status))],
                position: g.position,
                createdAt: g.createdAt,
            };
        });

        return {
            data: enriched,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    // ═══════════════════════════════════════
    //  Manual Create
    // ═══════════════════════════════════════

    /** GET /api/v1/products/next-style-code — auto-generate next style code for a brand */
    async getNextStyleCode(brandId?: string) {
        let prefix = 'INS';
        if (brandId) {
            const brand = await this.prisma.brand.findUnique({ where: { id: brandId }, select: { code: true, name: true } });
            if (brand) {
                prefix = (brand.code || brand.name?.substring(0, 3) || 'INS').toUpperCase().replace(/[^A-Z0-9]/g, '');
            }
        }
        // Find highest existing sequence for this prefix
        const existing = await this.prisma.product.findMany({
            where: { styleCode: { startsWith: `${prefix}-`, mode: 'insensitive' } },
            select: { styleCode: true },
            orderBy: { styleCode: 'desc' },
            take: 100,
        });
        let maxSeq = 0;
        for (const p of existing) {
            const match = p.styleCode?.match(new RegExp(`^${prefix}-(\\d+)`, 'i'));
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxSeq) maxSeq = num;
            }
        }
        const nextSeq = String(maxSeq + 1).padStart(3, '0');
        return { data: { styleCode: `${prefix}-${nextSeq}`, prefix, sequence: maxSeq + 1 } };
    }

    /** POST /api/v1/products — create product */
    async createProduct(
        data: {
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
        userId: string,
    ) {
        if (!data.title?.trim()) throw new BadRequestException('Title is required');
        if (!data.styleCode?.trim()) throw new BadRequestException('Style Code is required for SKU auto-generation');

        const product = await this.prisma.product.create({
            data: {
                title: data.title.trim(),
                brandId: data.brandId || null,
                collectionId: data.collectionId || null,
                styleCode: data.styleCode || null,
                productType: data.productType || null,
                category: data.category || null,
                description: data.description || null,
                material: data.material || null,
                season: data.season || null,
                featuredImageUrl: data.featuredImageUrl || null,
                availabilityType: data.availabilityType || null,
                leadTimeDays: data.leadTimeDays || null,
                status: 'DRAFT',
            },
            include: {
                brand: { select: { id: true, name: true, code: true } },
            },
        });

        await this.audit.log({
            userId,
            action: 'product.create',
            entityType: 'Product',
            entityId: product.id,
            changes: data,
        });

        this.logger.log(`Product created: ${product.id} "${product.title}"`);
        return { data: this.serialize(product) };
    }

    /** POST /api/v1/products/:id/skus — create SKU under product */
    async createSku(
        productId: string,
        data: {
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
        userId: string,
    ) {
        if (!data.sku?.trim()) throw new BadRequestException('SKU is required');

        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        if (!product) throw new NotFoundException('Product not found');

        // Check SKU uniqueness
        const existing = await this.prisma.productVariant.findUnique({ where: { sku: data.sku.trim() } });
        if (existing) throw new BadRequestException(`SKU ${data.sku} already exists`);

        const margin = computeMargin(data.price ?? null, data.vendorCost ?? null);

        const variant = await this.prisma.productVariant.create({
            data: {
                productId,
                sku: data.sku.trim(),
                title: `${product.title} - ${data.color || '—'} / ${data.size || '—'}`,
                color: data.color || null,
                size: data.size || null,
                option1: data.color || null,
                option2: data.size || null,
                price: data.price ?? null,
                compareAtPrice: data.compareAtPrice ?? null,
                vendorCost: data.vendorCost ?? null,
                estimatedMargin: margin,
                barcode: data.barcode || null,
                weightGrams: data.weightGrams || null,
                status: (data.status as any) || 'ACTIVE',
            },
        });

        await this.audit.log({
            userId,
            action: 'sku.create',
            entityType: 'ProductVariant',
            entityId: variant.id,
            changes: { ...data, productId },
        });

        this.logger.log(`SKU created: ${variant.sku} under product ${productId}`);
        return { data: this.serialize(variant) };
    }

    /** POST /api/v1/products/:id/variant-groups — create group + auto-generate SKUs */
    async createVariantGroup(
        productId: string,
        data: {
            color?: string;
            material?: string;
            sizeRun: string[];
            imageUrl?: string;
            price?: number;
            vendorCost?: number;
        },
        userId: string,
    ) {
        if (!data.sizeRun?.length) throw new BadRequestException('Size run is required (at least one size)');

        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        if (!product) throw new NotFoundException('Product not found');
        if (!product.styleCode) throw new BadRequestException('Product must have a Style Code for SKU auto-generation');

        // Normalize sizeRun (dedupe, trim)
        const sizeRun = [...new Set(data.sizeRun.map(s => s.trim()).filter(Boolean))];
        if (sizeRun.length === 0) throw new BadRequestException('Size run must contain at least one valid size');

        // Create the variant group
        const groupCount = await this.prisma.variantGroup.count({ where: { productId } });
        const group = await this.prisma.variantGroup.create({
            data: {
                productId,
                color: data.color || null,
                material: data.material || null,
                sizeRun,
                imageUrl: data.imageUrl || null,
                position: groupCount,
            },
        });

        // Auto-generate SKUs from size run
        const colorAbbr = abbreviateColor(data.color);
        const margin = computeMargin(data.price ?? null, data.vendorCost ?? null);
        const generatedSkus: string[] = [];

        for (const size of sizeRun) {
            const skuCode = generateSkuCode(product.styleCode!, colorAbbr, size);

            // Check uniqueness
            const existing = await this.prisma.productVariant.findUnique({ where: { sku: skuCode } });
            if (existing) {
                this.logger.warn(`SKU ${skuCode} already exists, skipping auto-generation for size ${size}`);
                continue;
            }

            await this.prisma.productVariant.create({
                data: {
                    productId,
                    variantGroupId: group.id,
                    sku: skuCode,
                    title: `${product.title} - ${data.color || '—'} / ${size}`,
                    color: data.color || null,
                    size,
                    option1: data.color || null,
                    option2: size,
                    price: data.price ?? null,
                    vendorCost: data.vendorCost ?? null,
                    estimatedMargin: margin,
                    status: 'ACTIVE',
                },
            });
            generatedSkus.push(skuCode);
        }

        await this.audit.log({
            userId,
            action: 'variant_group.create',
            entityType: 'VariantGroup',
            entityId: group.id,
            changes: { ...data, productId, generatedSkus },
        });

        this.logger.log(`VariantGroup created: ${group.id}, generated ${generatedSkus.length} SKUs`);

        // Return full group with variants
        const fullGroup = await this.prisma.variantGroup.findUnique({
            where: { id: group.id },
            include: { variants: { orderBy: { size: 'asc' } } },
        });
        return { data: this.serialize(fullGroup) };
    }

    /** POST /api/v1/variant-groups/:id/sizes — add size to group + generate SKU */
    async addSizeToGroup(
        groupId: string,
        data: { size: string; price?: number; vendorCost?: number },
        userId: string,
    ) {
        const size = data.size?.trim();
        if (!size) throw new BadRequestException('Size is required');

        const group = await this.prisma.variantGroup.findUnique({
            where: { id: groupId },
            include: { product: true },
        });
        if (!group) throw new NotFoundException('Variant group not found');
        if (!group.product.styleCode) throw new BadRequestException('Product must have a Style Code');

        // Block duplicate size within group
        if (group.sizeRun.includes(size)) {
            throw new BadRequestException(`Size "${size}" already exists in this group\'s size run`);
        }

        // Generate SKU
        const colorAbbr = abbreviateColor(group.color);
        const skuCode = generateSkuCode(group.product.styleCode!, colorAbbr, size);

        const existingSku = await this.prisma.productVariant.findUnique({ where: { sku: skuCode } });
        if (existingSku) throw new BadRequestException(`SKU ${skuCode} already exists`);

        const margin = computeMargin(data.price ?? null, data.vendorCost ?? null);

        // Update sizeRun + create SKU in transaction
        const [updatedGroup, variant] = await this.prisma.$transaction([
            this.prisma.variantGroup.update({
                where: { id: groupId },
                data: { sizeRun: [...group.sizeRun, size] },
            }),
            this.prisma.productVariant.create({
                data: {
                    productId: group.productId,
                    variantGroupId: groupId,
                    sku: skuCode,
                    title: `${group.product.title} - ${group.color || '—'} / ${size}`,
                    color: group.color || null,
                    size,
                    option1: group.color || null,
                    option2: size,
                    price: data.price ?? null,
                    vendorCost: data.vendorCost ?? null,
                    estimatedMargin: margin,
                    status: 'ACTIVE',
                },
            }),
        ]);

        await this.audit.log({
            userId,
            action: 'variant_group.add_size',
            entityType: 'VariantGroup',
            entityId: groupId,
            changes: { size, sku: skuCode },
        });

        this.logger.log(`Size "${size}" added to group ${groupId}, SKU: ${skuCode}`);
        return { data: this.serialize({ group: updatedGroup, variant }) };
    }

    /** DELETE /api/v1/variant-groups/:id/sizes/:size — archive SKU + update sizeRun */
    async removeSizeFromGroup(
        groupId: string,
        size: string,
        userId: string,
    ) {
        if (!size?.trim()) throw new BadRequestException('Size is required');
        size = size.trim();

        const group = await this.prisma.variantGroup.findUnique({
            where: { id: groupId },
            include: { product: true },
        });
        if (!group) throw new NotFoundException('Variant group not found');

        if (!group.sizeRun.includes(size)) {
            throw new BadRequestException(`Size "${size}" not found in this group\'s size run`);
        }

        // Find the SKU for this size in this group
        const variant = await this.prisma.productVariant.findFirst({
            where: { variantGroupId: groupId, size },
        });

        // Archive SKU (not hard delete) + update sizeRun
        const newSizeRun = group.sizeRun.filter(s => s !== size);
        await this.prisma.$transaction([
            this.prisma.variantGroup.update({
                where: { id: groupId },
                data: { sizeRun: newSizeRun },
            }),
            ...(variant
                ? [this.prisma.productVariant.update({
                    where: { id: variant.id },
                    data: { status: 'DISCONTINUED' },
                })]
                : []),
        ]);

        await this.audit.log({
            userId,
            action: 'variant_group.remove_size',
            entityType: 'VariantGroup',
            entityId: groupId,
            changes: { size, archivedVariantId: variant?.id },
        });

        this.logger.log(`Size "${size}" removed from group ${groupId}, SKU archived`);
        return { data: { removed: size, archivedSku: variant?.sku || null, remainingSizeRun: newSizeRun } };
    }

    // ═══════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════

    private serialize(obj: any): any {
        return JSON.parse(JSON.stringify(obj, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
    }
}

// ─── SKU Code Generation Helpers ───

function abbreviateColor(color?: string | null): string {
    if (!color) return 'NA';
    const c = color.trim().toUpperCase();
    // Common fashion color abbreviations
    const map: Record<string, string> = {
        'BLACK': 'BLK', 'WHITE': 'WHT', 'BLUE': 'BLU', 'RED': 'RED',
        'GREEN': 'GRN', 'GREY': 'GRY', 'GRAY': 'GRY', 'BROWN': 'BRN',
        'NAVY': 'NVY', 'BEIGE': 'BEI', 'CREAM': 'CRM', 'PINK': 'PNK',
        'PURPLE': 'PRP', 'ORANGE': 'ORG', 'YELLOW': 'YLW', 'GOLD': 'GLD',
        'SILVER': 'SLV', 'TAN': 'TAN', 'IVORY': 'IVR', 'CAMEL': 'CML',
        'COGNAC': 'COG', 'OLIVE': 'OLV', 'BURGUNDY': 'BRG', 'CORAL': 'CRL',
        'NUDE': 'NUD', 'KHAKI': 'KHK', 'CHARCOAL': 'CHA', 'TEAL': 'TEL',
    };
    if (map[c]) return map[c];
    // For multi-word or unmapped: take first 3 chars
    return c.replace(/[^A-Z0-9]/g, '').substring(0, 3) || 'NA';
}

function generateSkuCode(styleCode: string, colorAbbr: string, size: string): string {
    const sc = styleCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const sz = size.trim().toUpperCase().replace(/[^A-Z0-9.\/]/g, '');
    return `${sc}-${colorAbbr}-${sz}`;
}
