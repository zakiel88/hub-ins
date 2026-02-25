import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Param,
    Body,
    Query,
} from '@nestjs/common';
import { Roles } from '../auth/decorators';
import { CurrentUser } from '../auth/decorators';
import { InventoryService } from './inventory.service';

@Controller('api/v1')
export class InventoryController {
    constructor(private readonly svc: InventoryService) { }

    /* ── Warehouses ── */

    @Get('warehouses')
    @Roles('admin', 'merchandising', 'sourcing')
    findAllWarehouses(
        @Query('search') search?: string,
        @Query('isActive') isActive?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.svc.findAllWarehouses({
            search,
            isActive,
            page: page ? +page : undefined,
            limit: limit ? +limit : undefined,
        });
    }

    @Get('warehouses/:id')
    @Roles('admin', 'merchandising', 'sourcing')
    findWarehouseById(@Param('id') id: string) {
        return this.svc.findWarehouseById(id);
    }

    @Get('warehouses/:id/summary')
    @Roles('admin', 'merchandising')
    getWarehouseSummary(@Param('id') id: string) {
        return this.svc.getWarehouseSummary(id);
    }

    @Post('warehouses')
    @Roles('admin')
    createWarehouse(
        @Body() body: { code: string; name: string; address?: string },
        @CurrentUser() user: any,
    ) {
        return this.svc.createWarehouse(body, user.sub);
    }

    @Put('warehouses/:id')
    @Roles('admin')
    updateWarehouse(
        @Param('id') id: string,
        @Body() body: { name?: string; address?: string; isActive?: boolean },
        @CurrentUser() user: any,
    ) {
        return this.svc.updateWarehouse(id, body, user.sub);
    }

    /* ── Inventory Items ── */

    @Get('inventory')
    @Roles('admin', 'merchandising', 'sourcing')
    findAllInventory(
        @Query('warehouseId') warehouseId?: string,
        @Query('colorwayId') colorwayId?: string,
        @Query('syncStatus') syncStatus?: string,
        @Query('search') search?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.svc.findAllInventory({
            warehouseId,
            colorwayId,
            syncStatus,
            search,
            page: page ? +page : undefined,
            limit: limit ? +limit : undefined,
        });
    }

    @Get('inventory/:id')
    @Roles('admin', 'merchandising', 'sourcing')
    findInventoryById(@Param('id') id: string) {
        return this.svc.findInventoryById(id);
    }

    @Post('inventory')
    @Roles('admin', 'merchandising')
    upsertInventory(
        @Body() body: { colorwayId: string; warehouseId: string; quantityOnHand: number; quantityReserved?: number },
        @CurrentUser() user: any,
    ) {
        return this.svc.upsertInventory(body, user.sub);
    }

    @Patch('inventory/:id/adjust')
    @Roles('admin', 'merchandising')
    adjustStock(
        @Param('id') id: string,
        @Body() body: { adjustment: number; reason?: string },
        @CurrentUser() user: any,
    ) {
        return this.svc.adjustStock(id, body, user.sub);
    }
}
