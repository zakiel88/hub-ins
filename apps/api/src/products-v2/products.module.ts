import { Module } from '@nestjs/common';
import { ProductsV2Controller } from './products.controller';
import { ProductsV2Service } from './products.service';
import { ProductRulesService } from './product-rules.service';
import { IntakeService } from './intake.service';
import { ShopifyListingService } from './shopify-listing.service';
import { ShopifyStoresModule } from '../shopify-stores/shopify-stores.module';

@Module({
    imports: [ShopifyStoresModule],
    controllers: [ProductsV2Controller],
    providers: [ProductsV2Service, ProductRulesService, IntakeService, ShopifyListingService],
    exports: [ProductsV2Service, ProductRulesService, IntakeService, ShopifyListingService],
})
export class ProductsV2Module { }
