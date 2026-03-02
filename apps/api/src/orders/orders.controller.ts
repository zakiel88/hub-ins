import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Body,
    Query,
} from '@nestjs/common';
import { Roles, CurrentUser } from '../auth/decorators';
import { OrdersService } from './orders.service';

@Controller('api/v1/orders')
export class OrdersController {
    constructor(private readonly svc: OrdersService) { }

    @Get()
    @Roles('admin', 'merchandising', 'sourcing')
    findAll(
        @Query('status') status?: string,
        @Query('financialStatus') financialStatus?: string,
        @Query('fulfillmentStatus') fulfillmentStatus?: string,
        @Query('pipelineState') pipelineState?: string,
        @Query('shopifyStoreId') shopifyStoreId?: string,
        @Query('search') search?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.svc.findAll({
            status,
            financialStatus,
            fulfillmentStatus,
            pipelineState,
            shopifyStoreId,
            search,
            page: page ? +page : undefined,
            limit: limit ? +limit : undefined,
        });
    }

    @Get('summary')
    @Roles('admin', 'merchandising')
    getSummary() {
        return this.svc.getOrdersSummary();
    }

    @Get(':id')
    @Roles('admin', 'merchandising', 'sourcing')
    findById(@Param('id') id: string) {
        return this.svc.findById(id);
    }

    @Post()
    @Roles('admin', 'merchandising')
    createManualOrder(@Body() body: any, @CurrentUser() user: any) {
        return this.svc.createManualOrder(body, user.sub);
    }

    @Patch(':id/status')
    @Roles('admin', 'merchandising')
    updateStatus(
        @Param('id') id: string,
        @Body() body: { status?: string; financialStatus?: string; fulfillmentStatus?: string },
        @CurrentUser() user: any,
    ) {
        return this.svc.updateStatus(id, body, user.sub);
    }

    @Get(':id/logs')
    @Roles('admin', 'merchandising', 'sourcing')
    getOrderLogs(@Param('id') id: string) {
        return this.svc.getOrderLogs(id);
    }
}
