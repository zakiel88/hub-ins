import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, CurrentUser, JwtPayload } from './decorators';

@Controller('api/v1/auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() body: { email: string; password: string }) {
        const result = await this.authService.login(body.email, body.password);
        return { data: result };
    }

    @Get('me')
    async me(@CurrentUser() user: JwtPayload) {
        const profile = await this.authService.getProfile(user.sub);
        return { data: profile };
    }
}
