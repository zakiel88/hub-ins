import {
    Injectable,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ProductsService {
    private readonly logger = new Logger(ProductsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async findAll(params: {
        collectionId?: string;
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
        category?: string;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (params.collectionId) where.collectionId = params.collectionId;
        if (params.status) where.status = params.status;
        if (params.category) where.category = params.category;

        if (params.search) {
            where.OR = [
                { name: { contains: params.search, mode: 'insensitive' } },
                { skuPrefix: { contains: params.search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.product.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    collection: {
                        select: {
                            id: true,
                            name: true,
                            brand: { select: { id: true, name: true, code: true } },
                        },
                    },
                    _count: { select: { colorways: true } },
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
                collection: {
                    select: {
                        id: true,
                        name: true,
                        brand: { select: { id: true, name: true, code: true } },
                    },
                },
                colorways: {
                    orderBy: { sku: 'asc' },
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
}
