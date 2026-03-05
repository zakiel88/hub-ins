import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ShopifyStoresModule } from '../shopify-stores/shopify-stores.module';
import { ShopifySyncService } from './shopify-sync.service';
import { ShopifySyncController } from './shopify-sync.controller';

@Module({
    imports: [PrismaModule, AuditModule, ShopifyStoresModule],
    controllers: [ShopifySyncController],
    providers: [ShopifySyncService],
    exports: [ShopifySyncService],
})
export class ShopifySyncModule { }
