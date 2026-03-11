import {
    Injectable,
    NotFoundException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);

    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
    ) { }

    async findAll(query: {
        status?: string;
        financialStatus?: string;
        fulfillmentStatus?: string;
        pipelineState?: string;
        shopifyStoreId?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const { status, financialStatus, fulfillmentStatus, pipelineState, shopifyStoreId, search, page = 1, limit = 50 } = query;
        const where: any = {};

        if (status) where.status = status;
        if (financialStatus) where.financialStatus = financialStatus;
        if (fulfillmentStatus) where.fulfillmentStatus = fulfillmentStatus;
        if (pipelineState) where.pipelineState = pipelineState;
        if (shopifyStoreId) where.shopifyStoreId = shopifyStoreId;
        if (search) {
            where.OR = [
                { orderNumber: { contains: search, mode: 'insensitive' } },
                { customerEmail: { contains: search, mode: 'insensitive' } },
                { customerName: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [data, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                include: {
                    shopifyStore: { select: { storeName: true, shopifyDomain: true } },
                    _count: { select: { lineItems: true } },
                },
                orderBy: { orderDate: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.order.count({ where }),
        ]);

        return { data: data.map((o) => this.serializeOrder(o)), meta: { page, limit, total } };
    }

    async findById(id: string) {
        try {
            const order = await this.prisma.order.findUnique({
                where: { id },
                include: {
                    shopifyStore: { select: { storeName: true, shopifyDomain: true } },
                    lineItems: {
                        include: {
                            variant: {
                                include: {
                                    product: {
                                        include: {
                                            brand: { select: { id: true, name: true, code: true } },
                                        },
                                    },
                                },
                            },
                            brand: { select: { id: true, name: true, code: true } },
                        },
                    },
                },
            });
            if (!order) throw new NotFoundException('Order not found');
            return { data: this.serializeOrder(order) };
        } catch (e: any) {
            if (e instanceof NotFoundException) throw e;
            this.logger.error(`findById(${id}) failed: ${e.message}`, e.stack);
            throw e;
        }
    }

    async updateStatus(
        id: string,
        dto: { status?: string; financialStatus?: string; fulfillmentStatus?: string },
        userId: string,
    ) {
        const order = await this.prisma.order.findUnique({ where: { id } });
        if (!order) throw new NotFoundException('Order not found');

        const updated = await this.prisma.order.update({
            where: { id },
            data: dto,
            include: {
                shopifyStore: { select: { storeName: true, shopifyDomain: true } },
                _count: { select: { lineItems: true } },
            },
        });

        this.audit.log({
            userId, action: 'order.updateStatus', entityType: 'Order', entityId: id,
            changes: { previous: { status: order.status, financialStatus: order.financialStatus, fulfillmentStatus: order.fulfillmentStatus }, updated: dto },
        });

        return { data: updated };
    }

    /* ── Manual Order Creation (for testing / non-Shopify) ── */
    async createManualOrder(
        dto: {
            shopifyStoreId: string;
            orderNumber: string;
            customerEmail?: string;
            totalPrice: number;
            currency: string;
            lineItems: Array<{
                variantId?: string;
                brandId?: string;
                title: string;
                sku?: string;
                quantity: number;
                unitPrice: number;
            }>;
        },
        userId: string,
    ) {
        const store = await this.prisma.shopifyStore.findUnique({ where: { id: dto.shopifyStoreId } });
        if (!store) throw new NotFoundException('Shopify store not found');

        const order = await this.prisma.order.create({
            data: {
                shopifyStoreId: dto.shopifyStoreId,
                shopifyOrderId: BigInt(Date.now()), // placeholder for manual orders
                orderNumber: dto.orderNumber,
                customerEmail: dto.customerEmail,
                totalPrice: dto.totalPrice,
                currency: dto.currency,
                orderDate: new Date(),
                lineItems: {
                    create: dto.lineItems.map((li) => ({
                        shopifyLineItemId: BigInt(Date.now() + Math.random() * 1000000),
                        variantId: li.variantId || null,
                        brandId: li.brandId || null,
                        title: li.title,
                        sku: li.sku || null,
                        quantity: li.quantity,
                        unitPrice: li.unitPrice,
                        totalPrice: li.unitPrice * li.quantity,
                    })),
                },
            },
            include: {
                shopifyStore: { select: { storeName: true, shopifyDomain: true } },
                lineItems: true,
            },
        });

        this.audit.log({ userId, action: 'order.create', entityType: 'Order', entityId: order.id, changes: { orderNumber: dto.orderNumber } });
        return { data: this.serializeOrder(order) };
    }

    /* ── Summary ── */
    async getOrdersSummary() {
        const [total, open, closed, byFinancial] = await Promise.all([
            this.prisma.order.count(),
            this.prisma.order.count({ where: { status: 'open' } }),
            this.prisma.order.count({ where: { status: 'closed' } }),
            this.prisma.order.groupBy({
                by: ['financialStatus'],
                _count: true,
                _sum: { totalPrice: true },
            }),
        ]);

        return {
            data: {
                total,
                open,
                closed,
                byFinancialStatus: byFinancial.map((g) => ({
                    status: g.financialStatus || 'unknown',
                    count: g._count,
                    totalRevenue: g._sum.totalPrice,
                })),
            },
        };
    }

    async getOrderLogs(orderId: string) {
        const logs = await this.prisma.orderLog.findMany({
            where: { orderId },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return { data: logs };
    }

    /* BigInt serialization helper */
    private serializeOrder(order: any): any {
        return JSON.parse(
            JSON.stringify(order, (_key, value) =>
                typeof value === 'bigint' ? value.toString() : value,
            ),
        );
    }
}
