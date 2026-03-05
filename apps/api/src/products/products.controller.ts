import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { Roles, CurrentUser, JwtPayload } from '../auth/decorators';

@Controller('api/v1')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Get('products/summary')
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async getSummary() {
        return this.productsService.getSummary();
    }

    // GET /api/v1/products?collectionId=&status=&category=&search=&brandId=&hasConflict=
    @Get('products')
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async findAll(
        @Query('collectionId') collectionId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('category') category?: string,
        @Query('brandId') brandId?: string,
        @Query('hasConflict') hasConflict?: string,
    ) {
        return this.productsService.findAll({
            collectionId,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            status,
            search,
            category,
            brandId,
            hasConflict: hasConflict === 'true' ? true : hasConflict === 'false' ? false : undefined,
        });
    }

    // GET /api/v1/products/:id
    @Get('products/:id')
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async findById(@Param('id', ParseUUIDPipe) id: string) {
        const product = await this.productsService.findById(id);
        return { data: product };
    }

    // POST /api/v1/collections/:collectionId/products
    @Post('collections/:collectionId/products')
    @Roles('admin', 'merchandising')
    async create(
        @Param('collectionId', ParseUUIDPipe) collectionId: string,
        @Body() body: {
            name: string;
            skuPrefix?: string;
            category?: string;
            material?: string;
            description?: string;
            wholesalePrice?: number;
            status?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const product = await this.productsService.create(
            { ...body, collectionId },
            user.sub,
        );
        return { data: product };
    }

    // PUT /api/v1/products/:id
    @Put('products/:id')
    @Roles('admin', 'merchandising')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: {
            name?: string;
            skuPrefix?: string;
            category?: string;
            material?: string;
            description?: string;
            wholesalePrice?: number;
            status?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const product = await this.productsService.update(id, body, user.sub);
        return { data: product };
    }

    // DELETE /api/v1/products/:id
    @Delete('products/:id')
    @Roles('admin', 'sourcing_procurement')
    async remove(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: JwtPayload,
    ) {
        await this.productsService.remove(id, user.sub);
        return { message: 'Product deleted' };
    }

    // ─── Sprint 2: Category + Pricing ────────────

    // PATCH /api/v1/products/:id/category
    @Patch('products/:id/category')
    @Roles('admin', 'merchandising')
    async updateCategory(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: { shopifyCategoryId: string | null },
        @CurrentUser() user: JwtPayload,
    ) {
        const product = await this.productsService.updateCategory(id, body.shopifyCategoryId, user.sub);
        return { data: product };
    }

    // PATCH /api/v1/products/:productId/variants/:variantId/pricing
    @Patch('products/:productId/variants/:variantId/pricing')
    @Roles('admin', 'merchandising')
    async updateVariantPricing(
        @Param('variantId', ParseUUIDPipe) variantId: string,
        @Body() body: { vendorPrice?: number; cogs?: number },
        @CurrentUser() user: JwtPayload,
    ) {
        const variant = await this.productsService.updateVariantPricing(variantId, body, user.sub);
        return { data: variant };
    }
}
