import {
    Injectable,
    NotFoundException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ColorwaysService {
    private readonly logger = new Logger(ColorwaysService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async findAll(params: {
        productId?: string;
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 50;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (params.productId) where.productId = params.productId;
        if (params.status) where.status = params.status;

        if (params.search) {
            where.OR = [
                { sku: { contains: params.search, mode: 'insensitive' } },
                { color: { contains: params.search, mode: 'insensitive' } },
                { barcode: { contains: params.search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.colorway.findMany({
                where,
                skip,
                take: limit,
                orderBy: { sku: 'asc' },
                include: {
                    product: {
                        select: {
                            id: true,
                            name: true,
                            collection: {
                                select: {
                                    id: true,
                                    name: true,
                                    brand: { select: { id: true, name: true, code: true } },
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            marketPrices: true,
                            inventoryItems: true,
                        },
                    },
                },
            }),
            this.prisma.colorway.count({ where }),
        ]);

        return { data, meta: { page, limit, total } };
    }

    async findById(id: string) {
        const colorway = await this.prisma.colorway.findUnique({
            where: { id },
            include: {
                product: {
                    select: {
                        id: true,
                        name: true,
                        collection: {
                            select: {
                                id: true,
                                name: true,
                                brand: { select: { id: true, name: true, code: true } },
                            },
                        },
                    },
                },
                marketPrices: true,
                inventoryItems: {
                    include: {
                        warehouse: { select: { id: true, code: true, name: true } },
                    },
                },
            },
        });

        if (!colorway) {
            throw new NotFoundException('Colorway not found');
        }

        return colorway;
    }

    async create(
        data: {
            productId: string;
            sku: string;
            color: string;
            size: string;
            barcode?: string;
            weightGrams?: number;
            images?: any;
            status?: string;
        },
        userId: string,
    ) {
        // Verify product exists
        const product = await this.prisma.product.findUnique({
            where: { id: data.productId },
        });
        if (!product) {
            throw new NotFoundException('Product not found');
        }

        // Check unique SKU
        const existingSku = await this.prisma.colorway.findUnique({
            where: { sku: data.sku },
        });
        if (existingSku) {
            throw new ConflictException(`SKU '${data.sku}' already exists`);
        }

        const colorway = await this.prisma.colorway.create({
            data: {
                productId: data.productId,
                sku: data.sku,
                color: data.color,
                size: data.size,
                barcode: data.barcode,
                weightGrams: data.weightGrams,
                images: data.images ?? [],
                status: data.status || 'active',
            },
        });

        await this.audit.log({
            userId,
            action: 'colorway.create',
            entityType: 'colorway',
            entityId: colorway.id,
            changes: { productId: data.productId, sku: data.sku, color: data.color, size: data.size },
        });

        this.logger.log(`Colorway created: ${colorway.sku}`);
        return colorway;
    }

    async update(
        id: string,
        data: {
            color?: string;
            size?: string;
            barcode?: string;
            weightGrams?: number;
            images?: any;
            status?: string;
        },
        userId: string,
    ) {
        await this.findById(id);

        const colorway = await this.prisma.colorway.update({
            where: { id },
            data,
        });

        await this.audit.log({
            userId,
            action: 'colorway.update',
            entityType: 'colorway',
            entityId: id,
        });

        return colorway;
    }
}
