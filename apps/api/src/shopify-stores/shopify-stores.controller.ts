import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Param,
    Body,
    Query,
} from '@nestjs/common';
import { Roles, CurrentUser } from '../auth/decorators';
import { ShopifyStoresService } from './shopify-stores.service';

@Controller('api/v1/shopify-stores')
export class ShopifyStoresController {
    constructor(private readonly svc: ShopifyStoresService) { }

    @Post()
    @Roles('admin')
    connectStore(
        @Body() body: {
            shopifyDomain: string;
            storeName?: string;
            clientId: string;
            clientSecret: string;
        },
        @CurrentUser() user: any,
    ) {
        return this.svc.connectStore(body, user.sub);
    }

    @Get()
    @Roles('admin')
    findAll(
        @Query('search') search?: string,
        @Query('isActive') isActive?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.svc.findAll({
            search,
            isActive,
            page: page ? +page : undefined,
            limit: limit ? +limit : undefined,
        });
    }

    @Get(':id')
    @Roles('admin')
    findById(@Param('id') id: string) {
        return this.svc.findById(id);
    }

    @Put(':id')
    @Roles('admin')
    update(
        @Param('id') id: string,
        @Body() body: { storeName?: string; market?: string; apiVersion?: string },
        @CurrentUser() user: any,
    ) {
        return this.svc.update(id, body, user.sub);
    }

    @Patch(':id/toggle')
    @Roles('admin')
    toggleActive(@Param('id') id: string, @CurrentUser() user: any) {
        return this.svc.toggleActive(id, user.sub);
    }

    @Delete(':id')
    @Roles('admin')
    delete(@Param('id') id: string, @CurrentUser() user: any) {
        return this.svc.delete(id, user.sub);
    }

    @Get(':id/test-connection')
    @Roles('admin')
    testConnection(@Param('id') id: string) {
        return this.svc.testConnection(id);
    }

    @Get(':id/sync-logs')
    @Roles('admin')
    getSyncLogs(
        @Param('id') id: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.svc.getSyncLogs(id, {
            page: page ? +page : undefined,
            limit: limit ? +limit : undefined,
        });
    }
}
