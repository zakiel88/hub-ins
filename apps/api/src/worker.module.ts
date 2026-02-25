/**
 * WorkerModule — NestJS module for background job processing.
 *
 * This module registers:
 * - PrismaModule (DB access for job processors)
 * - ConfigModule
 * - BullMQ queue processors (webhook, sync, publish, import)
 *
 * It does NOT register HTTP controllers, auth guards, or pino HTTP logger.
 * This keeps the worker lightweight and focused.
 *
 * When BullMQ is implemented, add queue modules here:
 *   imports: [PrismaModule, WebhookQueueModule, SyncQueueModule, ...]
 */
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';

@Module({
    imports: [
        PrismaModule,
        AuditModule,
        // TODO: Add BullMQ queue processor modules here
        // WebhookProcessorModule,
        // SyncProcessorModule,
        // PublishProcessorModule,
        // ImportProcessorModule,
    ],
})
export class WorkerModule { }
