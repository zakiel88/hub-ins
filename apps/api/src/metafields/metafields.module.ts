import { Module } from '@nestjs/common';
import { MetafieldsService } from './metafields.service';
import { MetafieldsController } from './metafields.controller';
import { MetafieldsPushService } from './metafields-push.service';
import { CatalogValidationService } from './catalog-validation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ShopifyStoresModule } from '../shopify-stores/shopify-stores.module';

@Module({
    imports: [PrismaModule, ShopifyStoresModule],
    controllers: [MetafieldsController],
    providers: [MetafieldsService, MetafieldsPushService, CatalogValidationService],
    exports: [MetafieldsService, MetafieldsPushService, CatalogValidationService],
})
export class MetafieldsModule { }
