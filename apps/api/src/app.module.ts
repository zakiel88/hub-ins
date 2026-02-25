import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { CollectionsModule } from './collections/collections.module';
import { ProductsModule } from './products/products.module';
import { ColorwaysModule } from './colorways/colorways.module';
import { PricingModule } from './pricing/pricing.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrdersModule } from './orders/orders.module';
import { ShopifyStoresModule } from './shopify-stores/shopify-stores.module';
import { AuditModule } from './audit/audit.module';
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
        ProductsModule,
        ColorwaysModule,
        PricingModule,
        InventoryModule,
        OrdersModule,
        ShopifyStoresModule,
    ],
    providers: [
        // Global JWT guard — all routes require auth unless @Public()
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        // Global Roles guard — checks @Roles() decorator
        { provide: APP_GUARD, useClass: RolesGuard },
    ],
})
export class AppModule { }
