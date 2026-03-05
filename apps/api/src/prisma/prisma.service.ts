import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Force-load .env with override to ensure local DATABASE_URL is used
// (system env var may point to production Supabase)
dotenv.config({
    path: path.resolve(__dirname, '../../.env'),
    override: true,
});

@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy {

    private readonly logger = new Logger(PrismaService.name);

    constructor() {
        super();
        const dbUrl = process.env.DATABASE_URL || '';
        const host = dbUrl.includes('@') ? dbUrl.split('@')[1]?.split('/')[0] : 'unknown';
        this.logger.log(`Prisma connecting to: ${host}`);
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
