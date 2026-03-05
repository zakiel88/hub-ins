import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobsService {
    private readonly logger = new Logger(JobsService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll(params: {
        page?: number;
        limit?: number;
        status?: string;
        jobType?: string;
        storeId?: string;
    }) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (params.status) where.status = params.status;
        if (params.jobType) where.jobType = params.jobType;
        if (params.storeId) where.storeId = params.storeId;

        const [data, total] = await Promise.all([
            this.prisma.syncJob.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    store: { select: { id: true, storeName: true, shopifyDomain: true } },
                    _count: { select: { logs: true } },
                },
            }),
            this.prisma.syncJob.count({ where }),
        ]);

        return { data, meta: { page, limit, total } };
    }

    async findById(id: string) {
        const job = await this.prisma.syncJob.findUnique({
            where: { id },
            include: {
                store: { select: { id: true, storeName: true, shopifyDomain: true } },
                logs: {
                    orderBy: { createdAt: 'desc' },
                    take: 100,
                },
            },
        });
        return job;
    }

    async retry(id: string) {
        const job = await this.prisma.syncJob.findUnique({ where: { id } });
        if (!job || job.status !== 'failed') return null;

        // Reset status to pending for retry
        return this.prisma.syncJob.update({
            where: { id },
            data: {
                status: 'pending',
                errorMsg: null,
                processed: 0,
                failed: 0,
                completedAt: null,
            },
        });
    }

    async getSummary() {
        const [total, running, success, failed, pending] = await Promise.all([
            this.prisma.syncJob.count(),
            this.prisma.syncJob.count({ where: { status: 'running' } }),
            this.prisma.syncJob.count({ where: { status: 'success' } }),
            this.prisma.syncJob.count({ where: { status: 'failed' } }),
            this.prisma.syncJob.count({ where: { status: 'pending' } }),
        ]);
        return { total, running, success, failed, pending };
    }

    // ─── B: Manual cancel a stuck/running job ────────
    async cancelJob(id: string) {
        const job = await this.prisma.syncJob.findUnique({ where: { id } });
        if (!job) return null;
        if (job.status !== 'running' && job.status !== 'pending') return job;

        return this.prisma.syncJob.update({
            where: { id },
            data: {
                status: 'failed',
                errorMsg: 'Manually cancelled by admin',
                completedAt: new Date(),
            },
        });
    }

    // ─── A: Startup cleanup — mark stale running jobs as failed ───
    async cleanupZombieJobs() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const result = await this.prisma.syncJob.updateMany({
            where: {
                status: 'running',
                startedAt: { lt: oneHourAgo },
            },
            data: {
                status: 'failed',
                errorMsg: 'Zombie: server restarted while job was running',
                completedAt: new Date(),
            },
        });

        if (result.count > 0) {
            this.logger.warn(`🧟 Cleaned up ${result.count} zombie job(s)`);
        }
        return result.count;
    }
}
