import {
    Injectable,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class CollectionsService {
    private readonly logger = new Logger(CollectionsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    async findAll(params: {
        brandId?: string;
        page?: number;
        limit?: number;
        status?: string;
        search?: string;
        season?: string;
        year?: number;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (params.brandId) where.brandId = params.brandId;
        if (params.status) where.status = params.status;
        if (params.season) where.season = params.season;
        if (params.year) where.year = params.year;

        if (params.search) {
            where.name = { contains: params.search, mode: 'insensitive' };
        }

        const [data, total] = await Promise.all([
            this.prisma.collection.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    brand: { select: { id: true, name: true, code: true } },
                    _count: { select: { products: true } },
                },
            }),
            this.prisma.collection.count({ where }),
        ]);

        return { data, meta: { page, limit, total } };
    }

    async findById(id: string) {
        const collection = await this.prisma.collection.findUnique({
            where: { id },
            include: {
                brand: { select: { id: true, name: true, code: true } },
                products: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        _count: { select: { variants: true } },
                    },
                },
            },
        });

        if (!collection) {
            throw new NotFoundException('Collection not found');
        }

        return collection;
    }

    async create(
        data: {
            brandId: string;
            name: string;
            season?: string;
            year?: number;
            status?: string;
        },
        userId: string,
    ) {
        // Verify brand exists
        const brand = await this.prisma.brand.findUnique({
            where: { id: data.brandId },
        });
        if (!brand || brand.deletedAt) {
            throw new NotFoundException('Brand not found');
        }

        const collection = await this.prisma.collection.create({
            data: {
                brandId: data.brandId,
                name: data.name,
                season: data.season,
                year: data.year,
                status: data.status || 'active',
            },
        });

        await this.audit.log({
            userId,
            action: 'collection.create',
            entityType: 'collection',
            entityId: collection.id,
            changes: { brandId: data.brandId, name: data.name },
        });

        this.logger.log(`Collection created: ${collection.name} for brand ${brand.code}`);
        return collection;
    }

    async update(
        id: string,
        data: {
            name?: string;
            season?: string;
            year?: number;
            status?: string;
        },
        userId: string,
    ) {
        await this.findById(id);

        const collection = await this.prisma.collection.update({
            where: { id },
            data,
        });

        await this.audit.log({
            userId,
            action: 'collection.update',
            entityType: 'collection',
            entityId: id,
        });

        return collection;
    }
}
