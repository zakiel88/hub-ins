import {
    Controller,
    Get,
    Post,
    Param,
    Query,
    ParseUUIDPipe,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { Roles } from '../auth/decorators';

@Controller('api/v1/jobs')
export class JobsController {
    constructor(private readonly jobsService: JobsService) { }

    @Get()
    @Roles('admin', 'sourcing_procurement')
    async findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('status') status?: string,
        @Query('jobType') jobType?: string,
        @Query('storeId') storeId?: string,
    ) {
        return this.jobsService.findAll({
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            status,
            jobType,
            storeId,
        });
    }

    @Get('summary')
    @Roles('admin', 'sourcing_procurement')
    async getSummary() {
        return this.jobsService.getSummary();
    }

    @Get(':id')
    @Roles('admin', 'sourcing_procurement')
    async findById(@Param('id', ParseUUIDPipe) id: string) {
        const job = await this.jobsService.findById(id);
        return { data: job };
    }

    @Post(':id/retry')
    @Roles('admin')
    async retry(@Param('id', ParseUUIDPipe) id: string) {
        const job = await this.jobsService.retry(id);
        return { data: job };
    }
}
