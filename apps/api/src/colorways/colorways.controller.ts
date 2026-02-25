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
import { ColorwaysService } from './colorways.service';
import { Roles, CurrentUser, JwtPayload } from '../auth/decorators';

@Controller('api/v1')
export class ColorwaysController {
    constructor(private readonly colorwaysService: ColorwaysService) { }

    // GET /api/v1/colorways?productId=&status=&search=
    @Get('colorways')
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async findAll(
        @Query('productId') productId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('search') search?: string,
    ) {
        return this.colorwaysService.findAll({
            productId,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            status,
            search,
        });
    }

    // GET /api/v1/colorways/:id
    @Get('colorways/:id')
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async findById(@Param('id', ParseUUIDPipe) id: string) {
        const colorway = await this.colorwaysService.findById(id);
        return { data: colorway };
    }

    // POST /api/v1/products/:productId/colorways
    @Post('products/:productId/colorways')
    @Roles('admin', 'merchandising')
    async create(
        @Param('productId', ParseUUIDPipe) productId: string,
        @Body() body: {
            sku: string;
            color: string;
            size: string;
            barcode?: string;
            weightGrams?: number;
            images?: any;
            status?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const colorway = await this.colorwaysService.create(
            { ...body, productId },
            user.sub,
        );
        return { data: colorway };
    }

    // PUT /api/v1/colorways/:id
    @Put('colorways/:id')
    @Roles('admin', 'merchandising')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: {
            color?: string;
            size?: string;
            barcode?: string;
            weightGrams?: number;
            images?: any;
            status?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const colorway = await this.colorwaysService.update(id, body, user.sub);
        return { data: colorway };
    }
}
