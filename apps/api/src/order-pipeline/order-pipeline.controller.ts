import {
    Controller,
    Post,
    Get,
    Patch,
    Param,
    Body,
    Query,
    UseGuards,
    Request,
    Headers,
    HttpCode,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrderPipelineService } from './order-pipeline.service';
import { OrderSyncService } from './order-sync.service';
import { FedexService } from './fedex.service';

@Controller('api/v1')
export class OrderPipelineController {
    constructor(
        private readonly pipeline: OrderPipelineService,
        private readonly sync: OrderSyncService,
        private readonly fedex: FedexService,
    ) { }

    /* ── State Machine ── */

    @UseGuards(JwtAuthGuard)
    @Post('orders/:id/transition')
    async transition(
        @Param('id') id: string,
        @Body() body: { targetState: string; reason?: string },
        @Request() req: any,
    ) {
        return this.pipeline.transition(id, body.targetState, req.user.id, body.reason);
    }

    @UseGuards(JwtAuthGuard)
    @Post('orders/:id/flags')
    async setFlags(
        @Param('id') id: string,
        @Body() body: { flags: Record<string, boolean> },
        @Request() req: any,
    ) {
        return this.pipeline.setFlags(id, body.flags, req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Post('orders/:id/items/:itemId/check-stock')
    async checkItemStock(
        @Param('id') orderId: string,
        @Param('itemId') itemId: string,
        @Body() body: { action: 'IN_STOCK' | 'NEEDS_PURCHASE' },
        @Request() req: any,
    ) {
        return this.pipeline.checkItemStock(orderId, itemId, body.action, req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Get('orders/:id/check-stock')
    async checkStockAll(@Param('id') orderId: string) {
        return this.pipeline.checkStockAll(orderId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('orders/:id/mark-items')
    async markItemsBulk(
        @Param('id') orderId: string,
        @Body() body: { itemIds: string[]; action: 'IN_STOCK' | 'NEEDS_PURCHASE' },
        @Request() req: any,
    ) {
        return this.pipeline.markItemsBulk(orderId, body.itemIds, body.action, req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Get('orders/:id/transitions')
    async getTransitions(@Param('id') id: string) {
        // Need to fetch order first to get current state
        const { PrismaService } = await import('../prisma/prisma.service');
        // We already have pipeline service which uses prisma
        return { data: { message: 'Use order detail to see available transitions' } };
    }

    /* ── FedEx Address Validation ── */

    @UseGuards(JwtAuthGuard)
    @Post('orders/:id/validate-address')
    async validateAddress(
        @Param('id') orderId: string,
        @Request() req: any,
    ) {
        try {
            const order = await this.pipeline.getOrderById(orderId);
            const addr = (order.shippingAddress || {}) as Record<string, any>;

            // Auto: FedEx first → Google fallback for unsupported countries
            const result = await this.fedex.validateAddressAuto(addr);

            return {
                orderId,
                address: addr,
                fedex: {
                    valid: result.valid,
                    classification: result.classification,
                    resolvedAddress: result.resolvedAddress,
                    changes: result.changes,
                    provider: result.provider,
                },
            };
        } catch (error: any) {
            console.error('Address validation error:', error.message, error.stack);
            throw error;
        }
    }

    /* ── Merchandise: all line items across orders ── */

    @UseGuards(JwtAuthGuard)
    @Get('merchandise')
    async getMerchandise(
        @Query('itemState') itemState?: string,
        @Query('orderState') orderState?: string,
        @Query('brandId') brandId?: string,
        @Query('search') search?: string,
        @Query('includeFulfilled') includeFulfilled?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.pipeline.getMerchandiseItems({
            itemState,
            orderState,
            brandId,
            search,
            includeFulfilled: includeFulfilled === 'true',
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 50,
        });
    }

    /* ── Merchandise Item State ── */

    @UseGuards(JwtAuthGuard)
    @Patch('merchandise/:id/state')
    async updateMerchandiseItemState(
        @Param('id') id: string,
        @Body() body: { itemState: string },
    ) {
        const validStates = ['PENDING', 'IN_STOCK', 'NEEDS_PURCHASE'];
        if (!validStates.includes(body.itemState)) {
            throw new NotFoundException(`Invalid item state: ${body.itemState}`);
        }
        const item = await this.pipeline['prisma'].orderLineItem.update({
            where: { id },
            data: { itemState: body.itemState },
        });
        return { data: item };
    }

    /* ── Pipeline Dashboard ── */

    @UseGuards(JwtAuthGuard)
    @Get('pipeline/summary')
    async getSummary() {
        return this.pipeline.getStateSummary();
    }

    /* ── Sync Orders ── */

    @UseGuards(JwtAuthGuard)
    @Post('shopify-stores/:storeId/sync-orders')
    async syncOrders(
        @Param('storeId') storeId: string,
        @Query('limit') limit: string,
        @Query('sinceDate') sinceDate: string,
        @Request() req: any,
    ) {
        return this.sync.syncOrders(storeId, req.user.id, parseInt(limit) || 250, sinceDate || undefined);
    }

    /* ── Shopify Webhook (no auth — verified by HMAC) ── */

    @Post('integrations/shopify/webhook/orders-create')
    @HttpCode(200)
    async webhookOrderCreate(
        @Body() payload: any,
        @Headers('x-shopify-shop-domain') shopDomain: string,
    ) {
        await this.sync.processWebhook(shopDomain, payload);
        return { received: true };
    }
}
