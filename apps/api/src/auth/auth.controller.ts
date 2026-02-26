import { Controller, Post, Get, Put, Patch, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public, CurrentUser, JwtPayload } from './decorators';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

@Controller('api/v1/auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
        private readonly mailService: MailService,
        private readonly prisma: PrismaService,
    ) { }

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

    @Put('profile')
    async updateProfile(
        @CurrentUser() user: JwtPayload,
        @Body() body: { fullName?: string; phone?: string | null },
    ) {
        const updated = await this.usersService.updateMyProfile(user.sub, body);
        return { data: updated };
    }

    @Patch('change-password')
    @HttpCode(HttpStatus.NO_CONTENT)
    async changeMyPassword(
        @CurrentUser() user: JwtPayload,
        @Body() body: { currentPassword: string; newPassword: string },
    ) {
        await this.usersService.changeMyPassword(user.sub, body.currentPassword, body.newPassword);
    }

    @Public()
    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body() body: { email: string }) {
        const user = await this.prisma.user.findUnique({ where: { email: body.email } });

        // Always return success (don't leak user existence)
        if (!user || !user.isActive) {
            return { message: 'If that email exists, a reset link has been sent.' };
        }

        // Generate token (64 hex chars)
        const token = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Invalidate old tokens
        await this.prisma.passwordResetToken.updateMany({
            where: { userId: user.id, usedAt: null },
            data: { usedAt: new Date() },
        });

        // Create new token
        await this.prisma.passwordResetToken.create({
            data: { userId: user.id, token, expiresAt },
        });

        // Send email
        await this.mailService.sendPasswordResetEmail(user.email, user.fullName, token);

        return { message: 'If that email exists, a reset link has been sent.' };
    }

    @Public()
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() body: { token: string; newPassword: string }) {
        const record = await this.prisma.passwordResetToken.findUnique({
            where: { token: body.token },
            include: { user: true },
        });

        if (!record || record.usedAt || record.expiresAt < new Date()) {
            return { success: false, message: 'Invalid or expired reset link.' };
        }

        // Hash new password + mark token used
        const passwordHash = await bcrypt.hash(body.newPassword, 10);

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: record.userId },
                data: { passwordHash },
            }),
            this.prisma.passwordResetToken.update({
                where: { id: record.id },
                data: { usedAt: new Date() },
            }),
        ]);

        return { success: true, message: 'Password has been reset. You can now log in.' };
    }
}
