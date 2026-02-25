import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
    private readonly logger = new Logger(AuditService.name);

    constructor(private readonly prisma: PrismaService) { }

    async log(params: {
        userId: string;
        action: string;
        entityType: string;
        entityId: string;
        changes?: object;
        ipAddress?: string;
    }) {
        try {
            await this.prisma.auditLog.create({
                data: {
                    userId: params.userId,
                    action: params.action,
                    entityType: params.entityType,
                    entityId: params.entityId,
                    changes: params.changes as any ?? undefined,
                    ipAddress: params.ipAddress,
                },
            });
        } catch (error) {
            // Audit logging should never break the main flow
            this.logger.error(`Failed to write audit log: ${error}`, {
                action: params.action,
                entityType: params.entityType,
                entityId: params.entityId,
            });
        }
    }
}
