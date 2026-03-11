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

    @Get('debug/:id')
    @Roles('admin')
    async debugOrder(@Param('id') id: string) {
        const prisma = (this.svc as any).prisma || (this.svc as any)['prisma'];
        const results: any = { steps: [] };
        try {
            // Step 1: Load order only
            const order = await prisma.order.findUnique({ where: { id } });
            results.steps.push({ step: 'order', ok: !!order, id: order?.id });
            if (!order) return { error: 'Order not found', results };

            // Step 2: Load order with lineItems
            const withItems = await prisma.order.findUnique({
                where: { id },
                include: { lineItems: true },
            });
            results.steps.push({ step: 'lineItems', ok: true, count: withItems?.lineItems?.length });

            // Step 3: Load order with store
            const withStore = await prisma.order.findUnique({
                where: { id },
                include: { shopifyStore: { select: { storeName: true } } },
            });
            results.steps.push({ step: 'shopifyStore', ok: true, store: withStore?.shopifyStore?.storeName });

            // Step 4: Try full findById
            const full = await this.svc.findById(id);
            results.steps.push({ step: 'findById', ok: true });
            results.order = full.data;
        } catch (e: any) {
            results.error = e.message;
            results.stack = e.stack?.substring(0, 500);
        }
        return JSON.parse(JSON.stringify(results, (_, v) => typeof v === 'bigint' ? v.toString() : v));
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
