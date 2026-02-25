import { Module } from '@nestjs/common';
import { ShopifyStoresService } from './shopify-stores.service';
import { ShopifyStoresController } from './shopify-stores.controller';

@Module({
    controllers: [ShopifyStoresController],
    providers: [ShopifyStoresService],
    exports: [ShopifyStoresService],
})
export class ShopifyStoresModule { }
