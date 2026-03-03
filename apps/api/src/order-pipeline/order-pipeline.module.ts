import { Module } from '@nestjs/common';
import { OrderPipelineService } from './order-pipeline.service';
import { OrderPipelineController } from './order-pipeline.controller';
import { OrderSyncService } from './order-sync.service';
import { WebhookController } from './webhook.controller';
import { FedexService } from './fedex.service';
import { ShopifyStoresModule } from '../shopify-stores/shopify-stores.module';

@Module({
    imports: [ShopifyStoresModule],
    controllers: [OrderPipelineController, WebhookController],
    providers: [OrderPipelineService, OrderSyncService, FedexService],
    exports: [OrderPipelineService, OrderSyncService, FedexService],
})
export class OrderPipelineModule { }
