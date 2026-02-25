import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
} from '@nestjs/common';
import { PricingService } from './pricing.service';
import { Roles, CurrentUser, JwtPayload } from '../auth/decorators';

@Controller('api/v1')
export class PricingController {
    constructor(private readonly pricingService: PricingService) { }

    // GET /api/v1/pricing?colorwayId=&market=&status=
    @Get('pricing')
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async findAll(
        @Query('colorwayId') colorwayId?: string,
        @Query('market') market?: string,
        @Query('status') status?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.pricingService.findAll({
            colorwayId,
            market,
            status,
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
        });
    }

    // GET /api/v1/pricing/:id
    @Get('pricing/:id')
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async findById(@Param('id', ParseUUIDPipe) id: string) {
        const mp = await this.pricingService.findById(id);
        return { data: mp };
    }

    // GET /api/v1/pricing/summary/:market
    @Get('pricing/summary/:market')
    @Roles('admin', 'merchandising')
    async marketSummary(@Param('market') market: string) {
        const summary = await this.pricingService.getMarketSummary(market);
        return { data: summary };
    }

    // POST /api/v1/pricing — single price
    @Post('pricing')
    @Roles('admin', 'merchandising')
    async create(
        @Body() body: {
            colorwayId: string;
            market: string;
            retailPrice: number;
            comparePrice?: number;
            currency: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const mp = await this.pricingService.create(body, user.sub);
        return { data: mp };
    }

    // POST /api/v1/pricing/batch — multiple prices
    @Post('pricing/batch')
    @Roles('admin', 'merchandising')
    async createBatch(
        @Body() body: {
            items: Array<{
                colorwayId: string;
                market: string;
                retailPrice: number;
                comparePrice?: number;
                currency: string;
            }>;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const result = await this.pricingService.createBatch(body.items, user.sub);
        return { data: result };
    }

    // PUT /api/v1/pricing/:id — update price (draft only)
    @Put('pricing/:id')
    @Roles('admin', 'merchandising')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: {
            retailPrice?: number;
            comparePrice?: number;
            currency?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const mp = await this.pricingService.update(id, body, user.sub);
        return { data: mp };
    }

    // PATCH /api/v1/pricing/:id/review — approve or reject
    @Patch('pricing/:id/review')
    @Roles('admin', 'merchandising')
    async review(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: {
            status: 'approved' | 'rejected';
            reviewNotes?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const mp = await this.pricingService.review(id, body, user.sub);
        return { data: mp };
    }
}
