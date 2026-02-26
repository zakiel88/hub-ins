import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './decorators';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwt: JwtService,
    ) { }

    async login(email: string, password: string) {
        const user = await this.validateUser(email, password);

        const payload: JwtPayload = {
            sub: user.id,
            email: user.email,
            role: user.role,
            brandId: user.brandId ?? undefined,
        };

        const token = this.jwt.sign(payload);

        // Update last login
        await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        this.logger.log(`User logged in: ${user.email} (role: ${user.role})`);

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                phone: user.phone,
                role: user.role,
                brandId: user.brandId,
            },
        };
    }

    async validateUser(email: string, password: string) {
        const user = await this.prisma.user.findUnique({ where: { email } });

        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is deactivated');
        }

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return user;
    }

    async getProfile(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                fullName: true,
                phone: true,
                role: true,
                brandId: true,
                isActive: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        return user;
    }

    /**
     * Hash a password using bcrypt (10 rounds).
     * Used by seed scripts and user creation.
     */
    static async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, 10);
    }
}
