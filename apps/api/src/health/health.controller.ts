import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Redis from 'ioredis';
import { getConfig } from '../config/configuration';
import { Public } from '../auth/decorators';

@Public()
@Controller()
export class HealthController {
    private redis: Redis;

    constructor(private readonly prisma: PrismaService) {
        const config = getConfig();
        this.redis = new Redis({
            host: config.REDIS_HOST,
            port: config.REDIS_PORT,
            password: config.REDIS_PASSWORD || undefined,
            tls: config.REDIS_TLS === 'true' ? {} : undefined,
            maxRetriesPerRequest: 1,
            lazyConnect: true,
        });
    }

    /**
     * GET /api/v1/health — basic liveness (always 200 if process is up)
     */
    @Get('api/v1/health')
    health() {
        return { status: 'ok', timestamp: new Date().toISOString() };
    }

    /**
     * GET /health/ready — readiness probe (checks DB + Redis)
     */
    @Get('health/ready')
    async readiness() {
        const checks: Record<string, string> = {};

        try {
            await this.prisma.$queryRawUnsafe('SELECT 1');
            checks.db = 'ok';
        } catch {
            checks.db = 'error';
        }

        try {
            await this.redis.connect().catch(() => { });
            const pong = await this.redis.ping();
            checks.redis = pong === 'PONG' ? 'ok' : 'error';
        } catch {
            checks.redis = 'error';
        }

        const allOk = Object.values(checks).every((v) => v === 'ok');
        if (!allOk) {
            throw new ServiceUnavailableException({
                status: 'not_ready',
                checks,
            });
        }

        return { status: 'ready', checks, timestamp: new Date().toISOString() };
    }
}
