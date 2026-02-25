import {
    Controller,
    Get,
    Post,
    Put,
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

    // GET /api/v1/products?collectionId=&status=&category=&search=
    @Get('products')
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async findAll(
        @Query('collectionId') collectionId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('category') category?: string,
    ) {
        return this.productsService.findAll({
            collectionId,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            status,
            search,
            category,
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
}
