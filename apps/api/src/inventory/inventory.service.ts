import {
    Injectable,
    NotFoundException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class InventoryService {
    private readonly logger = new Logger(InventoryService.name);

    constructor(
        private prisma: PrismaService,
        private audit: AuditService,
    ) { }

    /* ── Warehouses ── */

    async findAllWarehouses(query: {
        search?: string;
        isActive?: string;
        page?: number;
        limit?: number;
    }) {
        const { search, isActive, page = 1, limit = 50 } = query;
        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (isActive !== undefined) {
            where.isActive = isActive === 'true';
        }

        const [data, total] = await Promise.all([
            this.prisma.warehouse.findMany({
                where,
                include: { _count: { select: { inventoryItems: true } } },
                orderBy: { name: 'asc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.warehouse.count({ where }),
        ]);

        return { data, meta: { page, limit, total } };
    }

    async findWarehouseById(id: string) {
        const warehouse = await this.prisma.warehouse.findUnique({
            where: { id },
            include: { _count: { select: { inventoryItems: true } } },
        });
        if (!warehouse) throw new NotFoundException('Warehouse not found');
        return { data: warehouse };
    }

    async createWarehouse(dto: { code: string; name: string; address?: string }, userId: string) {
        const exists = await this.prisma.warehouse.findUnique({ where: { code: dto.code } });
        if (exists) throw new ConflictException(`Warehouse code "${dto.code}" already exists`);

        const warehouse = await this.prisma.warehouse.create({ data: dto });
        this.audit.log({ userId, action: 'warehouse.create', entityType: 'Warehouse', entityId: warehouse.id, changes: dto });
        return { data: warehouse };
    }

    async updateWarehouse(id: string, dto: { name?: string; address?: string; isActive?: boolean }, userId: string) {
        const warehouse = await this.prisma.warehouse.findUnique({ where: { id } });
        if (!warehouse) throw new NotFoundException('Warehouse not found');

        const updated = await this.prisma.warehouse.update({ where: { id }, data: dto });
        this.audit.log({ userId, action: 'warehouse.update', entityType: 'Warehouse', entityId: id, changes: dto });
        return { data: updated };
    }

    /* ── Inventory Items ── */

    async findAllInventory(query: {
        warehouseId?: string;
        variantId?: string;
        syncStatus?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const { warehouseId, variantId, syncStatus, search, page = 1, limit = 50 } = query;
        const where: any = {};

        if (warehouseId) where.warehouseId = warehouseId;
        if (variantId) where.variantId = variantId;
        if (syncStatus) where.syncStatus = syncStatus;
        if (search) {
            where.variant = { sku: { contains: search, mode: 'insensitive' } };
        }

        const [data, total] = await Promise.all([
            this.prisma.inventoryItem.findMany({
                where,
                include: {
                    variant: {
                        include: {
                            product: {
                                include: {
                                    collection: { include: { brand: true } },
                                },
                            },
                        },
                    },
                    warehouse: true,
                },
                orderBy: { updatedAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.inventoryItem.count({ where }),
        ]);

        return { data, meta: { page, limit, total } };
    }

    async findInventoryById(id: string) {
        const item = await this.prisma.inventoryItem.findUnique({
            where: { id },
            include: {
                variant: {
                    include: {
                        product: {
                            include: {
                                collection: { include: { brand: true } },
                            },
                        },
                    },
                },
                warehouse: true,
            },
        });
        if (!item) throw new NotFoundException('Inventory item not found');
        return { data: item };
    }

    async upsertInventory(
        dto: { variantId: string; warehouseId: string; quantityOnHand: number; quantityReserved?: number },
        userId: string,
    ) {
        // Validate refs
        const [variant, warehouse] = await Promise.all([
            this.prisma.productVariant.findUnique({ where: { id: dto.variantId } }),
            this.prisma.warehouse.findUnique({ where: { id: dto.warehouseId } }),
        ]);
        if (!variant) throw new NotFoundException('Variant not found');
        if (!warehouse) throw new NotFoundException('Warehouse not found');

        const item = await this.prisma.inventoryItem.upsert({
            where: {
                uq_inv_variant_warehouse: {
                    variantId: dto.variantId,
                    warehouseId: dto.warehouseId,
                },
            },
            create: {
                variantId: dto.variantId,
                warehouseId: dto.warehouseId,
                quantityOnHand: dto.quantityOnHand,
                quantityReserved: dto.quantityReserved ?? 0,
            },
            update: {
                quantityOnHand: dto.quantityOnHand,
                quantityReserved: dto.quantityReserved,
            },
            include: { variant: true, warehouse: true },
        });

        this.audit.log({ userId, action: 'inventory.upsert', entityType: 'InventoryItem', entityId: item.id, changes: dto });
        return { data: item };
    }

    async adjustStock(
        id: string,
        dto: { adjustment: number; reason?: string },
        userId: string,
    ) {
        const item = await this.prisma.inventoryItem.findUnique({ where: { id } });
        if (!item) throw new NotFoundException('Inventory item not found');

        const newQty = item.quantityOnHand + dto.adjustment;
        if (newQty < 0) throw new ConflictException('Adjustment would result in negative stock');

        const updated = await this.prisma.inventoryItem.update({
            where: { id },
            data: { quantityOnHand: newQty },
            include: { variant: true, warehouse: true },
        });

        this.audit.log({
            userId, action: 'inventory.adjust', entityType: 'InventoryItem', entityId: id,
            changes: { adjustment: dto.adjustment, reason: dto.reason, previousQty: item.quantityOnHand, newQty },
        });
        return { data: updated };
    }

    /* ── Summary ── */

    async getWarehouseSummary(warehouseId: string) {
        const warehouse = await this.prisma.warehouse.findUnique({ where: { id: warehouseId } });
        if (!warehouse) throw new NotFoundException('Warehouse not found');

        const agg = await this.prisma.inventoryItem.aggregate({
            where: { warehouseId },
            _sum: { quantityOnHand: true, quantityReserved: true },
            _count: true,
        });

        return {
            data: {
                warehouse,
                totalSkus: agg._count,
                totalOnHand: agg._sum.quantityOnHand ?? 0,
                totalReserved: agg._sum.quantityReserved ?? 0,
                totalAvailable: (agg._sum.quantityOnHand ?? 0) - (agg._sum.quantityReserved ?? 0),
            },
        };
    }
}
