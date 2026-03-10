import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ProcurementService {
    private readonly logger = new Logger(ProcurementService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    /* ── Procurement Requests (PR) ── */

    async createPR(data: {
        orderItemId: string;
        brandId: string;
        sku: string;
        qtyNeeded: number;
        notes?: string;
    }, userId: string) {
        const orderItem = await this.prisma.orderLineItem.findUnique({
            where: { id: data.orderItemId },
            include: { order: true },
        });
        if (!orderItem) throw new NotFoundException('Order item not found');

        const pr = await this.prisma.procurementRequest.create({
            data: {
                orderItemId: data.orderItemId,
                brandId: data.brandId,
                sku: data.sku,
                qtyNeeded: data.qtyNeeded,
                notes: data.notes || null,
            },
            include: { orderItem: { include: { order: true } }, brand: true },
        });

        // Update line item state
        await this.prisma.orderLineItem.update({
            where: { id: data.orderItemId },
            data: { itemState: 'NEEDS_PROCUREMENT' },
        });

        await this.audit.log({
            userId,
            action: 'pr.create',
            entityType: 'ProcurementRequest',
            entityId: pr.id,
            changes: { sku: data.sku, qtyNeeded: data.qtyNeeded, orderId: orderItem.orderId },
        });

        this.logger.log(`PR created: ${data.sku} x${data.qtyNeeded} for order ${orderItem.order.orderNumber}`);
        return { data: this.serialize(pr) };
    }

    async listPRs(filters: { status?: string; brandId?: string; orderId?: string; page?: number; limit?: number }) {
        const { status, brandId, orderId, page = 1, limit = 50 } = filters;
        const where: any = {};
        if (status) where.status = status;
        if (brandId) where.brandId = brandId;
        if (orderId) where.orderItem = { orderId };

        const [items, total] = await Promise.all([
            this.prisma.procurementRequest.findMany({
                where,
                include: {
                    orderItem: { include: { order: { select: { id: true, orderNumber: true } } } },
                    brand: { select: { id: true, name: true, code: true } },
                    poItems: { select: { id: true, poId: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.procurementRequest.count({ where }),
        ]);

        return { data: items.map(i => this.serialize(i)), meta: { total, page, limit } };
    }
    /* ── Update PR Status ── */

    async updatePRStatus(prId: string, status: string, userId: string) {
        const pr = await this.prisma.procurementRequest.findUnique({
            where: { id: prId },
            include: {
                orderItem: {
                    include: { order: { select: { id: true, orderNumber: true, pipelineState: true } } },
                },
            },
        });
        if (!pr) throw new NotFoundException('PR not found');

        const validStatuses = ['OPEN', 'NOTIFIED_BRAND', 'RECEIVED', 'CANCELLED'];
        if (!validStatuses.includes(status)) throw new BadRequestException(`Invalid status: ${status}`);

        // Update PR status
        const updated = await this.prisma.procurementRequest.update({
            where: { id: prId },
            data: { status },
            include: {
                orderItem: { include: { order: { select: { id: true, orderNumber: true, pipelineState: true } } } },
                brand: { select: { id: true, name: true, code: true } },
                poItems: { select: { id: true, poId: true } },
            },
        });

        // ─── When RECEIVED: cascading updates ───
        if (status === 'RECEIVED' && pr.orderItem) {
            const orderItem = pr.orderItem;

            // 1) Mark the OrderLineItem as IN_STOCK
            await this.prisma.orderLineItem.update({
                where: { id: orderItem.id },
                data: { itemState: 'IN_STOCK' },
            });
            this.logger.log(`OrderLineItem ${orderItem.id} → IN_STOCK (PR ${prId} received)`);

            // 2) Upsert InventoryItem if colorwayId is mapped
            if (orderItem.variantId) {
                const defaultWarehouse = await this.prisma.warehouse.findFirst();
                if (defaultWarehouse) {
                    await this.prisma.inventoryItem.upsert({
                        where: {
                            uq_inv_variant_warehouse: {
                                variantId: orderItem.variantId,
                                warehouseId: defaultWarehouse.id,
                            },
                        },
                        create: {
                            variantId: orderItem.variantId,
                            warehouseId: defaultWarehouse.id,
                            quantityOnHand: pr.qtyNeeded,
                        },
                        update: {
                            quantityOnHand: { increment: pr.qtyNeeded },
                        },
                    });
                    this.logger.log(`Inventory +${pr.qtyNeeded} for variant ${orderItem.variantId}`);
                }
            }

            // 3) Auto-transition order if ALL items are now IN_STOCK
            const orderId = orderItem.order.id;
            const allItems = await this.prisma.orderLineItem.findMany({
                where: { orderId },
                select: { itemState: true },
            });
            const allInStock = allItems.length > 0 && allItems.every(i => i.itemState === 'IN_STOCK');

            if (allInStock && orderItem.order.pipelineState === 'WAITING_PURCHASE') {
                await this.prisma.order.update({
                    where: { id: orderId },
                    data: { pipelineState: 'READY_TO_FULFILL' },
                });
                this.logger.log(`Order ${orderItem.order.orderNumber} → READY_TO_FULFILL (all items in stock)`);
            }
        }

        await this.audit.log({
            userId,
            action: 'pr.status_update',
            entityType: 'ProcurementRequest',
            entityId: prId,
            changes: { from: pr.status, to: status },
        });

        return { data: this.serialize(updated) };
    }

    /* ── Purchase Orders (PO) ── */

    async createPO(data: {
        brandId: string;
        prIds: string[];
        notes?: string;
        currency?: string;
    }, userId: string) {
        // Generate PO number
        const count = await this.prisma.purchaseOrder.count();
        const poNumber = `PO-${String(count + 1).padStart(5, '0')}`;

        // Fetch PRs
        const prs = await this.prisma.procurementRequest.findMany({
            where: { id: { in: data.prIds }, status: 'OPEN' },
        });
        if (prs.length === 0) throw new BadRequestException('No valid open PRs found');

        // Create PO with items
        const po = await this.prisma.purchaseOrder.create({
            data: {
                poNumber,
                brandId: data.brandId,
                createdBy: userId,
                notes: data.notes || null,
                currency: data.currency || 'USD',
                items: {
                    create: prs.map((pr) => ({
                        prId: pr.id,
                        sku: pr.sku,
                        qty: pr.qtyNeeded,
                    })),
                },
            },
            include: {
                brand: { select: { id: true, name: true, code: true } },
                creator: { select: { id: true, fullName: true } },
                items: { include: { procurementRequest: true } },
            },
        });

        // Update PRs status to IN_PO
        await this.prisma.procurementRequest.updateMany({
            where: { id: { in: data.prIds } },
            data: { status: 'IN_PO' },
        });

        await this.audit.log({
            userId,
            action: 'po.create',
            entityType: 'PurchaseOrder',
            entityId: po.id,
            changes: { poNumber, prCount: prs.length },
        });

        this.logger.log(`PO ${poNumber} created with ${prs.length} items`);
        return { data: this.serialize(po) };
    }

    async updatePOStatus(poId: string, status: string, userId: string) {
        const po = await this.prisma.purchaseOrder.findUnique({ where: { id: poId } });
        if (!po) throw new NotFoundException('PO not found');

        const validTransitions: Record<string, string[]> = {
            DRAFT: ['SENT', 'CANCELLED'],
            SENT: ['CONFIRMED', 'CANCELLED'],
            CONFIRMED: ['RECEIVED', 'CANCELLED'],
            RECEIVED: [],
            CANCELLED: [],
        };

        const allowed = validTransitions[po.status] || [];
        if (!allowed.includes(status)) {
            throw new BadRequestException(
                `Cannot transition PO from ${po.status} to ${status}. Allowed: ${allowed.join(', ')}`,
            );
        }

        const updated = await this.prisma.purchaseOrder.update({
            where: { id: poId },
            data: {
                status,
                issuedAt: status === 'SENT' ? new Date() : po.issuedAt,
            },
            include: {
                brand: { select: { id: true, name: true } },
                items: true,
            },
        });

        await this.audit.log({
            userId,
            action: 'po.updateStatus',
            entityType: 'PurchaseOrder',
            entityId: poId,
            changes: { from: po.status, to: status },
        });

        return { data: this.serialize(updated) };
    }

    async listPOs(filters: { status?: string; brandId?: string; page?: number; limit?: number }) {
        const { status, brandId, page = 1, limit = 50 } = filters;
        const where: any = {};
        if (status) where.status = status;
        if (brandId) where.brandId = brandId;

        const [items, total] = await Promise.all([
            this.prisma.purchaseOrder.findMany({
                where,
                include: {
                    brand: { select: { id: true, name: true, code: true } },
                    creator: { select: { id: true, fullName: true } },
                    _count: { select: { items: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.purchaseOrder.count({ where }),
        ]);

        return { data: items, meta: { total, page, limit } };
    }

    async findPO(id: string) {
        const po = await this.prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                brand: true,
                creator: { select: { id: true, fullName: true, email: true } },
                items: {
                    include: {
                        procurementRequest: {
                            include: {
                                orderItem: {
                                    include: { order: { select: { id: true, orderNumber: true } } },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!po) throw new NotFoundException('PO not found');
        return { data: this.serialize(po) };
    }

    private serialize(obj: any): any {
        return JSON.parse(JSON.stringify(obj, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
    }
}
