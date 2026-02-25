import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    ParseUUIDPipe,
} from '@nestjs/common';
import { BrandsService } from './brands.service';
import { Roles, CurrentUser, JwtPayload } from '../auth/decorators';

@Controller('api/v1/brands')
export class BrandsController {
    constructor(private readonly brandsService: BrandsService) { }

    // ─── Brand CRUD ──────────────────────────────────

    @Get()
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('search') search?: string,
    ) {
        const result = await this.brandsService.findAll({
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            status,
            search,
        });
        return result;
    }

    @Get(':id')
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async findById(@Param('id', ParseUUIDPipe) id: string) {
        const brand = await this.brandsService.findById(id);
        return { data: brand };
    }

    @Post()
    @Roles('admin', 'sourcing_procurement')
    async create(
        @Body() body: {
            name: string;
            code: string;
            status?: string;
            website?: string;
            logoUrl?: string;
            notes?: string;
            ownerUserId?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const brand = await this.brandsService.create(body, user.sub);
        return { data: brand };
    }

    @Put(':id')
    @Roles('admin', 'sourcing_procurement')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: {
            name?: string;
            website?: string;
            logoUrl?: string;
            notes?: string;
            ownerUserId?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const brand = await this.brandsService.update(id, body, user.sub);
        return { data: brand };
    }

    @Patch(':id/status')
    @Roles('admin')
    async updateStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: { status: string },
        @CurrentUser() user: JwtPayload,
    ) {
        const brand = await this.brandsService.updateStatus(id, body.status, user.sub);
        return { data: brand };
    }

    @Delete(':id')
    @Roles('admin')
    async softDelete(
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: JwtPayload,
    ) {
        await this.brandsService.softDelete(id, user.sub);
        return { data: { message: 'Brand deleted' } };
    }

    // ─── Contacts ────────────────────────────────────

    @Get(':brandId/contacts')
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async findContacts(@Param('brandId', ParseUUIDPipe) brandId: string) {
        const contacts = await this.brandsService.findContacts(brandId);
        return { data: contacts };
    }

    @Post(':brandId/contacts')
    @Roles('admin', 'sourcing_procurement')
    async createContact(
        @Param('brandId', ParseUUIDPipe) brandId: string,
        @Body() body: {
            name: string;
            email?: string;
            phone?: string;
            role?: string;
            isPrimary?: boolean;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const contact = await this.brandsService.createContact(brandId, body, user.sub);
        return { data: contact };
    }

    @Put(':brandId/contacts/:id')
    @Roles('admin', 'sourcing_procurement')
    async updateContact(
        @Param('brandId', ParseUUIDPipe) brandId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: {
            name?: string;
            email?: string;
            phone?: string;
            role?: string;
            isPrimary?: boolean;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const contact = await this.brandsService.updateContact(brandId, id, body, user.sub);
        return { data: contact };
    }

    @Delete(':brandId/contacts/:id')
    @Roles('admin', 'sourcing_procurement')
    async deleteContact(
        @Param('brandId', ParseUUIDPipe) brandId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser() user: JwtPayload,
    ) {
        await this.brandsService.deleteContact(brandId, id, user.sub);
        return { data: { message: 'Contact deleted' } };
    }

    // ─── Contracts ───────────────────────────────────

    @Get(':brandId/contracts')
    @Roles('admin', 'merchandising', 'sourcing_procurement')
    async findContracts(@Param('brandId', ParseUUIDPipe) brandId: string) {
        const contracts = await this.brandsService.findContracts(brandId);
        return { data: contracts };
    }

    @Post(':brandId/contracts')
    @Roles('admin', 'sourcing_procurement')
    async createContract(
        @Param('brandId', ParseUUIDPipe) brandId: string,
        @Body() body: {
            type: string;
            startDate?: string;
            endDate?: string;
            terms?: string;
            fileUrl?: string;
            status?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const contract = await this.brandsService.createContract(brandId, body, user.sub);
        return { data: contract };
    }

    @Put(':brandId/contracts/:id')
    @Roles('admin', 'sourcing_procurement')
    async updateContract(
        @Param('brandId', ParseUUIDPipe) brandId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() body: {
            type?: string;
            startDate?: string;
            endDate?: string;
            terms?: string;
            fileUrl?: string;
            status?: string;
        },
        @CurrentUser() user: JwtPayload,
    ) {
        const contract = await this.brandsService.updateContract(brandId, id, body, user.sub);
        return { data: contract };
    }
}
