import {
    Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProcurementService } from './procurement.service';

@Controller('api/v1/procurement')
@UseGuards(JwtAuthGuard)
export class ProcurementController {
    constructor(private readonly procurement: ProcurementService) { }

    /* ── PR ── */

    @Post('pr')
    async createPR(@Body() body: any, @Request() req: any) {
        return this.procurement.createPR(body, req.user.id);
    }

    @Get('pr')
    async listPRs(
        @Query('status') status?: string,
        @Query('brandId') brandId?: string,
        @Query('orderId') orderId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.procurement.listPRs({
            status, brandId, orderId,
            page: parseInt(page || '1'),
            limit: parseInt(limit || '50'),
        });
    }

    @Patch('pr/:id/status')
    async updatePRStatus(
        @Param('id') id: string,
        @Body() body: { status: string },
        @Request() req: any,
    ) {
        return this.procurement.updatePRStatus(id, body.status, req.user.id);
    }

    /* ── PO ── */

    @Post('po')
    async createPO(@Body() body: any, @Request() req: any) {
        return this.procurement.createPO(body, req.user.id);
    }

    @Get('po')
    async listPOs(
        @Query('status') status?: string,
        @Query('brandId') brandId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.procurement.listPOs({
            status, brandId,
            page: parseInt(page || '1'),
            limit: parseInt(limit || '50'),
        });
    }

    @Get('po/:id')
    async findPO(@Param('id') id: string) {
        return this.procurement.findPO(id);
    }

    @Patch('po/:id/status')
    async updatePOStatus(
        @Param('id') id: string,
        @Body() body: { status: string },
        @Request() req: any,
    ) {
        return this.procurement.updatePOStatus(id, body.status, req.user.id);
    }
}
