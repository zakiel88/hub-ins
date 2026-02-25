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
import { CollectionsService } from './collections.service';
import { Roles, CurrentUser, JwtPayload } from '../auth/decorators';

@Controller('api/v1')
export class CollectionsController {
    constructor(private readonly collectionsService: CollectionsService) { }

    // GET /api/v1/collections?brandId=&status=&season=&year=&search=
    @Get('collections')
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async findAll(
        @Query('brandId') brandId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('season') season?: string,
        @Query('year') year?: string,
    ) {
        return this.collectionsService.findAll({
            brandId,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            status,
            search,
            season,
            year: year ? parseInt(year, 10) : undefined,
        });
    }

    // GET /api/v1/collections/:id
    @Get('collections/:id')
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async findById(@Param('id', ParseUUIDPipe) id: string) {
        const collection = await this.collectionsService.findById(id);
        return { data: collection };
    }

    // POST /api/v1/brands/:brandId/collections
    @Post('brands/:brandId/collections')
    @Roles('admin', 'merchandising')
    async create(
        @Param('brandId', ParseUUIDPipe) brandId: string,
        @Body() body: {
            name: string;
            season?: string;
            year?: number;
            status?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const collection = await this.collectionsService.create(
            { ...body, brandId },
            user.sub,
        );
        return { data: collection };
    }

    // PUT /api/v1/collections/:id
    @Put('collections/:id')
    @Roles('admin', 'merchandising')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: {
            name?: string;
            season?: string;
            year?: number;
            status?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const collection = await this.collectionsService.update(id, body, user.sub);
        return { data: collection };
    }
}
