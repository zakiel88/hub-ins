import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { CollectionsModule } from './collections/collections.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { ShopifyStoresModule } from './shopify-stores/shopify-stores.module';
import { AuditModule } from './audit/audit.module';
import { UsersModule } from './users/users.module';
import { MailModule } from './mail/mail.module';
import { OrderPipelineModule } from './order-pipeline/order-pipeline.module';
import { TasksModule } from './tasks/tasks.module';
import { ProcurementModule } from './procurement/procurement.module';
import { UploadsModule } from './uploads/uploads.module';
import { ShopifySyncModule } from './shopify-sync/shopify-sync.module';
import { JobsModule } from './jobs/jobs.module';
import { MetafieldsModule } from './metafields/metafields.module';
import { ProductsV2Module } from './products-v2/products.module';
import { JwtAuthGuard } from './auth/guards';
import { RolesGuard } from './auth/guards';
import { getConfig } from './config/configuration';

@Module({
    imports: [
        LoggerModule.forRoot({
            pinoHttp: {
                level: getConfig().LOG_LEVEL,
                transport:
                    getConfig().NODE_ENV === 'development'
                        ? { target: 'pino-pretty', options: { colorize: true } }
                        : undefined,
                redact: {
                    paths: [
                        'req.headers.authorization',
                        'req.headers.cookie',
                        '*.password',
                        '*.passwordHash',
                        '*.access_token',
                        '*.access_token_enc',
                        '*.token_iv',
                        '*.encryption_key',
                        '*.jwt_secret',
                    ],
                    censor: '[REDACTED]',
                },
                serializers: {
                    req: (req: any) => ({
                        id: req.id,
                        method: req.method,
                        url: req.url,
                    }),
                },
            },
        }),
        PrismaModule,
        AuditModule,
        AuthModule,
        HealthModule,
        BrandsModule,
        CollectionsModule,
        InventoryModule,
        OrdersModule,
        ShopifyStoresModule,
        UsersModule,
        MailModule,
        OrderPipelineModule,
        TasksModule,
        ProcurementModule,
        UploadsModule,
        ShopifySyncModule,
        JobsModule,
        MetafieldsModule,
        ProductsV2Module,
    ],
    providers: [
        // Global JWT guard — all routes require auth unless @Public()
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        // Global Roles guard — checks @Roles() decorator
        { provide: APP_GUARD, useClass: RolesGuard },
    ],
})
export class AppModule { }
