import {
    Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TasksService } from './tasks.service';

@Controller('api/v1/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
    constructor(private readonly tasks: TasksService) { }

    @Post()
    async create(@Body() body: any, @Request() req: any) {
        return this.tasks.create(body, req.user.id);
    }

    @Get()
    async findAll(
        @Query('type') type?: string,
        @Query('status') status?: string,
        @Query('assigneeId') assigneeId?: string,
        @Query('orderId') orderId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.tasks.findAll({
            type, status, assigneeId, orderId,
            page: parseInt(page || '1'),
            limit: parseInt(limit || '50'),
        });
    }

    @Get('summary')
    async getSummary() {
        return this.tasks.getSummary();
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.tasks.findOne(id);
    }

    @Patch(':id/status')
    async updateStatus(
        @Param('id') id: string,
        @Body() body: { status: string },
        @Request() req: any,
    ) {
        return this.tasks.updateStatus(id, body.status as any, req.user.id);
    }

    @Patch(':id/assign')
    async assign(
        @Param('id') id: string,
        @Body() body: { assigneeId: string },
        @Request() req: any,
    ) {
        return this.tasks.assign(id, body.assigneeId, req.user.id);
    }

    @Post(':id/comments')
    async addComment(
        @Param('id') id: string,
        @Body() body: { content: string },
        @Request() req: any,
    ) {
        console.log('ADD COMMENT:', { id, body, userId: req.user?.id });
        try {
            return await this.tasks.addComment(id, body.content, req.user.id);
        } catch (err: any) {
            console.error('ADD COMMENT ERROR:', err.message, err.stack?.substring(0, 300));
            throw err;
        }
    }
}
