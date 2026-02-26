import {
    Controller, Get, Post, Put, Patch, Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles, CurrentUser, JwtPayload } from '../auth/decorators';

@Controller('api/v1/users')
@Roles('admin')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    async findAll() {
        const users = await this.usersService.findAll();
        return { data: users };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const user = await this.usersService.findOne(id);
        return { data: user };
    }

    @Post()
    async create(@Body() body: {
        email: string;
        password: string;
        fullName: string;
        phone?: string;
        role: string;
        brandId?: string;
    }) {
        const user = await this.usersService.create(body);
        return { data: user };
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() body: { fullName?: string; phone?: string | null; role?: string; brandId?: string | null },
    ) {
        const user = await this.usersService.update(id, body);
        return { data: user };
    }

    @Patch(':id/password')
    @HttpCode(HttpStatus.NO_CONTENT)
    async changePassword(
        @Param('id') id: string,
        @Body() body: { newPassword: string },
    ) {
        await this.usersService.changePassword(id, body.newPassword);
    }

    @Patch(':id/toggle')
    async toggleActive(@Param('id') id: string) {
        const user = await this.usersService.toggleActive(id);
        return { data: user };
    }
}
