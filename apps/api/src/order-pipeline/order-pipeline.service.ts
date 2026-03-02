import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

/** All valid pipeline states */
export const PIPELINE_STATES = [
    'NEW_FROM_SHOPIFY',
    'CHECKING_ADDRESS',
    'MER_CHECK',
    'WAITING_PURCHASE',
    'READY_TO_FULFILL',
    'FULFILLED',
    'ON_HOLD',
    'CANCELLED',
] as const;

export type PipelineState = (typeof PIPELINE_STATES)[number];

/** Valid transitions: from → [allowed targets] */
const TRANSITION_MAP: Record<string, string[]> = {
    NEW_FROM_SHOPIFY: ['CHECKING_ADDRESS', 'MER_CHECK', 'ON_HOLD', 'CANCELLED'],
    CHECKING_ADDRESS: ['MER_CHECK', 'ON_HOLD', 'CANCELLED'],
    MER_CHECK: ['WAITING_PURCHASE', 'READY_TO_FULFILL', 'ON_HOLD', 'CANCELLED'],
    WAITING_PURCHASE: ['READY_TO_FULFILL', 'MER_CHECK', 'ON_HOLD', 'CANCELLED'],
    READY_TO_FULFILL: ['FULFILLED', 'ON_HOLD', 'CANCELLED'],
    FULFILLED: [], // terminal state
    ON_HOLD: ['NEW_FROM_SHOPIFY', 'CHECKING_ADDRESS', 'MER_CHECK', 'CANCELLED'],
    CANCELLED: [], // terminal state
};

@Injectable()
export class OrderPipelineService {
    private readonly logger = new Logger(OrderPipelineService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    /** Get order by ID with full includes */
    async getOrderById(orderId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                lineItems: { include: { brand: true } },
                shopifyStore: { select: { id: true, storeName: true } },
            },
        });
        if (!order) throw new BadRequestException('Order not found');
        return order;
    }

    /** Transition an order to a new pipeline state */
    async transition(orderId: string, targetState: string, userId: string, reason?: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
        });
        if (!order) throw new BadRequestException('Order not found');

        const currentState = order.pipelineState;
        const allowed = TRANSITION_MAP[currentState] || [];

        if (!allowed.includes(targetState)) {
            throw new BadRequestException(
                `Cannot transition from ${currentState} to ${targetState}. Allowed: ${allowed.join(', ')}`,
            );
        }

        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { pipelineState: targetState },
        });

        await this.audit.log({
            userId,
            action: 'order.transition',
            entityType: 'Order',
            entityId: orderId,
            changes: { from: currentState, to: targetState, reason },
        });

        this.logger.log(`Order ${order.orderNumber}: ${currentState} → ${targetState}`);
        return { data: this.serialize(updated) };
    }

    /** Mark item stock status + auto-create PR + auto-transition order */
    async checkItemStock(orderId: string, itemId: string, action: 'IN_STOCK' | 'NEEDS_PURCHASE', userId: string) {
        const item = await this.prisma.orderLineItem.findFirst({
            where: { id: itemId, orderId },
            include: { order: true },
        });
        if (!item) throw new BadRequestException('Item not found in this order');

        // Update item state
        await this.prisma.orderLineItem.update({
            where: { id: itemId },
            data: { itemState: action },
        });

        let createdPR = false;

        // If NEEDS_PURCHASE → auto-create Procurement Request
        if (action === 'NEEDS_PURCHASE') {
            const existingPR = await this.prisma.procurementRequest.findFirst({
                where: { orderItemId: itemId, status: { not: 'CANCELLED' } },
            });
            if (!existingPR && item.brandId) {
                await this.prisma.procurementRequest.create({
                    data: {
                        orderItemId: itemId,
                        brandId: item.brandId,
                        sku: item.sku || item.title,
                        qtyNeeded: item.quantity,
                        notes: `Báo mua từ đơn ${item.order.orderNumber} — ${item.title}`,
                    },
                });
                createdPR = true;
                this.logger.log(`Auto-created PR for item "${item.title}" in order ${item.order.orderNumber}`);
            }

            // Auto-transition order to WAITING_PURCHASE if currently in MER_CHECK
            if (item.order.pipelineState === 'MER_CHECK') {
                await this.prisma.order.update({
                    where: { id: orderId },
                    data: { pipelineState: 'WAITING_PURCHASE' },
                });
                await this.audit.log({
                    userId,
                    action: 'order.auto_transition',
                    entityType: 'Order',
                    entityId: orderId,
                    changes: { from: 'MER_CHECK', to: 'WAITING_PURCHASE', trigger: 'item_needs_purchase' },
                });
                this.logger.log(`Order ${item.order.orderNumber}: auto MER_CHECK → WAITING_PURCHASE`);
            }
        }

        await this.audit.log({
            userId,
            action: 'item.check_stock',
            entityType: 'OrderLineItem',
            entityId: itemId,
            changes: { action, itemTitle: item.title, createdPR },
        });

        // Return updated order with items
        const updatedOrder = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                lineItems: { include: { brand: true } },
                shopifyStore: { select: { id: true, storeName: true } },
            },
        });

        return { data: this.serialize(updatedOrder), createdPR };
    }

    /** Check stock levels for ALL items in an order */
    async checkStockAll(orderId: string) {
        const items = await this.prisma.orderLineItem.findMany({
            where: { orderId },
            include: { brand: true },
        });

        const stockInfo: Record<string, { available: number; onHand: number; reserved: number }> = {};

        for (const item of items) {
            if (item.colorwayId) {
                const invItems = await this.prisma.inventoryItem.findMany({
                    where: { colorwayId: item.colorwayId },
                });
                const onHand = invItems.reduce((s, i) => s + i.quantityOnHand, 0);
                const reserved = invItems.reduce((s, i) => s + i.quantityReserved, 0);
                stockInfo[item.id] = { available: onHand - reserved, onHand, reserved };
            } else {
                stockInfo[item.id] = { available: 0, onHand: 0, reserved: 0 };
            }
        }

        return {
            data: items.map(i => ({
                ...this.serialize(i),
                stock: stockInfo[i.id],
            })),
        };
    }

    /** Bulk mark items as NEEDS_PURCHASE + create PRs + auto transition */
    async markItemsBulk(orderId: string, itemIds: string[], action: 'IN_STOCK' | 'NEEDS_PURCHASE', userId: string) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new BadRequestException('Order not found');

        let createdPRs = 0;

        for (const itemId of itemIds) {
            const item = await this.prisma.orderLineItem.findFirst({
                where: { id: itemId, orderId },
                include: { order: true },
            });
            if (!item) continue;

            await this.prisma.orderLineItem.update({
                where: { id: itemId },
                data: { itemState: action },
            });

            if (action === 'NEEDS_PURCHASE') {
                const existing = await this.prisma.procurementRequest.findFirst({
                    where: { orderItemId: itemId, status: { not: 'CANCELLED' } },
                });
                if (!existing) {
                    await this.prisma.procurementRequest.create({
                        data: {
                            orderItemId: itemId,
                            ...(item.brandId ? { brandId: item.brandId } : {}),
                            sku: item.sku || item.title,
                            qtyNeeded: item.quantity,
                            notes: `Báo mua từ đơn ${order.orderNumber} — ${item.title}`,
                        },
                    });
                    createdPRs++;
                }
            }
        }

        // Auto transition if any NEEDS_PURCHASE and in MER_CHECK
        if (action === 'NEEDS_PURCHASE' && order.pipelineState === 'MER_CHECK') {
            await this.prisma.order.update({
                where: { id: orderId },
                data: { pipelineState: 'WAITING_PURCHASE' },
            });
            await this.audit.log({
                userId,
                action: 'order.auto_transition',
                entityType: 'Order',
                entityId: orderId,
                changes: { from: 'MER_CHECK', to: 'WAITING_PURCHASE', trigger: 'bulk_mark_purchase', itemCount: itemIds.length },
            });
        }

        await this.audit.log({
            userId,
            action: 'items.bulk_mark',
            entityType: 'Order',
            entityId: orderId,
            changes: { action, itemIds, createdPRs },
        });

        // Return updated order
        const updated = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                lineItems: { include: { brand: true } },
                shopifyStore: { select: { id: true, storeName: true } },
            },
        });

        return { data: this.serialize(updated), createdPRs };
    }

    /** Set flags on an order (address_issue, phone_missing, etc.) */
    async setFlags(orderId: string, flags: Record<string, boolean>, userId: string) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new BadRequestException('Order not found');

        const currentFlags = (order.flags as Record<string, boolean>) || {};
        const merged = { ...currentFlags, ...flags };

        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { flags: merged },
        });

        await this.audit.log({
            userId,
            action: 'order.setFlags',
            entityType: 'Order',
            entityId: orderId,
            changes: { flags },
        });

        return { data: this.serialize(updated) };
    }

    /** Get valid transitions for an order's current state */
    getAvailableTransitions(pipelineState: string): string[] {
        return TRANSITION_MAP[pipelineState] || [];
    }

    /** Dashboard: count orders by pipeline state */
    async getStateSummary() {
        const result = await this.prisma.order.groupBy({
            by: ['pipelineState'],
            _count: true,
        });

        const summary: Record<string, number> = {};
        for (const s of PIPELINE_STATES) {
            summary[s] = 0;
        }
        for (const r of result) {
            summary[r.pipelineState] = r._count;
        }

        const total = Object.values(summary).reduce((a, b) => a + b, 0);
        return { data: { total, byState: summary } };
    }

    /** Merchandise: get all line items across orders with filters */
    async getMerchandiseItems(filters: {
        itemState?: string;
        orderState?: string;
        brandId?: string;
        search?: string;
        includeFulfilled?: boolean;
        page?: number;
        limit?: number;
    }) {
        const { itemState, orderState, brandId, search, includeFulfilled = false, page = 1, limit = 50 } = filters;
        const where: any = {};

        if (itemState) where.itemState = itemState;
        if (brandId) where.brandId = brandId;

        // If specific orderState is requested, use it; otherwise exclude fulfilled/cancelled
        if (orderState) {
            where.order = { pipelineState: orderState };
        } else if (!includeFulfilled) {
            where.order = {
                pipelineState: { notIn: ['FULFILLED', 'CANCELLED'] },
            };
        }
        if (search) {
            where.OR = [
                { title: { contains: search, mode: 'insensitive' } },
                { sku: { contains: search, mode: 'insensitive' } },
                { order: { orderNumber: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [items, total] = await Promise.all([
            this.prisma.orderLineItem.findMany({
                where,
                include: {
                    order: {
                        select: {
                            id: true,
                            orderNumber: true,
                            pipelineState: true,
                            customerName: true,
                            shippingCountry: true,
                            orderDate: true,
                        },
                    },
                    brand: { select: { id: true, name: true } },
                },
                orderBy: [{ order: { orderDate: 'desc' } }, { createdAt: 'desc' }],
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.orderLineItem.count({ where }),
        ]);

        // Summary stats — respect the same fulfilled filter
        const summaryWhere: any = {};
        if (!includeFulfilled) {
            summaryWhere.order = {
                pipelineState: { notIn: ['FULFILLED', 'CANCELLED'] },
            };
        }
        const stateCounts = await this.prisma.orderLineItem.groupBy({
            by: ['itemState'],
            where: summaryWhere,
            _count: true,
        });
        const summary: Record<string, number> = {};
        for (const s of stateCounts) {
            summary[s.itemState] = s._count;
        }

        return {
            data: this.serialize(items),
            total,
            page,
            limit,
            summary,
        };
    }

    private serialize(obj: any): any {
        return JSON.parse(JSON.stringify(obj, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
    }
}
