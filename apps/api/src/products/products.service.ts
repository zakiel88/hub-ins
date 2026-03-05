import {
    Injectable,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CatalogValidationService } from '../metafields/catalog-validation.service';

@Injectable()
export class ProductsService {
    private readonly logger = new Logger(ProductsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
        private readonly catalogValidation: CatalogValidationService,
    ) { }

    async findAll(params: {
        collectionId?: string;
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
        category?: string;
        brandId?: string;
        hasConflict?: boolean;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 25;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (params.collectionId) where.collectionId = params.collectionId;
        if (params.status) where.status = params.status;
        if (params.category) where.category = params.category;
        if (params.brandId) where.brandId = params.brandId;
        if (params.hasConflict !== undefined) where.hasConflict = params.hasConflict;

        if (params.search) {
            where.OR = [
                { name: { contains: params.search, mode: 'insensitive' } },
                { skuPrefix: { contains: params.search, mode: 'insensitive' } },
                { handle: { contains: params.search, mode: 'insensitive' } },
                { vendor: { contains: params.search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    brand: { select: { id: true, name: true, code: true } },
                    collection: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    _count: { select: { colorways: true, publications: true } },
                },
            }),
            this.prisma.product.count({ where }),
        ]);

        return { data, meta: { page, limit, total } };
    }

    async findById(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                brand: { select: { id: true, name: true, code: true } },
                collection: {
                    select: { id: true, name: true },
                },
                colorways: {
                    orderBy: { sku: 'asc' },
                },
                publications: {
                    include: {
                        store: { select: { id: true, storeName: true, shopifyDomain: true } },
                        variantPublications: true,
                    },
                },
                productMaps: {
                    include: {
                        store: { select: { id: true, storeName: true, shopifyDomain: true } },
                    },
                },
            },
        });

        if (!product) {
            throw new NotFoundException('Product not found');
        }

        return product;
    }

    async create(
        data: {
            collectionId: string;
            name: string;
            skuPrefix?: string;
            category?: string;
            material?: string;
            description?: string;
            wholesalePrice?: number;
            status?: string;
        },
        userId: string,
    ) {
        // Verify collection exists
        const collection = await this.prisma.collection.findUnique({
            where: { id: data.collectionId },
        });
        if (!collection) {
            throw new NotFoundException('Collection not found');
        }

        const product = await this.prisma.product.create({
            data: {
                collectionId: data.collectionId,
                name: data.name,
                skuPrefix: data.skuPrefix,
                category: data.category,
                material: data.material,
                description: data.description,
                wholesalePrice: data.wholesalePrice,
                status: data.status || 'active',
            },
        });

        await this.audit.log({
            userId,
            action: 'product.create',
            entityType: 'product',
            entityId: product.id,
            changes: { collectionId: data.collectionId, name: data.name },
        });

        this.logger.log(`Product created: ${product.name}`);
        return product;
    }

    async update(
        id: string,
        data: {
            name?: string;
            skuPrefix?: string;
            category?: string;
            material?: string;
            description?: string;
            wholesalePrice?: number;
            status?: string;
        },
        userId: string,
    ) {
        await this.findById(id);

        const product = await this.prisma.product.update({
            where: { id },
            data,
        });

        await this.audit.log({
            userId,
            action: 'product.update',
            entityType: 'product',
            entityId: id,
        });

        return product;
    }

    async remove(id: string, userId: string) {
        await this.findById(id);

        // Soft delete
        await this.prisma.product.update({
            where: { id },
            data: { status: 'deleted' },
        });

        await this.audit.log({
            userId,
            action: 'product.delete',
            entityType: 'product',
            entityId: id,
        });

        this.logger.log(`Product soft-deleted: ${id}`);
    }

    // ─── Sprint 2: Category + Pricing ────────────

    async updateCategory(id: string, shopifyCategoryId: string | null, userId: string) {
        await this.findById(id);

        const product = await this.prisma.product.update({
            where: { id },
            data: { shopifyCategoryId },
        });

        await this.audit.log({
            userId,
            action: 'product.updateCategory',
            entityType: 'product',
            entityId: id,
            changes: { shopifyCategoryId },
        });

        // Sprint 2.1: Trigger revalidation after category change
        this.catalogValidation.revalidateProduct(id).catch(err => {
            this.logger.warn(`Revalidation failed for product ${id}: ${err.message}`);
        });

        return product;
    }

    async updateVariantPricing(
        colorwayId: string,
        data: { vendorPrice?: number; cogs?: number },
        userId: string,
    ) {
        const colorway = await this.prisma.colorway.findUnique({ where: { id: colorwayId } });
        if (!colorway) throw new NotFoundException('Colorway/variant not found');

        const updated = await this.prisma.colorway.update({
            where: { id: colorwayId },
            data: {
                vendorPrice: data.vendorPrice !== undefined ? data.vendorPrice : colorway.vendorPrice,
                cogs: data.cogs !== undefined ? data.cogs : colorway.cogs,
            },
        });

        await this.audit.log({
            userId,
            action: 'variant.updatePricing',
            entityType: 'colorway',
            entityId: colorwayId,
            changes: data,
        });

        return updated;
    }

    async getSummary() {
        try {
            const [total, active, draft, conflicts, variantCount, brandCount] = await Promise.all([
                this.prisma.product.count(),
                this.prisma.product.count({ where: { status: 'active' } }),
                this.prisma.product.count({ where: { status: 'draft' } }),
                this.prisma.product.count({ where: { hasConflict: true } }),
                this.prisma.colorway.count(),
                this.prisma.brand.count(),
            ]);

            let topCategories: any[] = [];
            try {
                const categories = await this.prisma.product.groupBy({
                    by: ['category'],
                    _count: { category: true },
                    orderBy: { _count: { category: 'desc' } },
                    take: 10,
                });
                topCategories = categories.map((c) => ({
                    category: c.category || 'Uncategorized',
                    count: c._count.category,
                }));
            } catch {
                // groupBy may fail on empty tables, that's OK
            }

            return {
                total,
                active,
                draft,
                conflicts,
                variants: variantCount,
                brands: brandCount,
                topCategories,
            };
        } catch (err: any) {
            this.logger.error(`getSummary failed: ${err.message}`);
            return {
                total: 0,
                active: 0,
                draft: 0,
                conflicts: 0,
                variants: 0,
                brands: 0,
                topCategories: [],
            };
        }
    }
}

