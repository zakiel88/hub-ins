import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PricingService {
    private readonly logger = new Logger(PricingService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    // ─── List / Query ─────────────────────────

    async findAll(params: {
        colorwayId?: string;
        market?: string;
        status?: string;
        page?: number;
        limit?: number;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 50;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (params.colorwayId) where.colorwayId = params.colorwayId;
        if (params.market) where.market = params.market;
        if (params.status) where.status = params.status;

        const [data, total] = await Promise.all([
            this.prisma.marketPrice.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    colorway: {
                        select: {
                            id: true,
                            sku: true,
                            color: true,
                            size: true,
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
                        },
                    },
                    reviewer: { select: { id: true, fullName: true, email: true } },
                },
            }),
            this.prisma.marketPrice.count({ where }),
        ]);

        return { data, meta: { page, limit, total } };
    }

    async findById(id: string) {
        const mp = await this.prisma.marketPrice.findUnique({
            where: { id },
            include: {
                colorway: {
                    select: {
                        id: true,
                        sku: true,
                        color: true,
                        size: true,
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
                    },
                },
                reviewer: { select: { id: true, fullName: true, email: true } },
            },
        });

        if (!mp) throw new NotFoundException('Market price not found');
        return mp;
    }

    // ─── Create (single + batch) ──────────────

    async create(
        data: {
            colorwayId: string;
            market: string;
            retailPrice: number;
            comparePrice?: number;
            currency: string;
        },
        userId: string,
    ) {
        // Verify colorway
        const cw = await this.prisma.colorway.findUnique({ where: { id: data.colorwayId } });
        if (!cw) throw new NotFoundException('Colorway not found');

        // Check unique constraint (colorway + market)
        const existing = await this.prisma.marketPrice.findFirst({
            where: { colorwayId: data.colorwayId, market: data.market },
        });
        if (existing) {
            throw new ConflictException(
                `Price already exists for colorway ${cw.sku} in market ${data.market}`,
            );
        }

        const mp = await this.prisma.marketPrice.create({
            data: {
                colorwayId: data.colorwayId,
                market: data.market,
                retailPrice: data.retailPrice,
                comparePrice: data.comparePrice,
                currency: data.currency,
                status: 'draft',
            },
        });

        await this.audit.log({
            userId,
            action: 'market_price.create',
            entityType: 'market_price',
            entityId: mp.id,
            changes: { colorwayId: data.colorwayId, market: data.market, retailPrice: data.retailPrice },
        });

        this.logger.log(`Price created: ${cw.sku} @ ${data.market} = ${data.retailPrice} ${data.currency}`);
        return mp;
    }

    async createBatch(
        items: Array<{
            colorwayId: string;
            market: string;
            retailPrice: number;
            comparePrice?: number;
            currency: string;
        }>,
        userId: string,
    ) {
        const results = [];
        const errors = [];

        for (const item of items) {
            try {
                const mp = await this.create(item, userId);
                results.push(mp);
            } catch (err: any) {
                errors.push({ item, error: err.message });
            }
        }

        return { created: results.length, errors: errors.length, results, errors_detail: errors };
    }

    // ─── Update Price ─────────────────────────

    async update(
        id: string,
        data: {
            retailPrice?: number;
            comparePrice?: number;
            currency?: string;
        },
        userId: string,
    ) {
        const existing = await this.findById(id);

        // Only draft/rejected prices can be edited
        if (existing.status === 'approved' || existing.status === 'published') {
            throw new BadRequestException(
                `Cannot edit price in '${existing.status}' status. Create a new version instead.`,
            );
        }

        const mp = await this.prisma.marketPrice.update({
            where: { id },
            data: {
                ...data,
                status: 'draft', // reset to draft on edit
            },
        });

        await this.audit.log({
            userId,
            action: 'market_price.update',
            entityType: 'market_price',
            entityId: id,
            changes: {
                before: { retailPrice: existing.retailPrice },
                after: { retailPrice: mp.retailPrice },
            },
        });

        return mp;
    }

    // ─── Review / Approve workflow ────────────

    async review(
        id: string,
        data: {
            status: 'approved' | 'rejected';
            reviewNotes?: string;
        },
        userId: string,
    ) {
        const existing = await this.findById(id);

        if (existing.status !== 'draft') {
            throw new BadRequestException(
                `Can only review prices in 'draft' status. Current: '${existing.status}'`,
            );
        }

        const mp = await this.prisma.marketPrice.update({
            where: { id },
            data: {
                status: data.status,
                reviewedBy: userId,
                reviewedAt: new Date(),
                reviewNotes: data.reviewNotes,
            },
        });

        await this.audit.log({
            userId,
            action: `market_price.${data.status}`,
            entityType: 'market_price',
            entityId: id,
            changes: { from: 'draft', to: data.status, notes: data.reviewNotes },
        });

        this.logger.log(`Price ${id} ${data.status} by user ${userId}`);
        return mp;
    }

    // ─── Summary / Stats ─────────────────────

    async getMarketSummary(market: string) {
        const stats = await this.prisma.marketPrice.groupBy({
            by: ['status'],
            where: { market },
            _count: true,
        });

        return {
            market,
            breakdown: stats.map((s: any) => ({ status: s.status, count: s._count })),
            total: stats.reduce((sum: number, s: any) => sum + s._count, 0),
        };
    }
}
