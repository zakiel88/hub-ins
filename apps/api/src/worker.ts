/**
 * Worker entry point — runs BullMQ job processors.
 * Deployed as a separate Railway service (same codebase, different start command).
 *
 * Start: node dist/worker.js
 *
 * This file bootstraps a NestJS application context (no HTTP server)
 * that registers all queue processors. When BullMQ modules are implemented,
 * import them into WorkerModule below.
 */
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { validateConfig } from './config/configuration';

async function bootstrap() {
    // Fail-fast: validate env
    validateConfig();

    const app = await NestFactory.createApplicationContext(WorkerModule, {
        logger: ['log', 'error', 'warn'],
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('🔧 Worker received SIGTERM — shutting down…');
        await app.close();
        process.exit(0);
    });

    console.log('🔧 INS Commerce Hub Worker started — processing background jobs');
}
bootstrap();
