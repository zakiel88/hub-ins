import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export type TaskType = 'CX_VERIFY' | 'MER_REVIEW';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) { }

    /** Create a task */
    async create(data: {
        type: TaskType;
        orderId: string;
        assigneeId?: string;
        priority?: string;
        notes?: string;
        dueAt?: string;
    }, userId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: data.orderId },
            include: {
                lineItems: { include: { brand: true } },
            },
        });
        if (!order) throw new NotFoundException('Order not found');

        // Auto-generate notes from order data if not provided
        const notes = data.notes || this.generateTaskNotes(data.type, order);

        const task = await this.prisma.task.create({
            data: {
                type: data.type,
                orderId: data.orderId,
                assigneeId: data.assigneeId || null,
                priority: data.priority || 'NORMAL',
                notes,
                dueAt: data.dueAt ? new Date(data.dueAt) : null,
            },
            include: { order: true, assignee: true },
        });

        await this.audit.log({
            userId,
            action: 'task.create',
            entityType: 'Task',
            entityId: task.id,
            changes: { type: data.type, orderId: data.orderId },
        });

        this.logger.log(`Task ${data.type} created for order ${order.orderNumber}`);
        return { data: this.serialize(task) };
    }

    /** Generate specific task notes from order data */
    private generateTaskNotes(type: TaskType, order: any): string {
        const addr = order.shippingAddress || {};
        const country = addr.country || order.shippingCountry || '—';

        if (type === 'CX_VERIFY') {
            const parts = [
                `Đơn ${order.orderNumber}`,
                `KH: ${order.customerName || '—'}`,
                `Email: ${order.customerEmail || '—'}`,
                `SĐT: ${order.customerPhone || 'chưa có'}`,
                `Ship: ${[addr.city, country].filter(Boolean).join(', ')}`,
            ];
            if (addr.address1) parts.push(`Địa chỉ: ${addr.address1}`);
            return parts.join(' | ');
        }

        if (type === 'MER_REVIEW') {
            const items = order.lineItems || [];
            const total = items.length;
            const mapped = items.filter((li: any) => li.mappingStatus === 'MAPPED').length;
            const unmapped = total - mapped;
            const brands = [...new Set(items.map((li: any) => li.brand?.name).filter(Boolean))];
            const unmappedSkus = items
                .filter((li: any) => li.mappingStatus !== 'MAPPED')
                .map((li: any) => li.sku || li.title?.slice(0, 30))
                .slice(0, 3);

            const parts = [
                `Đơn ${order.orderNumber}`,
                `${total} sp: ${mapped} có hàng, ${unmapped} chưa liên kết`,
            ];
            if (brands.length) parts.push(`Brand: ${brands.join(', ')}`);
            if (unmappedSkus.length) parts.push(`Cần kiểm tra: ${unmappedSkus.join(', ')}`);
            return parts.join(' | ');
        }

        return `Đơn ${order.orderNumber}`;
    }

    /** Update task status */
    async updateStatus(taskId: string, status: TaskStatus, userId: string) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task) throw new NotFoundException('Task not found');

        const updated = await this.prisma.task.update({
            where: { id: taskId },
            data: {
                status,
                completedAt: status === 'DONE' ? new Date() : task.completedAt,
            },
            include: { order: true, assignee: true },
        });

        await this.audit.log({
            userId,
            action: 'task.updateStatus',
            entityType: 'Task',
            entityId: taskId,
            changes: { from: task.status, to: status },
        });

        return { data: this.serialize(updated) };
    }

    /** Assign task to user */
    async assign(taskId: string, assigneeId: string, userId: string) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task) throw new NotFoundException('Task not found');

        const updated = await this.prisma.task.update({
            where: { id: taskId },
            data: { assigneeId },
            include: { order: true, assignee: true },
        });

        await this.audit.log({
            userId,
            action: 'task.assign',
            entityType: 'Task',
            entityId: taskId,
            changes: { assigneeId },
        });

        return { data: this.serialize(updated) };
    }

    /** Add comment to task */
    async addComment(taskId: string, content: string, userId: string) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task) throw new NotFoundException('Task not found');

        try {
            const comment = await this.prisma.taskComment.create({
                data: { taskId, userId, content },
                include: { user: { select: { id: true, fullName: true, email: true } } },
            });
            return { data: this.serialize(comment) };
        } catch (err: any) {
            this.logger.error(`addComment failed: ${err.message}`, err.stack);
            throw err;
        }
    }

    /** List tasks with filters */
    async findAll(filters: {
        type?: string;
        status?: string;
        assigneeId?: string;
        orderId?: string;
        page?: number;
        limit?: number;
    }) {
        const { type, status, assigneeId, orderId, page = 1, limit = 50 } = filters;

        const where: any = {};
        if (type) where.type = type;
        if (status) where.status = status;
        if (assigneeId) where.assigneeId = assigneeId;
        if (orderId) where.orderId = orderId;

        const [tasks, total] = await Promise.all([
            this.prisma.task.findMany({
                where,
                include: {
                    order: { select: { id: true, orderNumber: true, pipelineState: true, customerName: true } },
                    assignee: { select: { id: true, fullName: true, email: true } },
                    _count: { select: { comments: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.task.count({ where }),
        ]);

        return { data: tasks.map(t => this.serialize(t)), meta: { total, page, limit } };
    }

    /** Get task by ID with comments */
    async findOne(id: string) {
        const task = await this.prisma.task.findUnique({
            where: { id },
            include: {
                order: true,
                assignee: { select: { id: true, fullName: true, email: true } },
                comments: {
                    include: { user: { select: { id: true, fullName: true } } },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!task) throw new NotFoundException('Task not found');
        return { data: this.serialize(task) };
    }

    /** Task summary for dashboard */
    async getSummary() {
        const [byType, byStatus, openCount] = await Promise.all([
            this.prisma.task.groupBy({ by: ['type'], where: { status: { not: 'DONE' } }, _count: true }),
            this.prisma.task.groupBy({ by: ['status'], _count: true }),
            this.prisma.task.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        ]);

        return {
            data: {
                openCount,
                byType: byType.reduce((acc, r) => ({ ...acc, [r.type]: r._count }), {}),
                byStatus: byStatus.reduce((acc, r) => ({ ...acc, [r.status]: r._count }), {}),
            },
        };
    }

    private serialize(obj: any): any {
        return JSON.parse(JSON.stringify(obj, (_k, v) => typeof v === 'bigint' ? v.toString() : v));
    }
}
